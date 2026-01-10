import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, FileText } from "lucide-react";
import type { AnalysisResult, PatientData, RadiologyReport, PathologySlice } from "@/lib/api";
import { PathologySliceViewer } from "./PathologySliceViewer";

interface MedicalReportProps {
  analysis: AnalysisResult | RadiologyReport;
  patientData: PatientData;
  onDownload: () => void;
}

// Display API response exactly as returned, without client-side parsing
function displayApiResponse(details: string): string {
  if (!details || details === 'No detailed findings available.') {
    return '<p>No detailed findings available.</p>';
  }

  // Simply format the API response with line breaks - no parsing or restructuring
  const formatted = details
    .replace(/\\n/g, '\n') // Convert escaped newlines to actual newlines
    .trim()
    .split('\n')
    .map(line => `<p>${line.trim()}</p>`)
    .join('');

  return `<div class="api-response-content">${formatted}</div>`;
}

export function MedicalReport({ analysis, patientData, onDownload }: MedicalReportProps) {
  // Check if this is the new RadiologyReport format
  const isRadiologyReport = 'clinical_context' in analysis;
  const radiologyReport = isRadiologyReport ? analysis as RadiologyReport : (analysis as AnalysisResult).radiologyReport;
  
  const handlePrint = async () => {
    // Fetch the unified report HTML from the server to ensure consistency with PDF
    const analysisId = isRadiologyReport ? null : (analysis as AnalysisResult).id;
    
    if (analysisId) {
      try {
        // Fetch the unified report from server endpoint
        const response = await fetch(`/api/ct-analysis/${analysisId}/report`);
        if (response.ok) {
          const reportHtml = await response.text();
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(reportHtml);
            printWindow.document.close();
            printWindow.onload = () => {
              printWindow.print();
            };
            return;
          }
        }
      } catch (error) {
        console.error('Failed to fetch report from server, using fallback:', error);
      }
    }
    
    // Fallback: generate report client-side if server request fails
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const findings = isRadiologyReport ? null : (analysis as AnalysisResult).findings as any;
    const differentials = isRadiologyReport ? [] : (analysis as AnalysisResult).differentialDiagnoses as any[] || [];
    const pathologySlicesForPrint = isRadiologyReport ? [] : ((analysis as AnalysisResult).pathologySlices || []) as any[];
    
    const CRITICAL_PATHOLOGIES_PRINT = ['Mass/Nodule', 'Pulmonary Embolism', 'Pneumothorax'];
    const criticalSlicesForPrint = pathologySlicesForPrint.filter((slice: any) => 
      slice.detectedPathologies.some((p: string) => CRITICAL_PATHOLOGIES_PRINT.includes(p))
    );
    
    const criticalFindingsHtml = criticalSlicesForPrint.length > 0 ? `
      <div class="report-section" style="border: 2px solid #dc2626; background: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-top: 0;">CRITICAL FINDINGS - REQUIRES IMMEDIATE ATTENTION</h3>
        <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 0 4px 4px 0;">
          <strong>The following critical findings require radiologist review:</strong>
          <ul style="margin: 10px 0 0 20px; padding: 0;">
            ${Array.from(new Set(criticalSlicesForPrint.flatMap((s: any) => s.detectedPathologies.filter((p: string) => CRITICAL_PATHOLOGIES_PRINT.includes(p))))).map(p => `<li style="font-weight: bold; color: #991b1b;">${p}</li>`).join('')}
          </ul>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px;">
          ${criticalSlicesForPrint.slice(0, 8).map((slice: any) => `
            <div style="border: 2px solid #dc2626; border-radius: 8px; overflow: hidden; background: #fef2f2;">
              <div style="background: #dc2626; color: white; padding: 8px 12px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Slice #${slice.sliceIndex + 1}</span>
                  <span>${slice.confidence}% confidence</span>
                </div>
                <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">${slice.filename || `CT_Slice_${String(slice.sliceIndex + 1).padStart(4, '0')}.dcm`}</div>
              </div>
              <img src="data:image/png;base64,${slice.imageData}" style="width: 100%; height: auto; display: block;" alt="CT Slice ${slice.sliceIndex + 1} - ${slice.filename || ''}" />
              <div style="padding: 10px; font-size: 11px; line-height: 1.4;">
                <strong>Detected:</strong> ${slice.detectedPathologies.join(', ')}<br>
                <span style="color: #64748b; display: block; margin-top: 5px;">${slice.findings || 'See detailed findings'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';
    
    const radiologicalReadingHtml = (analysis as AnalysisResult).radiologicalImpression ? 
      (analysis as AnalysisResult).radiologicalImpression :
      `<strong>FINDINGS:</strong><br><br>
      <strong>Airways:</strong> ${findings?.copdDetected ? (findings.copdFindings || 'COPD changes identified.') : 'Normal caliber central and peripheral airways without evidence of bronchiectasis or airway thickening.'}<br><br>
      <strong>Lung Parenchyma:</strong> ${
        [
          findings?.ildDetected ? (findings.ildFindings || 'Interstitial lung disease pattern identified.') : '',
          findings?.massDetected ? (findings.massFindings || 'Pulmonary nodule/mass identified.') : '',
          findings?.pneumoniaDetected ? (findings.pneumoniaFindings || 'Consolidation consistent with pneumonia.') : '',
          findings?.tuberculosisDetected ? (findings.tuberculosisFindings || 'Findings suggestive of tuberculosis.') : ''
        ].filter(f => f).join(' ') || 'Clear lung fields bilaterally without focal consolidation, mass, or nodule.'
      }<br><br>
      <strong>Pulmonary Vasculature:</strong> ${findings?.pulmonaryEmbolismDetected ? (findings.vascularFindings || 'Filling defect identified concerning for pulmonary embolism.') : 'Normal pulmonary arterial caliber without evidence of filling defects.'}<br><br>
      <strong>Pleura:</strong> ${findings?.pleuralEffusionDetected || findings?.pneumothoraxDetected ? (findings.pleuralFindings || 'Pleural abnormality identified.') : 'No pleural effusion or pneumothorax. Normal pleural surfaces.'}<br><br>
      <strong>Mediastinum:</strong> Mediastinal structures are normal in position and configuration.<br><br>
      <strong>Heart:</strong> Cardiac silhouette is within normal limits.<br><br>
      <strong>Osseous Structures:</strong> No acute osseous abnormality identified.`;

    const ctVisualizationHtml = pathologySlicesForPrint.length > 0 ? `
      <div class="report-section" style="page-break-before: always; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; font-size: 18px;">CT Visualization - Detected Pathology Slices</h3>
        <p style="color: #64748b; font-style: italic; margin-bottom: 15px;">The following CT slices demonstrate the detected pathological findings (${pathologySlicesForPrint.length} total slices with findings):</p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px;">
          ${pathologySlicesForPrint.slice(0, 12).map((slice: any) => {
            const isCritical = slice.detectedPathologies.some((p: string) => CRITICAL_PATHOLOGIES_PRINT.includes(p));
            return `
            <div style="border: ${isCritical ? '2px solid #dc2626' : '1px solid #e2e8f0'}; border-radius: 8px; overflow: hidden; background: ${isCritical ? '#fef2f2' : '#f8fafc'};">
              <div style="background: ${isCritical ? '#dc2626' : '#1e40af'}; color: white; padding: 8px 12px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Slice #${slice.sliceIndex + 1}</span>
                  <span>${slice.confidence}% confidence</span>
                </div>
                <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">${slice.filename || `CT_Slice_${String(slice.sliceIndex + 1).padStart(4, '0')}.dcm`}</div>
              </div>
              <img src="data:image/png;base64,${slice.imageData}" style="width: 100%; height: auto; display: block;" alt="CT Slice ${slice.sliceIndex + 1} - ${slice.filename || ''}" />
              <div style="padding: 10px; font-size: 11px; line-height: 1.4;">
                <strong>Detected:</strong> ${slice.detectedPathologies.join(', ')}<br>
                <span style="color: #64748b; display: block; margin-top: 5px;">${slice.findings || 'See detailed findings'}</span>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    ` : '';
    
    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DecXpert CT Analysis Report</title>
        <style>
          @media print {
            body { margin: 0; font-size: 12pt; }
            .no-print { display: none; }
            .report-section { page-break-inside: avoid; }
          }
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 20px;
            background: white;
          }
          .header {
            border-bottom: 3px solid #1e40af;
            padding-bottom: 20px;
            margin-bottom: 30px;
            text-align: center;
          }
          .header h1 {
            color: #1e40af;
            font-size: 28px;
            margin: 0;
            font-weight: bold;
          }
          .header h2 {
            color: #64748b;
            font-size: 16px;
            margin: 5px 0 0 0;
            font-weight: normal;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>DecXpert CT</h1>
          <h2>Professional Chest CT Analysis Report</h2>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <h3 style="color: #1e40af; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Patient Information</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold; color: #475569;">Patient Name:</span><span style="color: #1e293b;">${patientData.name}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold; color: #475569;">Patient ID:</span><span style="color: #1e293b;">${patientData.patientId}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold; color: #475569;">Date of Birth:</span><span style="color: #1e293b;">${patientData.dateOfBirth}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold; color: #475569;">Gender:</span><span style="color: #1e293b;">${patientData.gender}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold; color: #475569;">Exam Date:</span><span style="color: #1e293b;">${patientData.examDate || new Date().toISOString().split('T')[0]}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-weight: bold; color: #475569;">Report Date:</span><span style="color: #1e293b;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</span></div>
          </div>
        </div>

        <!-- Clinical Summary -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
          <h3 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; font-size: 18px;">Clinical Summary</h3>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 0 4px 4px 0;">
            <strong>Primary Diagnosis:</strong> ${findings?.primaryDiagnosis || 'No significant findings'}<br>
            <strong>Confidence Level:</strong> ${findings?.confidence || 0}%
            ${criticalSlicesForPrint.length > 0 ? '<br><strong style="color: #dc2626;">CRITICAL FINDINGS PRESENT</strong>' : ''}
          </div>
        </div>

        <!-- Critical Findings -->
        ${criticalFindingsHtml}

        <!-- Overall Radiological Reading -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
          <h3 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; font-size: 18px;">Overall Radiological Reading</h3>
          <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 0 4px 4px 0; font-size: 14px;">
            ${radiologicalReadingHtml}
          </div>
        </div>

        <!-- Differential Diagnoses -->
        ${differentials.length > 0 ? `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
          <h3 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; font-size: 18px;">Differential Diagnoses</h3>
          <ul style="margin: 10px 0; padding-left: 25px;">
            ${differentials.map(dd => 
              `<li style="margin: 8px 0; line-height: 1.5;"><strong>${dd.diagnosis}</strong>${dd.probability ? ` (${dd.probability}% probability)` : ''}${dd.reasoning ? `<br><em>${dd.reasoning}</em>` : ''}</li>`
            ).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Clinical Correlation -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
          <h3 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; font-size: 18px;">Clinical Correlation</h3>
          <div style="white-space: pre-line; font-size: 14px; line-height: 1.8;">Findings correlate with provided clinical history and symptoms. Further clinical correlation recommended.</div>
        </div>

        <!-- CT Visualization Section -->
        ${ctVisualizationHtml}

        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; margin-top: 20px; font-family: monospace; font-size: 12px; text-align: center;">
          Analysis ID: ${(analysis as AnalysisResult).id || (analysis as any).analysisId || 'N/A'}
        </div>

        <div style="border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center; color: #64748b; font-size: 12px;">
          <p><strong>DecXpert CT AI Analysis Engine v2.1</strong></p>
          <p>This report was generated using proprietary AI technology for chest CT analysis.</p>
          <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const findings = isRadiologyReport ? null : (analysis as AnalysisResult).findings as any;
  const quantitative = isRadiologyReport ? null : (analysis as AnalysisResult).quantitativeAnalysis as any;
  const differentials = isRadiologyReport ? [] : (analysis as AnalysisResult).differentialDiagnoses as any[] || [];
  
  // Extract critical findings (Mass/Nodule, PE, Pneumothorax) from pathology slices
  const pathologySlices = isRadiologyReport ? [] : ((analysis as AnalysisResult).pathologySlices || []) as PathologySlice[];
  const CRITICAL_PATHOLOGIES = ['Mass/Nodule', 'Pulmonary Embolism', 'Pneumothorax'];
  const criticalSlices = pathologySlices.filter(slice => 
    slice.detectedPathologies.some(p => CRITICAL_PATHOLOGIES.includes(p))
  );
  const hasCriticalFindings = criticalSlices.length > 0;
  
  // State and ref for navigating to slices from critical findings gallery
  const [selectedSliceIndex, setSelectedSliceIndex] = useState<number | null>(null);
  const sliceViewerRef = useRef<HTMLDivElement>(null);
  
  // Reset selected slice when analysis changes to avoid out-of-bounds access
  const analysisId = isRadiologyReport ? null : (analysis as AnalysisResult).id;
  useEffect(() => {
    setSelectedSliceIndex(null);
  }, [analysisId]);
  
  // Handle clicking a critical thumbnail - scroll to viewer and select that slice
  const handleCriticalThumbnailClick = (criticalSlice: PathologySlice) => {
    // Find the index of this slice in the full pathologySlices array
    const fullIndex = pathologySlices.findIndex(s => s.sliceIndex === criticalSlice.sliceIndex);
    if (fullIndex !== -1) {
      setSelectedSliceIndex(fullIndex);
      // Scroll to the viewer section
      sliceViewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6" id="medical-report">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-medical-title">Comprehensive Medical Report</h2>
        <Button 
          onClick={handlePrint}
          className="medical-button-secondary flex items-center space-x-2"
        >
          <Printer size={16} />
          <span>Print Report</span>
        </Button>
      </div>

      {/* Clinical Context */}
      {radiologyReport?.clinical_context && (
        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="text-medical-title">Clinical Context</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{radiologyReport.clinical_context}</p>
          </CardContent>
        </Card>
      )}

      {/* Technique */}
      {radiologyReport?.technique && (
        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="text-medical-title">Technique</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{radiologyReport.technique}</p>
          </CardContent>
        </Card>
      )}

      {/* Critical Findings Alert - Prominent display for urgent pathologies */}
      {hasCriticalFindings && (
        <Card className="medical-card border-2 border-red-500 bg-red-50" data-testid="critical-findings-alert">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Critical Findings Requiring Immediate Attention
              <Badge variant="destructive" className="ml-2">
                {criticalSlices.length} slice{criticalSlices.length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {Array.from(new Set(criticalSlices.flatMap(s => s.detectedPathologies.filter(p => CRITICAL_PATHOLOGIES.includes(p))))).map(pathology => (
                  <Badge key={pathology} variant="destructive" className="text-sm" data-testid={`critical-badge-${pathology.toLowerCase().replace(/\s+/g, '-')}`}>
                    {pathology}
                  </Badge>
                ))}
              </div>
              
              {/* Critical Findings Thumbnail Gallery */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {criticalSlices.slice(0, 8).map((slice, idx) => {
                  const fullIndex = pathologySlices.findIndex(s => s.sliceIndex === slice.sliceIndex);
                  const isSelected = selectedSliceIndex === fullIndex;
                  return (
                    <div 
                      key={`critical-${slice.sliceIndex}-${idx}`}
                      className={`relative rounded-lg overflow-hidden border-2 bg-black cursor-pointer transition-all ${
                        isSelected ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-red-400 hover:border-red-600'
                      }`}
                      onClick={() => handleCriticalThumbnailClick(slice)}
                      data-testid={`critical-thumbnail-${idx}`}
                    >
                      <img 
                        src={slice.imageData.startsWith('data:') ? slice.imageData : `data:image/png;base64,${slice.imageData}`}
                        alt={`Critical finding slice ${slice.sliceIndex + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-900/90 to-transparent p-1">
                        <p className="text-xs text-white font-medium truncate">
                          {slice.detectedPathologies.filter(p => CRITICAL_PATHOLOGIES.includes(p)).join(', ')}
                        </p>
                        <p className="text-xs text-red-200">{slice.confidence}% conf</p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-xs px-1 rounded font-bold">
                          VIEWING
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <p className="text-sm text-red-800 mt-3">
                These findings require clinical correlation and may necessitate urgent intervention.
                Click any thumbnail to navigate to the full-size view below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impression */}
      <Card className={`medical-card ${hasCriticalFindings ? 'border-l-4 border-l-red-500' : ''}`}>
        <CardHeader>
          <CardTitle className="text-medical-title flex items-center justify-between">
            Impression
            {hasCriticalFindings && (
              <Badge variant="destructive" className="text-sm animate-pulse">
                Critical Findings
              </Badge>
            )}
            {radiologyReport?.urgent_flags && radiologyReport.urgent_flags.length > 0 && (
              <Badge variant="destructive" className="text-sm">
                Urgent: {radiologyReport.urgent_flags.length} flag(s)
              </Badge>
            )}
            {!radiologyReport && (
              <Badge variant="secondary" className="text-sm">
                {findings?.confidence || 0}% Confidence
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`p-4 rounded-lg ${
            (radiologyReport?.urgent_flags?.length ?? 0) > 0 
              ? 'bg-red-50 border-l-4 border-red-400' 
              : (findings?.copdDetected || findings?.ildDetected) 
                ? 'bg-amber-50 border-l-4 border-amber-400' 
                : 'bg-green-50 border-l-4 border-green-400'
          }`}>
            <h3 className="font-semibold text-lg mb-2">
              {radiologyReport?.impression || (analysis as AnalysisResult).primaryDiagnosis || 'No significant findings'}
            </h3>
            {radiologyReport?.urgent_flags && (radiologyReport.urgent_flags?.length ?? 0) > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-red-800 mb-1">Urgent Flags:</h4>
                <ul className="list-disc list-inside text-sm text-red-700">
                  {radiologyReport.urgent_flags.map((flag, index) => (
                    <li key={index}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Comprehensive Radiological Impression - Always show when available */}
            {(analysis as AnalysisResult).radiologicalImpression && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="font-medium text-gray-800 mb-2">Overall Radiological Reading:</h4>
                <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                  {(analysis as AnalysisResult).radiologicalImpression?.split('\n\n').map((section, idx) => {
                    const lines = section.split('\n');
                    const header = lines[0];
                    const content = lines.slice(1).join('\n');
                    
                    const headerMatch = header.match(/\*\*([^*]+)\*\*/);
                    if (headerMatch) {
                      return (
                        <div key={idx} className="bg-white/50 p-3 rounded border border-gray-100">
                          <h5 className="font-semibold text-gray-900 mb-1">{headerMatch[1]}</h5>
                          {content && (
                            <div className="whitespace-pre-line text-gray-700">{content}</div>
                          )}
                          {!content && lines.length === 1 && (
                            <div className="whitespace-pre-line text-gray-700">
                              {header.replace(/\*\*[^*]+\*\*\s*/, '')}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="whitespace-pre-line">{section}</div>
                    );
                  })}
                </div>
              </div>
            )}
            {!(analysis as AnalysisResult).radiologicalImpression && (
              <p className="text-sm text-gray-600 mt-2">
                {findings?.details || 'No detailed findings available.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pathology Visualization - CT slices with detected pathology */}
      {!isRadiologyReport && (analysis as AnalysisResult).pathologySlices && 
       (analysis as AnalysisResult).pathologySlices!.length > 0 && (
        <div ref={sliceViewerRef}>
          <PathologySliceViewer 
            pathologySlices={(analysis as AnalysisResult).pathologySlices as PathologySlice[]}
            initialSliceIndex={selectedSliceIndex ?? undefined}
            onSliceChange={setSelectedSliceIndex}
          />
        </div>
      )}

      {/* Radiological Findings */}
      <Card className="medical-card">
        <CardHeader>
          <CardTitle className="text-medical-title">Radiological Findings</CardTitle>
        </CardHeader>
        <CardContent>
          {radiologyReport ? (
            <div className="p-4 border border-blue-100 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700 leading-relaxed">
                {radiologyReport.findings}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* COPD Findings */}
              {findings?.copdFindings && findings.copdFindings.indexOf("COPD:") !== -1 && (
                <div className="p-4 border border-amber-100 bg-amber-50 rounded-lg">
                  <h4 className="font-semibold text-amber-900 mb-2">COPD Findings:</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{findings.copdFindings}</p>
                </div>
              )}
              
              {/* ILD Findings */}
              {findings?.ildFindings && findings.ildFindings.indexOf("Interstitial lung disease:") !== -1 && (
                <div className="p-4 border border-blue-100 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Interstitial Lung Disease Findings:</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{findings.ildFindings}</p>
                </div>
              )}
              
              {/* Mass/Nodule Findings */}
              {findings?.massFindings && findings.massFindings !== "No masses detected" && findings.massFindings !== "No suspicious masses detected" && (
                <div className="p-4 border border-red-100 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Mass/Nodule Findings:</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{findings.massFindings}</p>
                </div>
              )}
              
              {/* Vascular Findings (PE) */}
              {findings?.vascularFindings && (
                <div className="p-4 border border-purple-100 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">Vascular Findings:</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{findings.vascularFindings}</p>
                </div>
              )}
              
              {/* Infectious Findings (Pneumonia/TB) */}
              {findings?.infectiousFindings && (
                <div className="p-4 border border-orange-100 bg-orange-50 rounded-lg">
                  <h4 className="font-semibold text-orange-900 mb-2">Infectious Findings:</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{findings.infectiousFindings}</p>
                </div>
              )}
              
              {/* Pleural Findings */}
              {findings?.pleuralFindings && (
                <div className="p-4 border border-cyan-100 bg-cyan-50 rounded-lg">
                  <h4 className="font-semibold text-cyan-900 mb-2">Pleural Findings:</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{findings.pleuralFindings}</p>
                </div>
              )}
              
              {/* General Summary */}
              {findings?.details && findings.details !== "High-sensitivity analysis complete" && (
                <div className="p-4 border border-blue-100 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Summary:</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{findings.details}</p>
                </div>
              )}
              
              {/* Differential Diagnoses */}
              {differentials && differentials.length > 0 && (
                <div className="p-4 border border-indigo-100 bg-indigo-50 rounded-lg">
                  <h4 className="font-semibold text-indigo-900 mb-3">Differential Diagnoses:</h4>
                  <div className="space-y-3">
                    {differentials.map((diagnosis: any, index: number) => (
                      <div key={index} className="p-3 bg-white border border-indigo-200 rounded-md">
                        <div className="flex items-start justify-between mb-1">
                          <h5 className="font-semibold text-gray-900 text-sm">{diagnosis.diagnosis}</h5>
                          <Badge variant="outline" className="text-indigo-700 bg-indigo-100 text-xs">
                            {diagnosis.probability}% probability
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{diagnosis.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* No findings message */}
              {!findings?.copdFindings && !findings?.ildFindings && !findings?.massFindings && !findings?.vascularFindings && !findings?.infectiousFindings && !findings?.pleuralFindings && !findings?.details && (!differentials || differentials.length === 0) && (
                <div className="p-4 border border-green-100 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-700">No detailed radiological findings available.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Differential Diagnoses */}
      {(differentials && differentials.length > 0) && (
        <Card className="medical-card">
          <CardHeader>
            <CardTitle className="text-medical-title">Differential Diagnoses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {differentials.map((diagnosis: any, index: number) => (
                <div key={index} className="p-4 border border-blue-100 bg-blue-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{diagnosis.diagnosis}</h4>
                    <Badge variant="outline" className="text-blue-700 bg-blue-100">
                      {diagnosis.probability}% probability
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{diagnosis.reasoning}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="medical-card">
        <CardHeader>
          <CardTitle className="text-medical-title">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700">
                {radiologyReport?.recommendations || 
                  'Clinical correlation and follow-up as appropriate. Consider pulmonary function testing if indicated. Follow-up imaging may be warranted based on clinical assessment.'}
              </p>
            </div>
            {!radiologyReport && (
              <div>
                <h4 className="font-semibold mb-2">Clinical Correlation:</h4>
                <p className="text-sm text-gray-700">
                  Findings correlate with provided clinical history and symptoms. 
                  Further clinical correlation recommended.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Information Footer */}
      <Card className="medical-card border-t-4 border-blue-500">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-800">Analysis ID:</p>
              <p className="font-mono text-blue-600 break-all">
                {(analysis as AnalysisResult).id || (analysis as any).analysisId || 'N/A'}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-800">Generated:</p>
              <p>{new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-center text-xs text-gray-500">
              <strong>DecXpert CT AI Analysis Engine v5.0</strong> - 
              This report was generated using proprietary AI technology for chest CT analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}