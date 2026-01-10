#!/usr/bin/env python3
"""
Intelligent DICOM Slice Selection with FULL CHEST COVERAGE
Uses 5-region quota system + variance-based prioritization for comprehensive pathology detection
"""

import sys
import json
import base64
import numpy as np
import pydicom
from io import BytesIO
import cv2

def dicom_to_hu(dicom_data):
    """Convert DICOM pixel data to Hounsfield Units (HU)."""
    img = dicom_data.pixel_array.astype(np.float32)
    slope = getattr(dicom_data, "RescaleSlope", 1)
    intercept = getattr(dicom_data, "RescaleIntercept", 0)
    return img * slope + intercept

def get_lung_mask(slice_hu, lower=-1000, upper=-400, area_thresh=0.1):
    """Detect if slice contains lung tissue based on HU thresholding."""
    mask = np.logical_and(slice_hu > lower, slice_hu < upper)
    lung_fraction = np.sum(mask) / mask.size
    return lung_fraction >= area_thresh

def calculate_slice_variance(hu_slice):
    """Calculate variance score for a slice - higher variance = more likely pathology."""
    if hu_slice is None:
        return 0
    try:
        lung_mask = np.logical_and(hu_slice > -1000, hu_slice < -200)
        if np.sum(lung_mask) < 100:
            return 0
        lung_values = hu_slice[lung_mask]
        variance = np.var(lung_values)
        return float(variance)
    except:
        return 0

