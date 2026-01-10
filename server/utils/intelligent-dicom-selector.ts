import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface IntelligentSelectionResult {
  success: boolean;
  selectedIndices: number[];
  totalSlices: number;
  selectedCount: number;
  error?: string;
}

/**
 * Use intelligent DICOM slice selection based on Hounsfield Units and pathology-aware sampling
 * @param dicomBuffers - Array of base64-encoded DICOM data
 * @param targetCount - Target number of slices to select (default 200)
 * @returns Selected slice indices
 */
export async function selectIntelligentSlices(
  dicomBuffers: string[],
  targetCount: number = 200
): Promise<IntelligentSelectionResult> {
  return new Promise((resolve) => {
    try {
      const pythonScript = path.join(__dirname, 'intelligent-slice-selector.py');
      
      // Prepare input data
      const inputData = JSON.stringify({
        dicomBuffers,
        targetCount
      });
      
      // Use spawn to pipe data via stdin (avoids command-line argument length limits)
      const { spawn } = require('child_process');
      const pythonProcess = spawn('python3', [pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 500 * 1024 * 1024 // 500MB buffer for 400+ slice studies
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      // Set timeout and store reference for clearing
      // For 400+ slices, allow up to 5 minutes for intelligent selection
      const timeoutMs = dicomBuffers.length > 400 ? 300000 : (dicomBuffers.length > 200 ? 180000 : 120000);
      const timeoutId = setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          selectedIndices: Array.from({ length: dicomBuffers.length }, (_, i) => i),
          totalSlices: dicomBuffers.length,
          selectedCount: dicomBuffers.length,
          error: `Timeout after ${timeoutMs / 1000} seconds`
        });
      }, timeoutMs);
      
      pythonProcess.on('close', (code: number) => {
        clearTimeout(timeoutId); // Clear timeout when process exits
        
        if (stderr) {
          console.warn('⚠️  Python stderr:', stderr);
        }
        
        if (code !== 0) {
          console.error(`❌ Python process exited with code ${code}`);
          // Fallback: return all indices
          resolve({
            success: false,
            selectedIndices: Array.from({ length: dicomBuffers.length }, (_, i) => i),
            totalSlices: dicomBuffers.length,
            selectedCount: dicomBuffers.length,
            error: `Python process exited with code ${code}: ${stderr}`
          });
          return;
        }
        
        try {
          const result: IntelligentSelectionResult = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError: any) {
          console.error('❌ Failed to parse Python output:', parseError.message);
          resolve({
            success: false,
            selectedIndices: Array.from({ length: dicomBuffers.length }, (_, i) => i),
            totalSlices: dicomBuffers.length,
            selectedCount: dicomBuffers.length,
            error: `Parse error: ${parseError.message}`
          });
        }
      });
      
      pythonProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId); // Clear timeout on error
        console.error('❌ Failed to start Python process:', error.message);
        resolve({
          success: false,
          selectedIndices: Array.from({ length: dicomBuffers.length }, (_, i) => i),
          totalSlices: dicomBuffers.length,
          selectedCount: dicomBuffers.length,
          error: error.message
        });
      });
      
      // Write input data to stdin
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();
      
    } catch (error: any) {
      console.error('❌ Intelligent slice selection failed:', error.message);
      resolve({
        success: false,
        selectedIndices: Array.from({ length: dicomBuffers.length }, (_, i) => i),
        totalSlices: dicomBuffers.length,
        selectedCount: dicomBuffers.length,
        error: error.message
      });
    }
  });
}
