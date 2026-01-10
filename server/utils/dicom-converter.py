#!/usr/bin/env python3
"""
DICOM to PNG Converter for DecXpert CT
Converts DICOM files to PNG format for AI analysis
"""

import sys
import os
import base64
import io
import json
from pathlib import Path

try:
    import pydicom
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Missing required Python packages: {e}",
        "message": "Please install: pip install pydicom Pillow numpy"
    }))
    sys.exit(1)

def convert_dicom_to_png(dicom_data):
    """
    Convert DICOM data to PNG base64 string - simplified reliable approach
    """
    try:
        # Read DICOM from bytes - force read even with compression issues
        ds = pydicom.dcmread(io.BytesIO(dicom_data), force=True)
        
        # Extract basic metadata - handle MultiValue objects
        def safe_extract(attr_name, default='Unknown'):
            try:
                value = getattr(ds, attr_name, default)
                # Convert MultiValue to list, single values to string
                if hasattr(value, '__iter__') and not isinstance(value, str):
                    return list(value)
                return str(value) if value != default else default
            except:
                return default
        
        metadata = {
            "modality": safe_extract('Modality'),
            "patient_id": safe_extract('PatientID'),
            "study_description": safe_extract('StudyDescription'),
            "series_description": safe_extract('SeriesDescription'),
            "rows": getattr(ds, 'Rows', 0),
            "columns": getattr(ds, 'Columns', 0),
            "slice_thickness": safe_extract('SliceThickness'),
            "pixel_spacing": safe_extract('PixelSpacing'),
        }
        
        # Check if this is a CT scan
        if metadata["modality"] != 'CT':
            return {
                "success": False,
                "error": f"Not a CT scan. Detected modality: {metadata['modality']}",
                "metadata": metadata
            }
        
        # Get pixel array - handle compressed data
        try:
            pixel_array = ds.pixel_array.astype(np.float32)
        except Exception as pixel_error:
            # Try alternative approach for compressed data
            if hasattr(ds, 'PixelData'):
                # Raw pixel data available, try to interpret
                pixel_data = ds.PixelData
                rows = ds.Rows
                cols = ds.Columns
                
                # Convert bytes to numpy array based on data type
                if ds.BitsAllocated == 16:
                    pixel_array = np.frombuffer(pixel_data, dtype=np.int16).reshape(rows, cols).astype(np.float32)
                else:
                    pixel_array = np.frombuffer(pixel_data, dtype=np.uint8).reshape(rows, cols).astype(np.float32)
            else:
                raise Exception(f"Cannot access pixel data: {str(pixel_error)}")
        
        # Apply DICOM rescale slope and intercept to get Hounsfield Units for CT
        # This is critical for proper CT windowing
        rescale_intercept = float(getattr(ds, 'RescaleIntercept', 0))
        rescale_slope = float(getattr(ds, 'RescaleSlope', 1))
        pixel_array = pixel_array * rescale_slope + rescale_intercept
        
        # Check if pixel array is valid (not all zeros or has no variation)
        if pixel_array.max() == pixel_array.min():
            raise Exception(f"Invalid pixel data: all pixels have same value ({pixel_array.min()}). File may be corrupted.")
        
        # Check if pixel array is all zeros
        if pixel_array.max() == 0:
            raise Exception("Invalid pixel data: all pixels are zero. File may be corrupted or empty.")
        
        # Apply windowing for CT scans using LUNG window for optimal pathology detection
        # Lung window (WL: -600, WW: 1500) is ideal for detecting:
        # - Pneumothorax, emphysema, nodules, infiltrates, pleural effusion
        window_center = -600  # Lung window center (Hounsfield Units)
        window_width = 1500   # Lung window width
        
        # Apply window/level transformation
        img_min = window_center - window_width // 2
        img_max = window_center + window_width // 2
        windowed = np.clip(pixel_array, img_min, img_max)
        
        # Normalize to 0-255 with proper contrast
        normalized = ((windowed - img_min) / (img_max - img_min) * 255.0).astype(np.uint8)
        image_8bit = normalized
        
        # Convert to PIL Image
        image = Image.fromarray(image_8bit)
        
        # Convert to RGB for better compatibility
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize for cost optimization (original -> 384x384 max)
        if max(image.size) > 384:
            # Calculate new size maintaining aspect ratio
            ratio = min(384 / image.width, 384 / image.height)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Save to bytes with compression
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG', optimize=True, compress_level=6)
        img_buffer.seek(0)
        
        # Convert to base64
        base64_string = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        
        return {
            "success": True,
            "base64_image": base64_string,
            "metadata": metadata,
            "image_info": {
                "format": "PNG",
                "size": image.size,
                "mode": image.mode
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Error converting DICOM: {str(e)}",
            "metadata": {}
        }

def main():
    """
    Main function to handle command line conversion
    """
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python dicom-converter.py <dicom_file_path>"
        }))
        sys.exit(1)
    
    try:
        # Get DICOM file path from command line
        dicom_file_path = sys.argv[1]
        
        # Read DICOM file
        with open(dicom_file_path, 'rb') as f:
            dicom_data = f.read()
        
        # Convert DICOM to PNG
        result = convert_dicom_to_png(dicom_data)
        
        # Output JSON result
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Conversion failed: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()