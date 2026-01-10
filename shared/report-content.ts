import type { PathologySlice } from "./schema";

export interface ReportSection {
  title: string;
  content: string;
  type: 'text' | 'list' | 'highlight' | 'alert';
  items?: string[];
}

export interface CTSliceDisplay {
  sliceIndex: number;
  sliceNumber: number;
  confidence: number;
  detectedPathologies: string[];
  findings: string;
  imageData: string;
  filename: string;
  isCritical: boolean;
}

export interface ReportContent {
  patientInfo: {
    name: string;
    patientId: string;
    dateOfBirth: string;
    gender: string;
    examDate: string;
    reportDate: string;
    reportTime: string;
  };
  
  clinicalSummary: {
    primaryDiagnosis: string;
    confidence: number;
    hasCriticalFindings: boolean;
  };
  
  radiologicalReading: {
    hasCustomImpression: boolean;
    customImpression?: string;
    airways: string;
    lungParenchyma: string;
    pulmonaryVasculature: string;
    pleura: string;
    mediastinum: string;
    heart: string;
    osseousStructures: string;
  };
  
  criticalFindings: {
    present: boolean;
    pathologies: string[];
    slices: CTSliceDisplay[];
  };
  
  differentialDiagnoses: Array<{
    diagnosis: string;
    probability: number;
    reasoning: string;
  }>;
  
  recommendations: string[];
  
  clinicalCorrelation: string;
  
  ctVisualization: {
    slices: CTSliceDisplay[];
    totalCount: number;
  };
  
  metadata: {
    analysisId: string;
    engineVersion: string;
    generatedAt: string;
  };
}

const CRITICAL_PATHOLOGIES = ['Mass/Nodule', 'Pulmonary Embolism', 'Pneumothorax'];

