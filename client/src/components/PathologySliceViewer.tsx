import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Scan, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import type { PathologySlice, PathologyRegion } from '@shared/schema';

interface PathologySliceViewerProps {
  pathologySlices: PathologySlice[];
  className?: string;
  initialSliceIndex?: number;
  onSliceChange?: (index: number) => void;
}

// Tailwind CSS classes for badges
const pathologyColors: Record<string, string> = {
  'COPD': 'bg-amber-500',
  'ILD': 'bg-blue-500',
  'Pulmonary Embolism': 'bg-red-600',
  'Pneumonia': 'bg-orange-500',
  'Tuberculosis': 'bg-purple-500',
  'Pleural Effusion': 'bg-cyan-500',
  'Pneumothorax': 'bg-rose-600',
  'Mass/Nodule': 'bg-red-700',
};

// Hex colors for overlay rendering (with transparency)
const pathologyOverlayColors: Record<string, { border: string; fill: string; text: string }> = {
  'COPD': { border: '#f59e0b', fill: 'rgba(245, 158, 11, 0.25)', text: '#f59e0b' },
  'ILD': { border: '#3b82f6', fill: 'rgba(59, 130, 246, 0.25)', text: '#3b82f6' },
  'Pulmonary Embolism': { border: '#dc2626', fill: 'rgba(220, 38, 38, 0.25)', text: '#dc2626' },
  'Pneumonia': { border: '#f97316', fill: 'rgba(249, 115, 22, 0.25)', text: '#f97316' },
  'Tuberculosis': { border: '#a855f7', fill: 'rgba(168, 85, 247, 0.25)', text: '#a855f7' },
  'Pleural Effusion': { border: '#06b6d4', fill: 'rgba(6, 182, 212, 0.25)', text: '#06b6d4' },
  'Pneumothorax': { border: '#e11d48', fill: 'rgba(225, 29, 72, 0.25)', text: '#e11d48' },
  'Mass/Nodule': { border: '#b91c1c', fill: 'rgba(185, 28, 28, 0.30)', text: '#b91c1c' },
};

