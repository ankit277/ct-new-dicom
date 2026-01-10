#!/usr/bin/env python3
"""
Universal Image Converter for DecXpert CT
Converts any medical image format (DICOM, PNG, JPEG, etc.) to standardized PNG
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

def is_dicom_data(data):
    """Check if data is DICOM format - handles both with and without DICM preamble"""
    try:
        # First check for DICM magic number at byte 128 (most common)
        if len(data) >= 132 and data[128:132] == b'DICM':
            return True
        
        # Try to read as DICOM using pydicom (handles files without DICM preamble)
        try:
            ds = pydicom.dcmread(io.BytesIO(data), force=True)
            # If successful, it's a valid DICOM file
            return hasattr(ds, 'pixel_array') or hasattr(ds, 'PixelData')
        except:
            return False
    except:
        return False

def convert_dicom_to_png(dicom_data):
    """Convert DICOM data to PNG base64 string"""
    try:
        # Read DICOM from bytes
        ds = pydicom.dcmread(io.BytesIO(dicom_data), force=True)
        
        # Extract basic metadata
        def safe_extract(attr_name, default='Unknown'):
            try:
                value = getattr(ds, attr_name, default)
                if hasattr(value, '__iter__') and not isinstance(value, str):
                    return list(value)
                return str(value) if value != default else default
            except:
                return default
        
        metadata = {
            "modality": safe_extract('Modality'),
            "patient_id": safe_extract('PatientID'),
            "format": "DICOM",
            "rows": getattr(ds, 'Rows', 0),
            "columns": getattr(ds, 'Columns', 0)
        }
        
        # Get pixel array
        try:
            pixel_array = ds.pixel_array.astype(np.float32)
        except Exception as pixel_error:
            if hasattr(ds, 'PixelData'):
                pixel_data = ds.PixelData
                rows = ds.Rows
                cols = ds.Columns
                
                if ds.BitsAllocated == 16:
                    pixel_array = np.frombuffer(pixel_data, dtype=np.int16).reshape(rows, cols).astype(np.float32)
                else:
                    pixel_array = np.frombuffer(pixel_data, dtype=np.uint8).reshape(rows, cols).astype(np.float32)
            else:
                raise Exception(f"Cannot access pixel data: {str(pixel_error)}")
        
        # Apply DICOM rescale for CT (Hounsfield Units)
        rescale_intercept = float(getattr(ds, 'RescaleIntercept', 0))
        rescale_slope = float(getattr(ds, 'RescaleSlope', 1))
        pixel_array = pixel_array * rescale_slope + rescale_intercept
        
        # Validate pixel data
        if pixel_array.max() == pixel_array.min():
            raise Exception(f"Invalid pixel data: all pixels have same value ({pixel_array.min()})")
        
        # Apply lung window for CT
        window_center = -600
        window_width = 1500
        img_min = window_center - window_width // 2
        img_max = window_center + window_width // 2
        windowed = np.clip(pixel_array, img_min, img_max)
        
        # Normalize to 0-255
        normalized = ((windowed - img_min) / (img_max - img_min) * 255.0).astype(np.uint8)
        image = Image.fromarray(normalized)
        
        # Convert to RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if needed
        if max(image.size) > 384:
            ratio = min(384 / image.width, 384 / image.height)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Save as PNG
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG', optimize=True, compress_level=6)
        img_buffer.seek(0)
        
        base64_string = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        
        return {
            "success": True,
            "base64_image": base64_string,
            "metadata": metadata,
            "image_info": {
                "format": "PNG",
                "size": list(image.size),
                "mode": image.mode
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"DICOM conversion error: {str(e)}",
            "metadata": {}
        }

def convert_standard_image_to_png(image_data):
    """Convert standard image formats (PNG, JPEG, etc.) to standardized PNG"""
    try:
        # Open image from bytes
        image = Image.open(io.BytesIO(image_data))
        
        # Get original format
        original_format = image.format or "Unknown"
        
        metadata = {
            "format": original_format,
            "original_size": list(image.size),
            "original_mode": image.mode
        }
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if needed (maintain aspect ratio)
        if max(image.size) > 384:
            ratio = min(384 / image.width, 384 / image.height)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Save as PNG
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG', optimize=True, compress_level=6)
        img_buffer.seek(0)
        
        base64_string = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        
        return {
            "success": True,
            "base64_image": base64_string,
            "metadata": metadata,
            "image_info": {
                "format": "PNG",
                "size": list(image.size),
                "mode": image.mode
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Image conversion error: {str(e)}",
            "metadata": {}
        }

def convert_to_png(image_data):
    """Universal converter - handles both DICOM and standard image formats"""
    try:
        # Check if DICOM
        if is_dicom_data(image_data):
            return convert_dicom_to_png(image_data)
        else:
            return convert_standard_image_to_png(image_data)
            
    except Exception as e:
        return {
            "success": False,
            "error": f"Conversion failed: {str(e)}",
            "metadata": {}
        }

def main():
    """Main function to handle command line conversion"""
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python universal-image-converter.py <image_file_path>"
        }))
        sys.exit(1)
    
    try:
        # Get image file path from command line
        image_file_path = sys.argv[1]
        
        # Read image file
        with open(image_file_path, 'rb') as f:
            image_data = f.read()
        
        # Convert to PNG
        result = convert_to_png(image_data)
        
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