def select_representative_slices(dicom_buffers, target_count=200):
    """
    Select slices with FULL CHEST COVERAGE using 5-region quota system.
    Ensures apex-to-base coverage for all pathology types.
    
    CT Chest Anatomy - 5 REGIONS (all included):
    - APEX (0-20%): Upper lung apices - TB, apical nodules, upper emphysema
    - UPPER (20-40%): Upper lobes below apex - COPD, upper lobe masses
    - CENTRAL (40-60%): Carina to mid-chest - Central masses, hilar adenopathy
    - LOWER (60-80%): Lower lobes - ILD (UIP), lower lobe pneumonia
    - BASE (80-100%): Lung bases near diaphragm - Pleural effusions, basilar atelectasis
    
    Each region gets ~20% of target slices (quota system).
    Within each region, high-variance slices are prioritized (more likely pathology).
    
    Args:
        dicom_buffers: List of base64-encoded DICOM data
        target_count: Target number of slices (default 200)
    
    Returns:
        List of indices of selected slices with full chest coverage
    """
    
    # Parse DICOM data
    dicom_slices = []
    for buffer in dicom_buffers:
        try:
            dcm_data = pydicom.dcmread(BytesIO(base64.b64decode(buffer)))
            dicom_slices.append(dcm_data)
        except Exception as e:
            dicom_slices.append(None)
    
    # Convert to HU and find lung slices with variance scores
    hu_slices = []
    lung_data = []  # (index, variance_score)
    
    for i, dcm in enumerate(dicom_slices):
        if dcm is None:
            hu_slices.append(None)
            continue
            
        try:
            hu = dicom_to_hu(dcm)
            hu_slices.append(hu)
            
            if get_lung_mask(hu):
                variance = calculate_slice_variance(hu)
                lung_data.append((i, variance))
        except:
            hu_slices.append(None)
    
    # Fallback: if no lung slices detected, use all valid indices
    if not lung_data:
        lung_indices = [i for i in range(len(dicom_slices)) if dicom_slices[i] is not None]
        return lung_indices[:target_count]
    
    # Extract lung indices
    lung_indices = [idx for idx, _ in lung_data]
    variance_scores = {idx: var for idx, var in lung_data}
    
    # If very few slices, return all of them
    if len(lung_indices) <= 10:
        return lung_indices
    
    # ===== 5-REGION QUOTA SYSTEM =====
    total_lung_slices = len(lung_indices)
    
    # Define 5 anatomical regions (each ~20% of lung slices)
    regions = {
        'APEX': (0.00, 0.20),    # Top 20% - TB, apical nodules
        'UPPER': (0.20, 0.40),   # Upper lobes - COPD, masses
        'CENTRAL': (0.40, 0.60), # Mid chest - hilar findings
        'LOWER': (0.60, 0.80),   # Lower lobes - ILD, pneumonia
        'BASE': (0.80, 1.00)     # Lung bases - effusions, atelectasis
    }
    
    # Calculate quota per region (distribute target_count across 5 regions)
    quota_per_region = target_count // 5
    extra_slices = target_count % 5  # Distribute extras to central regions
    
    selected_indices = []
    region_stats = {}
    
    for region_name, (start_frac, end_frac) in regions.items():
        # Calculate slice range for this region
        start_idx = int(total_lung_slices * start_frac)
        end_idx = int(total_lung_slices * end_frac)
        
        # Get slices in this region
        region_slices = lung_indices[start_idx:end_idx]
        
        if not region_slices:
            region_stats[region_name] = 0
            continue
        
        # Determine quota for this region (add extras to CENTRAL and LOWER - most pathology)
        region_quota = quota_per_region
        if extra_slices > 0 and region_name in ['CENTRAL', 'LOWER', 'APEX']:
            region_quota += 1
            extra_slices -= 1
        
        # Sort slices by variance (high variance = more likely pathology)
        region_slices_with_var = [(idx, variance_scores.get(idx, 0)) for idx in region_slices]
        region_slices_with_var.sort(key=lambda x: x[1], reverse=True)
        
        # Select top-variance slices up to quota
        if len(region_slices) <= region_quota:
            # Take all slices from this region
            selected_from_region = region_slices
        else:
            # Take highest-variance slices, but ensure even distribution
            # Mix: 70% high-variance + 30% uniform sampling for coverage
            high_var_count = int(region_quota * 0.7)
            uniform_count = region_quota - high_var_count
            
            # High variance slices
            high_var_slices = [idx for idx, _ in region_slices_with_var[:high_var_count]]
            
            # Uniform sample from remaining
            remaining = [idx for idx in region_slices if idx not in high_var_slices]
            if remaining and uniform_count > 0:
                step = max(1, len(remaining) // uniform_count)
                uniform_slices = [remaining[i * step] for i in range(min(uniform_count, len(remaining)))]
            else:
                uniform_slices = []
            
            selected_from_region = list(set(high_var_slices + uniform_slices))
        
        selected_indices.extend(selected_from_region)
        region_stats[region_name] = len(selected_from_region)
    
    # Sort by original index order
    selected_indices = sorted(list(set(selected_indices)))
    
    # Log coverage stats
    print(f"🎯 FULL CHEST COVERAGE - 5-Region Quota System:", file=sys.stderr)
    print(f"   📍 APEX (0-20%): {region_stats.get('APEX', 0)} slices - TB, apical nodules", file=sys.stderr)
    print(f"   📍 UPPER (20-40%): {region_stats.get('UPPER', 0)} slices - COPD, upper masses", file=sys.stderr)
    print(f"   📍 CENTRAL (40-60%): {region_stats.get('CENTRAL', 0)} slices - hilar findings", file=sys.stderr)
    print(f"   📍 LOWER (60-80%): {region_stats.get('LOWER', 0)} slices - ILD, pneumonia", file=sys.stderr)
    print(f"   📍 BASE (80-100%): {region_stats.get('BASE', 0)} slices - effusions, atelectasis", file=sys.stderr)
    print(f"   ✅ TOTAL: {len(selected_indices)} slices from {total_lung_slices} lung slices", file=sys.stderr)
    
    return selected_indices

def main():
    """CLI entry point for Node.js integration - reads from stdin."""
    try:
        # Read JSON input from stdin to avoid command-line argument length limits
        input_data = json.loads(sys.stdin.read())
        dicom_buffers = input_data.get('dicomBuffers', [])
        target_count = input_data.get('targetCount', 200)
        
        if not dicom_buffers:
            print(json.dumps({"error": "No DICOM buffers provided"}))
            sys.exit(1)
        
        # Perform intelligent selection
        selected_indices = select_representative_slices(dicom_buffers, target_count)
        
        # Return results as JSON
        result = {
            "success": True,
            "selectedIndices": selected_indices,
            "totalSlices": len(dicom_buffers),
            "selectedCount": len(selected_indices)
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}))
        sys.exit(1)

if __name__ == "__main__":
    main()
