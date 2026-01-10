import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, FileImage, AlertCircle, X, Plus } from "lucide-react";
import JSZip from "jszip";

interface MultiFileUploadProps {
  onFilesSelect: (files: File[]) => void;
  maxSize?: number; // in MB per file
  maxFiles?: number; // maximum number of files
  acceptedTypes?: string[];
  className?: string;
}

export function MultiFileUpload({
  onFilesSelect,
  maxSize = 750,
  maxFiles = 1500,
  acceptedTypes = [".dcm", ".dicom", ".dic", ".jpg", ".jpeg", ".png", ".zip"],
  className,
}: MultiFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Session-wide counter using ref to avoid React state batching issues
  // This ensures unique filenames even when multiple ZIPs are extracted in the same event
  const globalFileCounterRef = useRef(0);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File ${file.name} exceeds ${maxSize}MB limit`;
    }

    // Check file type
    const hasExtension = file.name.includes(".");
    const fileExtension = hasExtension ? "." + file.name.split(".").pop()?.toLowerCase() : "";
    const mimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png", 
      "application/dicom",
      "application/octet-stream",
      "application/zip"
    ];
    
    // If file has no extension, assume it's a DICOM file (common in medical systems)
    if (!hasExtension && (file.type === "application/octet-stream" || file.type === "application/dicom" || file.type === "")) {
      return null; // Allow files without extensions (assumed DICOM)
    }
    
    if (!acceptedTypes.includes(fileExtension) && !mimeTypes.includes(file.type)) {
      return `Invalid file type for ${file.name}. Supported formats: ${acceptedTypes.join(", ")}`;
    }

    return null;
  };

  // Calculate pixel variance for an image file with proper memory cleanup
  const calculateImageVariance = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        // Resize for faster processing
        const maxDim = 100;
        const scale = Math.min(maxDim / img.width, maxDim / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        
        // CRITICAL: Clean up object URL to prevent memory leaks
        URL.revokeObjectURL(objectUrl);
        
        if (!imageData) {
          resolve(0);
          return;
        }
        
        // Calculate grayscale variance
        const pixels = imageData.data;
        let sum = 0;
        let count = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          sum += gray;
          count++;
        }
        
        const mean = sum / count;
        let varianceSum = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          varianceSum += Math.pow(gray - mean, 2);
        }
        
        const variance = varianceSum / count;
        resolve(variance);
      };
      
      img.onerror = () => {
        // Clean up object URL even on error
        URL.revokeObjectURL(objectUrl);
        resolve(0);
      };
      
      img.src = objectUrl;
    });
  };

  // Extract files from ZIP archive with guaranteed unique filenames across all uploads
  const extractZipFiles = useCallback(async (zipFile: File): Promise<File[]> => {
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const extractedFiles: File[] = [];
      const startCounter = globalFileCounterRef.current;
      
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        // Skip directories and hidden files
        if (zipEntry.dir || filename.startsWith('__MACOSX') || filename.includes('/.')) {
          continue;
        }
        
        // Extract file as blob
        const blob = await zipEntry.async('blob');
        
        // Generate guaranteed unique filename using session-wide counter (ref-based, not state)
        // This ensures no collisions even when multiple ZIPs are extracted in the same React event
        const basename = filename.split('/').pop() || filename;
        const ext = basename.includes('.') ? '.' + basename.split('.').pop() : '';
        const nameWithoutExt = basename.slice(0, basename.length - ext.length);
        const uniqueFilename = `${nameWithoutExt}_${String(globalFileCounterRef.current).padStart(6, '0')}${ext}`;
        
        // Convert to File object with guaranteed unique filename
        const file = new File([blob], uniqueFilename, {
          type: blob.type || 'application/octet-stream'
        });
        
        extractedFiles.push(file);
        globalFileCounterRef.current++; // Ref updates immediately, no state batching
      }
      
      console.log(`📦 Extracted ${extractedFiles.length} files from ZIP: ${zipFile.name} (counter: ${startCounter}-${globalFileCounterRef.current-1})`);
      return extractedFiles;
    } catch (error) {
      console.error('ZIP extraction failed:', error);
      throw new Error(`Failed to extract ZIP file: ${zipFile.name}`);
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    let fileArray = Array.from(files);
    
    // Check if any files are ZIP archives and extract them
    const processedFiles: File[] = [];
    for (const file of fileArray) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          setInfoMessage(`Extracting ZIP file: ${file.name}...`);
          const extractedFiles = await extractZipFiles(file);
          processedFiles.push(...extractedFiles);
          setInfoMessage(`✅ Extracted ${extractedFiles.length} files from ${file.name}`);
        } catch (error) {
          setError(`Failed to extract ZIP: ${file.name}`);
          return;
        }
      } else {
        processedFiles.push(file);
      }
    }
    
    fileArray = processedFiles;
    const newFiles = [...selectedFiles];
    const errors: string[] = [];

    // HYBRID INTELLIGENT SELECTION: If >400 files, select high-variance + uniform spacing
    const MAX_SLICES = 400;
    const HIGH_VARIANCE_COUNT = 250; // Top 250 high-variance slices (62.5%)
    const UNIFORM_COUNT = 150; // 150 uniformly spaced slices (37.5%)
    let selectionMessage: string | null = null;
    
    if (fileArray.length > 400) {
      try {
        // Show initial message
        setInfoMessage(`📊 Analyzing ${fileArray.length} slices for intelligent selection...`);
        
        // Calculate variance in chunks to avoid memory exhaustion (process 50 files at a time)
        const CHUNK_SIZE = 50;
        const fileVariances: Array<{ file: File; index: number; variance: number }> = [];
        
        for (let i = 0; i < fileArray.length; i += CHUNK_SIZE) {
          const chunk = fileArray.slice(i, Math.min(i + CHUNK_SIZE, fileArray.length));
          const chunkPromises = chunk.map(async (file, chunkIndex) => ({
            file,
            index: i + chunkIndex,
            variance: await calculateImageVariance(file)
          }));
          
          const chunkResults = await Promise.all(chunkPromises);
          fileVariances.push(...chunkResults);
          
          // Show progress message to user
          const analyzed = Math.min(i + CHUNK_SIZE, fileArray.length);
          const percentage = Math.round((analyzed / fileArray.length) * 100);
          setInfoMessage(`📊 Analyzing slices: ${analyzed}/${fileArray.length} (${percentage}%) - Identifying high-variance regions...`);
          console.log(`📊 Analyzed ${analyzed}/${fileArray.length} files`);
        }
        
        // Show selection in progress
        setInfoMessage(`✅ Analysis complete! Selecting optimal 400 slices from ${fileArray.length} total...`);
        
        // Sort by variance (highest first)
        fileVariances.sort((a, b) => b.variance - a.variance);
        
        // Select top 250 high-variance slices
        const highVarianceSlices = fileVariances.slice(0, HIGH_VARIANCE_COUNT);
        const highVarianceIndices = new Set(highVarianceSlices.map(f => f.index));
        
        // Get remaining files for uniform sampling
        const remainingFiles = fileVariances.filter(f => !highVarianceIndices.has(f.index));
        
        // CRITICAL: Sort remaining files by original index for true uniform anatomical coverage
        remainingFiles.sort((a, b) => a.index - b.index);
        
        // Select 150 uniformly spaced from remaining (now properly ordered by anatomy)
        const uniformIndices: number[] = [];
        if (remainingFiles.length > 0) {
          const interval = remainingFiles.length / UNIFORM_COUNT;
          for (let i = 0; i < UNIFORM_COUNT && i * interval < remainingFiles.length; i++) {
            uniformIndices.push(remainingFiles[Math.floor(i * interval)].index);
          }
        }
        
        // Combine and sort by original index to maintain anatomical order
        const selectedIndices = [...Array.from(highVarianceIndices), ...uniformIndices].sort((a, b) => a - b);
        
        const originalCount = fileArray.length;
        fileArray = selectedIndices.map(i => fileArray[i]);
        
        selectionMessage = `✅ Ready to upload! Selected ${highVarianceSlices.length} high-variance slices (likely pathology) + ${uniformIndices.length} uniformly-spaced slices from ${originalCount} total for comprehensive analysis.`;
      } catch (error) {
        console.error('Variance calculation failed, falling back to uniform selection:', error);
        setInfoMessage(`⚠️ Using uniform selection for ${fileArray.length} slices...`);
        // Fallback to uniform selection
        const interval = fileArray.length / MAX_SLICES;
        const selectedIndices = Array.from({ length: MAX_SLICES }, (_, i) => Math.floor(i * interval));
        const originalCount = fileArray.length;
        fileArray = selectedIndices.map(i => fileArray[i]);
        selectionMessage = `✅ Ready to upload! Selected ${MAX_SLICES} uniformly spaced CT slices from ${originalCount} total for analysis.`;
      }
    }

    // Check total file count limit
    if (newFiles.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You're trying to add ${fileArray.length} files to ${newFiles.length} existing files.`);
      return;
    }

    // Validate each file
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      // Check for duplicates
      if (newFiles.some(existing => existing.name === file.name && existing.size === file.size)) {
        continue; // Skip duplicate files
      }

      newFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors[0]); // Show first error
      setInfoMessage(null);
      return;
    }

    // Show selection message as info
    setError(null);
    setInfoMessage(selectionMessage);
    setSelectedFiles(newFiles);
    onFilesSelect(newFiles);
  }, [selectedFiles, onFilesSelect, maxSize, maxFiles, acceptedTypes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelect(newFiles);
    setError(null);
    setInfoMessage(null);
  }, [selectedFiles, onFilesSelect]);

  const clearAllFiles = useCallback(() => {
    setSelectedFiles([]);
    onFilesSelect([]);
    setError(null);
    setInfoMessage(null);
  }, [onFilesSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={className}>
      <Card 
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragOver ? "border-primary border-primary-400 bg-primary-50" : "border-gray-300 hover:border-primary-400",
          error && "border-red-300 bg-red-50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById("multi-file-input")?.click()}
      >
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="flex flex-col items-center space-y-2">
              <Upload className={cn("text-gray-400", isDragOver && "text-primary-500")} size={48} />
              <div>
                <p className="text-lg font-medium text-gray-700">
                  {selectedFiles.length === 0 
                    ? "Drop multiple CT scan images here or click to browse"
                    : `${selectedFiles.length} file(s) selected - Add more or click to replace`
                  }
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Supports DICOM, JPEG, PNG, and ZIP files (max {maxSize}MB per file, {maxFiles} files total)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Upload multiple slices of the same patient's CT scan for comprehensive analysis
                </p>
              </div>
            </div>
          </div>

          <input
            id="multi-file-input"
            type="file"
            multiple
            accept={acceptedTypes.join(",")}
            onChange={handleFileInput}
            className="hidden"
          />
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center space-x-2 text-red-600 text-sm mt-2 p-2 bg-red-50 rounded">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="flex items-center space-x-2 text-blue-600 text-sm mt-2 p-2 bg-blue-50 rounded border border-blue-200">
          <FileImage size={16} />
          <span>{infoMessage}</span>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">
              Selected Files ({selectedFiles.length}/{maxFiles})
            </h4>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAllFiles}
              className="text-xs"
            >
              Clear All
            </Button>
          </div>
          
          <div className="grid gap-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <FileImage className="text-blue-500 flex-shrink-0" size={20} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • Slice {index + 1}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <div className="text-blue-600 mt-0.5">
                <FileImage size={16} />
              </div>
              <div className="text-xs text-blue-800">
                <p className="font-medium">Multi-slice Analysis</p>
                <p>These {selectedFiles.length} images will be analyzed together as different slices of the same CT scan, providing more comprehensive diagnostic information.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}