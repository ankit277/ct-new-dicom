import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Upload, FileImage, AlertCircle } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
}

export function FileUpload({
  onFileSelect,
  maxSize = 750,
  acceptedTypes = [".dcm", ".dicom", ".dic", ".jpg", ".jpeg", ".png", ".zip"],
  className,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateFile = (file: File): string | null => {
    // ZIP files should use multi-file upload
    if (file.name.toLowerCase().endsWith('.zip')) {
      return `ZIP files should be uploaded using the "Multiple CT Slices" option for automatic extraction and batch processing.`;
    }
    
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize}MB limit`;
    }

    // Check file type
    const hasExtension = file.name.includes(".");
    const fileExtension = hasExtension ? "." + file.name.split(".").pop()?.toLowerCase() : "";
    const mimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png", 
      "application/dicom",
      "application/octet-stream"
    ];
    
    // If file has no extension, assume it's a DICOM file (common in medical systems)
    if (!hasExtension && (file.type === "application/octet-stream" || file.type === "application/dicom" || file.type === "")) {
      return null; // Allow files without extensions (assumed DICOM)
    }
    
    if (!acceptedTypes.includes(fileExtension) && !mimeTypes.includes(file.type)) {
      return `Invalid file type. Supported formats: ${acceptedTypes.join(", ")}`;
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
    onFileSelect(file);
  }, [onFileSelect, maxSize, acceptedTypes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

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
      handleFile(files[0]);
    }
  }, [handleFile]);

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
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
              error ? "bg-red-100" : "bg-primary-100"
            )}>
              {error ? (
                <AlertCircle className="text-red-500 text-2xl" size={32} />
              ) : selectedFile ? (
                <FileImage className="text-primary-500 text-2xl" size={32} />
              ) : (
                <Upload className="text-primary-500 text-2xl" size={32} />
              )}
            </div>
            
            <div>
              {selectedFile ? (
                <>
                  <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-900">Drop chest CT scan files here</p>
                  <p className="text-sm text-gray-600">or click to browse</p>
                </>
              )}
            </div>
            
            {error ? (
              <div className="text-sm text-red-600 font-medium">
                {error}
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                Chest CT scans only: {acceptedTypes.join(", ")}
                <br />
                Lung window: 1000-1500 HU, Level: -600 to -700 HU
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <input
        id="file-input"
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={handleFileInput}
        className="hidden"
      />

      {!error && selectedFile && (
        <Card className="mt-4 p-4 bg-blue-50 border border-blue-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="text-primary-500 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-medium text-primary-900">Automatic Validation</p>
              <p className="text-primary-700">
                DecXpert CT automatically validates chest CT scans and ensures proper lung window settings for optimal analysis.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
