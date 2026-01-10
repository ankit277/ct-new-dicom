import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

export interface ImageConversionResult {
  success: boolean;
  base64_image?: string;
  metadata?: {
    format: string;
    [key: string]: any;
  };
  image_info?: {
    format: string;
    size: [number, number];
    mode: string;
  };
  error?: string;
}

/**
 * Universal image converter - handles both DICOM and standard formats (PNG, JPEG, etc.)
 * Ensures all outputs are standardized PNG format for OpenAI compatibility
 */
export async function convertImageToPng(imageBuffer: Buffer): Promise<ImageConversionResult> {
  let tempFilePath: string | null = null;
  
  try {
    console.log('🔄 Converting image to PNG format...');
    
    // Create temporary file for image data
    const tempDir = os.tmpdir();
    const tempFileName = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.tmp`;
    tempFilePath = path.join(tempDir, tempFileName);
    
    // Write image buffer to temporary file
    await fs.writeFile(tempFilePath, imageBuffer);
    
    // Path to the Python converter script
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let scriptPath = path.join(currentDir, 'universal-image-converter.py');
    
    // Check if script exists, if not try alternative paths
    try {
      await fs.access(scriptPath);
    } catch {
      const serverDir = path.join(process.cwd(), 'server', 'utils');
      const altPath = path.join(serverDir, 'universal-image-converter.py');
      
      try {
        await fs.access(altPath);
        scriptPath = altPath;
      } catch {
        const rootPath = path.join(process.cwd(), 'server', 'utils', 'universal-image-converter.py');
        scriptPath = rootPath;
      }
    }
    
    // Execute Python script with file path
    const command = `python3 "${scriptPath}" "${tempFilePath}"`;
    
    console.log('🐍 Executing universal image converter...');
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (stderr) {
      console.warn('⚠️ Python converter warning:', stderr);
    }
    
    // Parse JSON result from Python script
    const result: ImageConversionResult = JSON.parse(stdout.trim());
    
    if (result.success) {
      // Validate base64 image is not empty or corrupt
      if (!result.base64_image || result.base64_image.length < 100) {
        console.error('❌ Image conversion produced empty/corrupt image');
        return {
          success: false,
          error: 'Image conversion produced empty or corrupt image data',
          metadata: result.metadata
        };
      }
      
      // Check if base64 is all zeros (corrupt)
      const firstChars = result.base64_image.substring(0, 50);
      if (firstChars.match(/^A+$/)) {
        console.error('❌ Image conversion produced all-zero image (corrupt pixel data)');
        return {
          success: false,
          error: 'Image file has no valid pixel data or is corrupted',
          metadata: result.metadata
        };
      }
      
      console.log('✅ Image conversion successful:', {
        originalFormat: result.metadata?.format,
        outputFormat: result.image_info?.format,
        dimensions: result.image_info?.size,
        base64Length: result.base64_image.length
      });
    } else {
      console.error('❌ Image conversion failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('💥 Image conversion error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return {
          success: false,
          error: 'Image conversion timed out. The file may be too large or corrupted.'
        };
      } else if (error.message.includes('ENOENT')) {
        return {
          success: false,
          error: 'Python or required packages not found. Please ensure Python, pydicom, and Pillow are installed.'
        };
      }
    }
    
    return {
      success: false,
      error: `Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log('🧹 Cleaned up temporary image file');
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up temporary file:', cleanupError);
      }
    }
  }
}

export function isDicomFile(filename: string, mimetype: string): boolean {
  const name = filename.toLowerCase();
  return (
    mimetype === 'application/dicom' ||
    mimetype === 'application/octet-stream' ||
    name.endsWith('.dcm') ||
    name.endsWith('.dicom')
  );
}
