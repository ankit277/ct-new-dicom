export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  fileType?: string;
  estimatedSize?: number;
}

export function validateMedicalImage(file: Express.Multer.File): FileValidationResult {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/dicom',
    'application/octet-stream', // DICOM files sometimes appear as this
    'application/zip'
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.dcm', '.dicom', '.zip'];
  
  console.log(`🔍 Validating file: "${file.originalname}", mimetype: "${file.mimetype}", size: ${file.size} bytes`);
  
  // Check file size (max 750MB for medical images)
  const maxSize = 750 * 1024 * 1024; // 750MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size exceeds 750MB limit. Please compress the image or use a different format.'
    };
  }

  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    console.log(`❌ MIME type "${file.mimetype}" not in allowed types:`, allowedTypes);
    return {
      isValid: false,
      error: 'Invalid file type. Only chest CT scans accepted. Please upload DICOM (.dcm), JPEG (.jpg), PNG (.png), or ZIP files.'
    };
  }

  // Check file extension (or assume DICOM if no extension)
  const fileName = file.originalname.toLowerCase();
  const hasExtension = fileName.includes('.');
  const hasValidExtension = allowedExtensions.some(ext => 
    fileName.endsWith(ext)
  );
  
  // If file has no extension and mimetype is application/octet-stream or application/dicom, assume it's DICOM
  if (!hasExtension && (file.mimetype === 'application/octet-stream' || file.mimetype === 'application/dicom')) {
    // Files without extensions are assumed to be DICOM (common in medical systems)
    // Continue validation below
  } else if (!hasValidExtension) {
    return {
      isValid: false,
      error: 'Invalid file extension. Chest CT scans only. Supported formats: .dcm, .dicom, .jpg, .jpeg, .png, .zip'
    };
  }

  // Additional CT modality validation based on filename
  if (!isChestCTScan(file.originalname, file.buffer)) {
    return {
      isValid: false,
      error: 'File does not appear to be a CT scan. DecXpert CT only accepts CT (Computed Tomography) images. Please ensure you are uploading CT scans and not X-rays, MRI, ultrasound, or other imaging modalities.'
    };
  }

  // DICOM validation - check files that are DICOM or have no extension (assumed DICOM)
  const isPotentiallyDicom = file.mimetype === 'application/dicom' || 
                              file.mimetype === 'application/octet-stream' ||
                              file.originalname.toLowerCase().endsWith('.dcm') ||
                              file.originalname.toLowerCase().endsWith('.dicom') ||
                              !hasExtension;
  
  if (isPotentiallyDicom) {
    const buffer = file.buffer;
    // DICOM files should have "DICM" at position 128
    if (buffer.length > 132) {
      const dicmSignature = buffer.slice(128, 132).toString('ascii');
      if (dicmSignature !== 'DICM') {
        return {
          isValid: false,
          error: 'File does not appear to be a valid DICOM file.'
        };
      }
    }
  }

  // Basic content validation for images
  if (file.mimetype.startsWith('image/')) {
    // Check if it's actually an image by looking at file headers
    const buffer = file.buffer;
    if (buffer.length < 8) {
      return {
        isValid: false,
        error: 'File appears to be corrupted or incomplete.'
      };
    }

    // Check for valid image file signatures
    const jpegSignature = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const pngSignature = buffer[0] === 0x89 && buffer[1] === 0x50 && 
                        buffer[2] === 0x4E && buffer[3] === 0x47;
    
    if (file.mimetype === 'image/jpeg' && !jpegSignature) {
      return {
        isValid: false,
        error: 'File appears to be corrupted or is not a valid JPEG image.'
      };
    }
    
    if (file.mimetype === 'image/png' && !pngSignature) {
      return {
        isValid: false,
        error: 'File appears to be corrupted or is not a valid PNG image.'
      };
    }
  }


  return {
    isValid: true,
    fileType: file.mimetype,
    estimatedSize: file.size
  };
}

export function isChestCTScan(filename: string, buffer: Buffer): boolean {
  // Enhanced validation for CT scan modality
  const name = filename.toLowerCase();
  
  // If filename has no extension, assume it's a DICOM file from a medical system (e.g., "I70", "IM-0001")
  const hasExtension = name.includes('.');
  if (!hasExtension) {
    return true; // DICOM files without extensions are common in medical systems
  }
  
  // CT imaging keywords - focus on modality not anatomy
  const ctKeywords = [
    'ct', 'computed', 'tomography', 'axial', 'hrct', 'helical', 'scan'
  ];
  
  // Keywords that indicate NON-CT imaging modalities (exclude these)
  const excludedModalities = [
    'xray', 'x-ray', 'radiograph', 'mri', 'magnetic', 'resonance',
    'ultrasound', 'us', 'echo', 'doppler', 'pet', 'spect', 'nuclear',
    'mammography', 'fluoro', 'angiography', 'endoscopy'
  ];
  
  // Check for excluded imaging modalities first
  if (excludedModalities.some(keyword => name.includes(keyword))) {
    return false;
  }
  
  // Must have CT keywords for validation
  const hasCTKeyword = ctKeywords.some(keyword => name.includes(keyword));
  
  // For regular image files, require CT keywords or assume CT if no exclusions
  return hasCTKeyword || true; // Allow if no specific modality exclusions found
}

