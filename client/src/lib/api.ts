import { apiRequest } from "./queryClient";

export interface PatientData {
  name: string;
  patientId: string;
  gender: string;
  dateOfBirth: string;
  examDate: string;
  clinicalHistory?: string;
  referringPhysician?: string;
}

export interface RadiologyReport {
  clinical_context: string;
  technique: string;
  findings: string; // Changed from array to single paragraph
  impression: string;
  recommendations: string;
  urgent_flags: string[];
}

// Bounding box region for pathology highlighting (normalized 0-1 coordinates)
export interface PathologyRegion {
  pathology: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  side?: 'left' | 'right' | 'bilateral' | 'central';
}

export interface PathologySlice {
  sliceIndex: number;
  batchIndex: number;
  imageData: string;
  detectedPathologies: string[];
  confidence: number;
  findings: string;
  regions?: PathologyRegion[];
}

export interface AnalysisResult {
  id: string;
  patientId: string;
  imageName: string;
  imageSize: number;
  analysisStatus: "pending" | "processing" | "completed" | "failed";
  findings?: any;
  primaryDiagnosis?: string;
  radiologicalImpression?: string; // Comprehensive radiological reading/impression
  differentialDiagnoses?: any[];
  quantitativeAnalysis?: any;
  confidence?: number;
  processingTime?: number;
  createdAt: string;
  reportGenerated?: string;
  message?: string; // Error or status messages
  // New radiology report format
  radiologyReport?: RadiologyReport;
  // Pathology visualization slices
  pathologySlices?: PathologySlice[];
  // OpenAI metadata for transparency and verification
  openaiMetadata?: {
    requestId: string;
    model: string;
    timestamp: string;
    parameters: {
      temperature: number;
      seed: number;
      max_completion_tokens: number;
    };
  };
}

export interface Analytics {
  totalAnalyses: number;
  copdDetected: number;
  ildDetected: number;
  avgAnalysisTime: number;
  accuracyRate: number;
}

export const api = {
  // Analytics
  getAnalytics: async (): Promise<Analytics> => {
    const response = await apiRequest("GET", "/api/analytics");
    return response.json();
  },

  // CT Analysis - Single file with progress tracking
  uploadCtScan: async (
    file: File, 
    patientData: PatientData,
    onProgress?: (progress: number) => void
  ): Promise<{ analysisId: string; patientId: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("ctScan", file);
      formData.append("patientData", JSON.stringify(patientData));

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (e) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Failed to upload CT scan'));
          } catch (e) {
            reject(new Error(`HTTP Error: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timed out'));
      };

      // Optimized timeout: 20 minutes for large uploads
      xhr.timeout = 1200000;

      xhr.open('POST', '/api/ct-analysis', true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
      xhr.send(formData);
    });
  },

  // Helper function to upload a single batch
  uploadBatch: async (
    batchFiles: File[],
    batchIndex: number,
    sessionId: string,
    totalBatches: number,
    patientData: PatientData,
    onBatchProgress?: (progress: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      batchFiles.forEach((file, index) => {
        formData.append(`ctScan_${index}`, file);
      });
      formData.append("batchIndex", batchIndex.toString());
      formData.append("sessionId", sessionId);
      formData.append("totalBatches", totalBatches.toString());
      formData.append("patientData", JSON.stringify(patientData));
      formData.append("fileCount", batchFiles.length.toString());

      if (onBatchProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onBatchProgress(percentComplete);
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Batch ${batchIndex} failed: HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error(`Batch ${batchIndex}: Network error`));
      xhr.ontimeout = () => reject(new Error(`Batch ${batchIndex}: Timeout`));
      xhr.timeout = 600000; // 10 minutes per batch (optimized from 15)

      xhr.open('POST', '/api/ct-analysis/batch', true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
      xhr.send(formData);
    });
  },

  // CT Analysis - Multiple files with batched concurrent uploads
  uploadMultipleCtScans: async (
    files: File[], 
    patientData: PatientData,
    onProgress?: (progress: number) => void
  ): Promise<{ analysisId: string; patientId: string }> => {
    const BATCH_SIZE = 5; // Optimized for Cloud Run 32MB limit - prevents HTTP 413 errors
    const MAX_CONCURRENT = 10; // Maximum parallel uploads for fastest throughput
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Split files into batches
    const batches: File[][] = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📦 Uploading ${files.length} files in ${batches.length} batches (max ${MAX_CONCURRENT} concurrent)`);
    
    // Track progress for each batch
    const batchProgress: number[] = new Array(batches.length).fill(0);
    
    const updateOverallProgress = () => {
      const totalProgress = batchProgress.reduce((sum, p) => sum + p, 0);
      const overallPercent = Math.round(totalProgress / batches.length);
      if (onProgress) onProgress(overallPercent);
    };
    
    // Upload batches with concurrency limit
    const uploadQueue: Promise<void>[] = [];
    let activeBatches = 0;
    let currentBatchIndex = 0;
    
    return new Promise((resolve, reject) => {
      const processNextBatch = () => {
        if (currentBatchIndex >= batches.length) {
          // All batches queued - wait for completion
          if (activeBatches === 0) {
            // Request finalization
            apiRequest("POST", "/api/ct-analysis/finalize", { sessionId, patientData })
              .then(response => response.json())
              .then(result => resolve(result))
              .catch(err => reject(err));
          }
          return;
        }
        
        const batchIndex = currentBatchIndex++;
        const batchFiles = batches[batchIndex];
        activeBatches++;
        
        api.uploadBatch(
          batchFiles,
          batchIndex,
          sessionId,
          batches.length,
          patientData,
          (progress) => {
            batchProgress[batchIndex] = progress;
            updateOverallProgress();
          }
        )
          .then(() => {
            activeBatches--;
            processNextBatch();
          })
          .catch(err => {
            reject(err);
          });
        
        // Start next batch if under concurrency limit
        if (activeBatches < MAX_CONCURRENT) {
          processNextBatch();
        }
      };
      
      // Kickstart concurrent uploads
      for (let i = 0; i < MAX_CONCURRENT && i < batches.length; i++) {
        processNextBatch();
      }
    });
  },

  // Get analysis results
  getAnalysis: async (analysisId: string): Promise<AnalysisResult> => {
    const response = await apiRequest("GET", `/api/ct-analysis/${analysisId}`);
    return response.json();
  },

  // Get patient analyses
  getPatientAnalyses: async (patientId: string): Promise<AnalysisResult[]> => {
    const response = await apiRequest("GET", `/api/patients/${patientId}/analyses`);
    return response.json();
  },

  // Download report
  downloadReport: async (analysisId: string): Promise<void> => {
    const response = await fetch(`/api/ct-analysis/${analysisId}/report`, {
      method: "GET",
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Failed to download report");
    }
    
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DecXpert_CT_Report_${analysisId.substring(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