export function PathologySliceViewer({ pathologySlices, className, initialSliceIndex, onSliceChange }: PathologySliceViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialSliceIndex ?? 0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Sync with external initialSliceIndex changes - clamp to valid range
  useEffect(() => {
    if (initialSliceIndex !== undefined && initialSliceIndex !== currentIndex) {
      const clampedIndex = Math.max(0, Math.min(initialSliceIndex, pathologySlices.length - 1));
      setCurrentIndex(clampedIndex);
      setZoomLevel(1);
    }
  }, [initialSliceIndex, pathologySlices.length]);
  
  // Notify parent of slice changes
  const updateIndex = (newIndex: number) => {
    setCurrentIndex(newIndex);
    onSliceChange?.(newIndex);
  };
  
  if (!pathologySlices || pathologySlices.length === 0) {
    return null;
  }
  
  // Defensive bounds check - fallback to slice 0 if index is out of range
  const safeIndex = Math.min(currentIndex, pathologySlices.length - 1);
  const currentSlice = pathologySlices[safeIndex];
  
  if (!currentSlice) {
    return null; // Additional safety check
  }
  
  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : pathologySlices.length - 1;
    updateIndex(newIndex);
    setZoomLevel(1);
  };
  
  const handleNext = () => {
    const newIndex = currentIndex < pathologySlices.length - 1 ? currentIndex + 1 : 0;
    updateIndex(newIndex);
    setZoomLevel(1);
  };
  
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };
  
  const getImageSrc = (imageData: string) => {
    if (imageData.startsWith('data:')) {
      return imageData;
    }
    return `data:image/png;base64,${imageData}`;
  };

  // Update image dimensions when image loads
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Render overlay regions on the CT slice
  const renderOverlayRegions = () => {
    if (!showOverlay || !currentSlice.regions || currentSlice.regions.length === 0) {
      return null;
    }

    return currentSlice.regions.map((region, index) => {
      const colors = pathologyOverlayColors[region.pathology] || { 
        border: '#888888', 
        fill: 'rgba(136, 136, 136, 0.25)', 
        text: '#888888' 
      };

      return (
        <div
          key={`${region.pathology}-${index}`}
          className="absolute pointer-events-none transition-opacity duration-200"
          style={{
            left: `${region.x * 100}%`,
            top: `${region.y * 100}%`,
            width: `${region.width * 100}%`,
            height: `${region.height * 100}%`,
            border: `2px solid ${colors.border}`,
            backgroundColor: colors.fill,
            borderRadius: '4px',
            boxShadow: `0 0 8px ${colors.border}40`,
          }}
          data-testid={`overlay-region-${region.pathology.toLowerCase().replace(/\s+/g, '-')}-${index}`}
        >
          {/* Label for the region */}
          <div
            className="absolute -top-6 left-0 px-1.5 py-0.5 text-xs font-semibold rounded whitespace-nowrap"
            style={{
              backgroundColor: colors.border,
              color: 'white',
              fontSize: '10px',
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {region.label || region.pathology}
          </div>
        </div>
      );
    });
  };
  
  return (
    <Card className={`medical-card ${className || ''}`} data-testid="pathology-slice-viewer">
      <CardHeader className="pb-3">
        <CardTitle className="text-medical-title flex items-center gap-2">
          <Scan className="h-5 w-5" />
          CT Slices Visualization
          <Badge variant="secondary" className="ml-2">
            {pathologySlices.length} slice{pathologySlices.length !== 1 ? 's' : ''} with high-confidence pathology
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  Slice {currentIndex + 1} of {pathologySlices.length}
                </span>
                <span className="text-xs text-gray-400">
                  (Original position: {currentSlice.sliceIndex + 1})
                </span>
              </div>
              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded" data-testid="text-slice-filename">
                {currentSlice.filename || `CT_Slice_${String(currentSlice.sliceIndex + 1).padStart(4, '0')}.dcm`}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600">
                Confidence: {currentSlice.confidence}%
              </span>
              
              {/* Overlay toggle */}
              {currentSlice.regions && currentSlice.regions.length > 0 && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showOverlay}
                    onCheckedChange={setShowOverlay}
                    data-testid="switch-toggle-overlay"
                  />
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    {showOverlay ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    Highlight pathology
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {currentSlice.detectedPathologies.map((pathology) => (
              <Badge
                key={pathology}
                className={`${pathologyColors[pathology] || 'bg-gray-500'} text-white flex items-center gap-1`}
                data-testid={`badge-pathology-${pathology.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <AlertTriangle className="h-3 w-3" />
                {pathology}
              </Badge>
            ))}
          </div>
          
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
            <div 
              ref={imageContainerRef}
              className="flex items-center justify-center p-4 overflow-auto"
              style={{ maxHeight: '500px' }}
            >
              {/* Image wrapper with overlay regions */}
              <div 
                className="relative"
                style={{ 
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease'
                }}
              >
                <img
                  ref={imageRef}
                  src={getImageSrc(currentSlice.imageData)}
                  alt={`CT Slice ${currentSlice.sliceIndex + 1} - ${currentSlice.detectedPathologies.join(', ')}`}
                  className="max-w-full block"
                  onLoad={handleImageLoad}
                  data-testid="img-pathology-slice"
                />
                
                {/* Overlay container - positioned over the image */}
                <div 
                  className="absolute inset-0"
                  style={{ pointerEvents: 'none' }}
                >
                  {renderOverlayRegions()}
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-3 right-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="h-8 w-8 p-0 bg-white/80 hover:bg-white"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="h-8 w-8 p-0 bg-white/80 hover:bg-white"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={pathologySlices.length <= 1}
              data-testid="button-previous-slice"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex gap-1">
              {pathologySlices.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    updateIndex(idx);
                    setZoomLevel(1);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  data-testid={`button-slice-indicator-${idx}`}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={pathologySlices.length <= 1}
              data-testid="button-next-slice"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Findings in this slice:</h4>
            <p className="text-sm text-gray-600" data-testid="text-slice-findings">
              {currentSlice.findings}
            </p>
          </div>
          
          {/* Color legend for pathology regions */}
          {currentSlice.regions && currentSlice.regions.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Pathology Highlighting Legend
              </h4>
              <div className="flex flex-wrap gap-3">
                {Array.from(new Set(currentSlice.regions.map(r => r.pathology))).map((pathology) => {
                  const colors = pathologyOverlayColors[pathology] || { border: '#888888' };
                  return (
                    <div 
                      key={pathology}
                      className="flex items-center gap-1.5 text-xs"
                      data-testid={`legend-item-${pathology.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div 
                        className="w-4 h-4 rounded border-2"
                        style={{ 
                          borderColor: colors.border,
                          backgroundColor: `${colors.border}40`
                        }}
                      />
                      <span className="text-gray-600">{pathology}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Colored boxes indicate approximate anatomical regions where pathology was detected. 
                Use the toggle above to show/hide highlighting.
              </p>
            </div>
          )}

          <div className="text-xs text-gray-400 mt-2">
            <p>These CT slices show confirmed high-confidence pathology findings. The filename corresponds to the original uploaded CT slice.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