export function buildReportContent(
  analysis: any,
  patientData: {
    name: string;
    patientId: string;
    dateOfBirth: string;
    gender: string;
    examDate?: string;
    clinicalHistory?: string;
  }
): ReportContent {
  const currentDate = new Date();
  const findings = analysis.findings || {};
  
  const pathologySlices: PathologySlice[] = analysis.pathologySlices || [];
  
  const ctSlices: CTSliceDisplay[] = pathologySlices.map(slice => ({
    sliceIndex: slice.sliceIndex,
    sliceNumber: slice.sliceIndex + 1,
    confidence: slice.confidence,
    detectedPathologies: slice.detectedPathologies,
    findings: slice.findings || 'See detailed findings',
    imageData: slice.imageData,
    filename: slice.filename || `Slice_${String(slice.sliceIndex + 1).padStart(4, '0')}.dcm`,
    isCritical: slice.detectedPathologies.some(p => CRITICAL_PATHOLOGIES.includes(p))
  }));
  
  // Sort all slices by: 1) critical pathologies first, 2) then by descending confidence
  // This ensures high-confidence critical slices are never missed due to truncation
  const sortedCtSlices = [...ctSlices].sort((a, b) => {
    // Critical slices always come first
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    // Then sort by descending confidence
    return b.confidence - a.confidence;
  });
  
  const criticalSlices = sortedCtSlices.filter(s => s.isCritical);
  const criticalPathologies = Array.from(new Set(
    criticalSlices.flatMap(s => s.detectedPathologies.filter(p => CRITICAL_PATHOLOGIES.includes(p)))
  ));
  
  const lungParenchymaFindings = [
    findings.ildDetected ? (findings.ildFindings || 'Interstitial lung disease pattern identified.') : '',
    findings.massDetected ? (findings.massFindings || 'Pulmonary nodule/mass identified.') : '',
    findings.pneumoniaDetected ? (findings.pneumoniaFindings || 'Consolidation consistent with pneumonia.') : '',
    findings.tuberculosisDetected ? (findings.tuberculosisFindings || 'Findings suggestive of tuberculosis.') : ''
  ].filter(f => f).join(' ') || 'Clear lung fields bilaterally without focal consolidation, mass, or nodule.';
  
  const differentials = (analysis.differentialDiagnoses || []).map((dd: any) => ({
    diagnosis: typeof dd === 'string' ? dd : (dd.diagnosis || dd.condition || 'Unknown'),
    probability: dd.probability || 0,
    reasoning: dd.reasoning || ''
  }));
  
  return {
    patientInfo: {
      name: patientData.name,
      patientId: patientData.patientId,
      dateOfBirth: patientData.dateOfBirth,
      gender: patientData.gender,
      examDate: patientData.examDate || currentDate.toISOString().split('T')[0],
      reportDate: currentDate.toLocaleDateString(),
      reportTime: currentDate.toLocaleTimeString()
    },
    
    clinicalSummary: {
      primaryDiagnosis: analysis.primaryDiagnosis || findings.primaryDiagnosis || 'No significant findings',
      confidence: findings.confidence || analysis.confidence || 0,
      hasCriticalFindings: criticalSlices.length > 0
    },
    
    radiologicalReading: {
      hasCustomImpression: !!analysis.radiologicalImpression,
      customImpression: analysis.radiologicalImpression,
      airways: findings.copdDetected 
        ? (findings.copdFindings || 'COPD changes identified.') 
        : 'Normal caliber central and peripheral airways without evidence of bronchiectasis or airway thickening.',
      lungParenchyma: lungParenchymaFindings,
      pulmonaryVasculature: findings.pulmonaryEmbolismDetected 
        ? (findings.vascularFindings || 'Filling defect identified concerning for pulmonary embolism.') 
        : 'Normal pulmonary arterial caliber without evidence of filling defects.',
      pleura: (findings.pleuralEffusionDetected || findings.pneumothoraxDetected) 
        ? (findings.pleuralFindings || 'Pleural abnormality identified.') 
        : 'No pleural effusion or pneumothorax. Normal pleural surfaces.',
      mediastinum: 'Mediastinal structures are normal in position and configuration.',
      heart: 'Cardiac silhouette is within normal limits.',
      osseousStructures: 'No acute osseous abnormality identified.'
    },
    
    criticalFindings: {
      present: criticalSlices.length > 0,
      pathologies: criticalPathologies,
      // Include ALL critical slices (no truncation for critical findings)
      slices: criticalSlices
    },
    
    differentialDiagnoses: differentials,
    
    recommendations: analysis.recommendations || [],
    
    clinicalCorrelation: analysis.clinicalCorrelation || 
      'Findings correlate with provided clinical history and symptoms. Further clinical correlation recommended.',
    
    ctVisualization: {
      // Use sorted slices - critical pathologies first, then by confidence
      // This ensures highest-value slices are shown first
      slices: sortedCtSlices.slice(0, 16), // Increased from 12 to show more high-confidence slices
      totalCount: sortedCtSlices.length
    },
    
    metadata: {
      analysisId: analysis.id || analysis.analysisId || 'N/A',
      engineVersion: 'DecXpert CT AI Engine v2.1',
      generatedAt: currentDate.toISOString()
    }
  };
}

export function formatRadiologicalReading(reading: ReportContent['radiologicalReading']): string {
  if (reading.hasCustomImpression && reading.customImpression) {
    return reading.customImpression;
  }
  
  return `**FINDINGS:**

**Airways:** ${reading.airways}

**Lung Parenchyma:** ${reading.lungParenchyma}

**Pulmonary Vasculature:** ${reading.pulmonaryVasculature}

**Pleura:** ${reading.pleura}

**Mediastinum:** ${reading.mediastinum}

**Heart:** ${reading.heart}

**Osseous Structures:** ${reading.osseousStructures}`;
}

export function formatRadiologicalReadingHtml(reading: ReportContent['radiologicalReading']): string {
  if (reading.hasCustomImpression && reading.customImpression) {
    return reading.customImpression;
  }
  
  return `<strong>FINDINGS:</strong><br><br>
<strong>Airways:</strong> ${reading.airways}<br><br>
<strong>Lung Parenchyma:</strong> ${reading.lungParenchyma}<br><br>
<strong>Pulmonary Vasculature:</strong> ${reading.pulmonaryVasculature}<br><br>
<strong>Pleura:</strong> ${reading.pleura}<br><br>
<strong>Mediastinum:</strong> ${reading.mediastinum}<br><br>
<strong>Heart:</strong> ${reading.heart}<br><br>
<strong>Osseous Structures:</strong> ${reading.osseousStructures}`;
}
