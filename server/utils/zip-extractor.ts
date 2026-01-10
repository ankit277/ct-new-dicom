import AdmZip from 'adm-zip';

export interface ExtractedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface ZipExtractionResult {
  success: boolean;
  files: ExtractedFile[];
  error?: string;
}

export function extractDicomFromZip(zipBuffer: Buffer, zipFileName: string): ZipExtractionResult {
  try {
    console.log(`📦 Extracting medical images from ZIP: ${zipFileName}`);
    
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    const extractedFiles: ExtractedFile[] = [];
    const processedFolders = new Set<string>();
    
    for (const entry of zipEntries) {
      // Skip directory entries themselves (but process files within them)
      if (entry.isDirectory) {
        continue;
      }
      
      const fullPath = entry.entryName;
      const fileName = fullPath.split('/').pop() || fullPath;
      
      // Skip hidden files and macOS metadata
      if (fileName.startsWith('.') || fullPath.includes('__MACOSX') || fileName.startsWith('._')) {
        continue;
      }
      
      // Track which folders we're processing from
      const folderPath = fullPath.includes('/') ? fullPath.substring(0, fullPath.lastIndexOf('/')) : 'root';
      if (!processedFolders.has(folderPath)) {
        processedFolders.add(folderPath);
        console.log(`📁 Processing files from: ${folderPath}`);
      }
      
      // Extract file
      const fileBuffer = entry.getData();
      
      // Determine mimetype based on extension or content
      let mimetype = 'application/octet-stream';
      const lowerName = fileName.toLowerCase();
      
      // Check for DICOM files
      if (lowerName.endsWith('.dcm') || lowerName.endsWith('.dicom') || lowerName.endsWith('.dic')) {
        mimetype = 'application/dicom';
      } 
      // Check for JPEG files
      else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        mimetype = 'image/jpeg';
      } 
      // Check for PNG files
      else if (lowerName.endsWith('.png')) {
        mimetype = 'image/png';
      }
      // Check for DICOM signature if no extension or unrecognized extension
      else if (fileBuffer.length > 132 && fileBuffer.toString('ascii', 128, 132) === 'DICM') {
        mimetype = 'application/dicom';
        console.log(`🔍 Detected DICOM file without extension: ${fileName}`);
      }
      // Skip non-medical image files
      else {
        console.log(`⏭️  Skipping non-medical file: ${fileName}`);
        continue;
      }
      
      extractedFiles.push({
        buffer: fileBuffer,
        originalname: fileName,
        mimetype
      });
    }
    
    console.log(`✅ Extracted ${extractedFiles.length} medical image files from ${processedFolders.size} folder(s)`);
    if (processedFolders.size > 1) {
      console.log(`📂 Processed folders: ${Array.from(processedFolders).join(', ')}`);
    }
    
    return {
      success: true,
      files: extractedFiles
    };
  } catch (error) {
    console.error('❌ ZIP extraction failed:', error);
    return {
      success: false,
      files: [],
      error: error instanceof Error ? error.message : 'Unknown error during ZIP extraction'
    };
  }
}
