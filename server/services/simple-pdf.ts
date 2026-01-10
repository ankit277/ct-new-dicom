// Simple text-based PDF generation for Replit environment
// This creates a downloadable HTML file that can be saved as PDF

import type { PathologySlice, CriticalFinding } from "@shared/schema";
import { 
  buildReportContent, 
  formatRadiologicalReadingHtml, 
  type ReportContent 
} from "@shared/report-content";

export interface SimplePdfData {
  reportContent: string;
  patientData: {
    name: string;
    patientId: string;
    dateOfBirth: string;
    gender: string;
    examDate: string;
  };
  analysisId: string;
  findings?: any;
  radiologicalImpression?: string;
  radiologyReport?: any;
  recommendations?: string[];
  clinicalCorrelation?: string;
  differentialDiagnoses?: any[];
  pathologySlices?: PathologySlice[]; // CT slices showing detected pathologies
  criticalFindings?: CriticalFinding[]; // Prioritized critical findings for radiologist attention
}

export class SimplePdfService {
  static generateHtmlReport(data: SimplePdfData): string {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    
    const findings = data.findings || {};
    const primaryDiagnosis = findings.primaryDiagnosis || 'Not determined';
    const confidence = findings.confidence || 0;
    
    const recommendationsHtml = data.recommendations && data.recommendations.length > 0
      ? `
        <div class="report-section">
            <h3>Recommendations</h3>
            <ul class="recommendations-list">
                ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
      `
      : '';

    const clinicalCorrelationHtml = data.clinicalCorrelation
      ? `
        <div class="report-section">
            <h3>Clinical Correlation</h3>
            <div class="report-text">${data.clinicalCorrelation}</div>
        </div>
      `
      : '';

    const differentialDiagnosesHtml = data.differentialDiagnoses && data.differentialDiagnoses.length > 0
      ? `
        <div class="report-section">
            <h3>Differential Diagnoses</h3>
            <ul class="differentials-list">
                ${data.differentialDiagnoses.map((dd: any) => {
                  const diagnosis = typeof dd === 'string' ? dd : (dd.diagnosis || dd.condition || 'Unknown');
                  const probability = dd.probability ? ` (${dd.probability}% probability)` : '';
                  return `<li>${diagnosis}${probability}</li>`;
                }).join('')}
            </ul>
        </div>
      `
      : '';

    const radiologicalImpressionHtml = data.radiologicalImpression
      ? `
        <div class="report-section">
            <h3>Overall Radiological Reading</h3>
            <div class="radiological-reading">${data.radiologicalImpression}</div>
        </div>
      `
      : `
        <div class="report-section">
            <h3>Overall Radiological Reading</h3>
            <div class="radiological-reading">
                <strong>FINDINGS:</strong><br><br>
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
                <strong>Osseous Structures:</strong> No acute osseous abnormality identified.
            </div>
        </div>
      `;

    // Generate Critical Findings section with CT images
    const criticalSlices = data.pathologySlices?.filter(s => 
      s.detectedPathologies.some(p => ['Mass/Nodule', 'Pulmonary Embolism', 'Pneumothorax'].includes(p))
    ) || [];
    
    const criticalFindingsHtml = criticalSlices.length > 0
      ? `
        <div class="report-section critical-findings-section">
            <h3>⚠️ CRITICAL FINDINGS - REQUIRES IMMEDIATE ATTENTION</h3>
            <div class="critical-alert">
                <strong>The following critical findings require radiologist review:</strong>
                <ul>
                    ${Array.from(new Set(criticalSlices.flatMap(s => s.detectedPathologies.filter(p => 
                      ['Mass/Nodule', 'Pulmonary Embolism', 'Pneumothorax'].includes(p)
                    )))).map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
            <div class="ct-visualization-grid">
                ${criticalSlices.slice(0, 6).map((slice, idx) => `
                    <div class="ct-slice-card">
                        <div class="slice-header">
                            <span class="slice-number">Slice #${slice.sliceIndex + 1}</span>
                            <span class="slice-confidence">${slice.confidence}% confidence</span>
                        </div>
                        <img src="data:image/png;base64,${slice.imageData}" alt="CT Slice ${slice.sliceIndex + 1}" class="ct-image" />
                        <div class="slice-findings">
                            <strong>Detected:</strong> ${slice.detectedPathologies.join(', ')}<br>
                            <span class="findings-text">${slice.findings || 'See detailed findings'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
      `
      : '';
    
    // Generate all pathology CT visualization section (at end of report)
    const allPathologySlices = data.pathologySlices || [];
    const ctVisualizationHtml = allPathologySlices.length > 0
      ? `
        <div class="report-section ct-visualization-section">
            <h3>CT Visualization - Detected Pathology Slices</h3>
            <p class="visualization-note">The following CT slices demonstrate the detected pathological findings:</p>
            <div class="ct-visualization-grid">
                ${allPathologySlices.slice(0, 12).map((slice, idx) => `
                    <div class="ct-slice-card ${slice.detectedPathologies.some(p => ['Mass/Nodule', 'Pulmonary Embolism', 'Pneumothorax'].includes(p)) ? 'critical-slice' : ''}">
                        <div class="slice-header">
                            <span class="slice-number">Slice #${slice.sliceIndex + 1}</span>
                            <span class="slice-confidence">${slice.confidence}% confidence</span>
                        </div>
                        <img src="data:image/png;base64,${slice.imageData}" alt="CT Slice ${slice.sliceIndex + 1}" class="ct-image" />
                        <div class="slice-findings">
                            <strong>Detected:</strong> ${slice.detectedPathologies.join(', ')}<br>
                            <span class="findings-text">${slice.findings || 'See detailed findings'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
      `
      : '';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>DecXpert CT Analysis Report - ${data.patientData.name}</title>
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
            .patient-info {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
            }
            .patient-info h3 {
                color: #1e40af;
                margin-top: 0;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 10px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .info-item {
                display: flex;
                justify-content: space-between;
            }
            .info-label {
                font-weight: bold;
                color: #475569;
            }
            .info-value {
                color: #1e293b;
            }
            .report-section {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 25px;
                margin-bottom: 20px;
            }
            .report-section h3 {
                color: #1e40af;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 10px;
                margin-top: 0;
                font-size: 18px;
            }
            .report-text {
                white-space: pre-line;
                font-size: 14px;
                line-height: 1.8;
            }
            .clinical-summary {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
            }
            .radiological-reading {
                background: #f0f9ff;
                border-left: 4px solid #3b82f6;
                padding: 15px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
                white-space: pre-line;
                font-size: 14px;
            }
            .recommendations-list, .differentials-list {
                margin: 10px 0;
                padding-left: 25px;
            }
            .recommendations-list li, .differentials-list li {
                margin: 8px 0;
                line-height: 1.5;
            }
            .footer {
                border-top: 2px solid #e2e8f0;
                padding-top: 20px;
                margin-top: 30px;
                text-align: center;
                color: #64748b;
                font-size: 12px;
            }
            .analysis-id {
                background: #f1f5f9;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 10px;
                margin-top: 20px;
                font-family: monospace;
                font-size: 12px;
                text-align: center;
            }
            .print-button {
                background: #1e40af;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin: 20px 0;
            }
            /* Critical Findings Styles */
            .critical-findings-section {
                border: 2px solid #dc2626;
                background: #fef2f2;
            }
            .critical-findings-section h3 {
                color: #dc2626;
                border-bottom-color: #dc2626;
            }
            .critical-alert {
                background: #fee2e2;
                border-left: 4px solid #dc2626;
                padding: 15px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
            }
            .critical-alert ul {
                margin: 10px 0 0 20px;
                padding: 0;
            }
            .critical-alert li {
                font-weight: bold;
                color: #991b1b;
            }
            /* CT Visualization Grid */
            .ct-visualization-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-top: 20px;
            }
            @media (max-width: 800px) {
                .ct-visualization-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            .ct-slice-card {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                overflow: hidden;
                background: #f8fafc;
            }
            .ct-slice-card.critical-slice {
                border: 2px solid #dc2626;
                background: #fef2f2;
            }
            .slice-header {
                background: #1e40af;
                color: white;
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                font-size: 12px;
            }
            .critical-slice .slice-header {
                background: #dc2626;
            }
            .ct-image {
                width: 100%;
                height: auto;
                display: block;
            }
            .slice-findings {
                padding: 10px;
                font-size: 11px;
                line-height: 1.4;
            }
            .findings-text {
                color: #64748b;
                display: block;
                margin-top: 5px;
            }
            .visualization-note {
                color: #64748b;
                font-style: italic;
                margin-bottom: 15px;
            }
            .ct-visualization-section {
                page-break-before: always;
            }
        </style>
        <script>
            function printReport() {
                window.print();
            }
            
            function saveAsPdf() {
                alert('To save as PDF: Use your browser\\'s Print function and select "Save as PDF" as the destination.');
                window.print();
            }
        </script>
    </head>
    <body>
        <div class="no-print">
            <button class="print-button" onclick="printReport()">🖨️ Print Report</button>
            <button class="print-button" onclick="saveAsPdf()">📄 Save as PDF</button>
        </div>
        
        <div class="header">
            <h1>DecXpert CT</h1>
            <h2>Professional Chest CT Analysis Report</h2>
        </div>

        <div class="patient-info">
            <h3>Patient Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Patient Name:</span>
                    <span class="info-value">${data.patientData.name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Patient ID:</span>
                    <span class="info-value">${data.patientData.patientId}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date of Birth:</span>
                    <span class="info-value">${data.patientData.dateOfBirth}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Gender:</span>
                    <span class="info-value">${data.patientData.gender}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Exam Date:</span>
                    <span class="info-value">${data.patientData.examDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Report Date:</span>
                    <span class="info-value">${currentDate} ${currentTime}</span>
                </div>
            </div>
        </div>

        <!-- Clinical Summary -->
        <div class="report-section">
            <h3>Clinical Summary</h3>
            <div class="clinical-summary">
                <strong>Primary Diagnosis:</strong> ${primaryDiagnosis}<br>
                <strong>Confidence Level:</strong> ${confidence}%
            </div>
        </div>

        <!-- Critical Findings (if any) - REQUIRES IMMEDIATE ATTENTION -->
        ${criticalFindingsHtml}

        <!-- Overall Radiological Reading -->
        ${radiologicalImpressionHtml}

        <!-- Detailed Medical Report -->
        <div class="report-section">
            <h3>Radiological Analysis Report</h3>
            <div class="report-text">${data.reportContent}</div>
        </div>

        <!-- Recommendations -->
        ${recommendationsHtml}

        <!-- Clinical Correlation -->
        ${clinicalCorrelationHtml}

        <!-- Differential Diagnoses -->
        ${differentialDiagnosesHtml}

        <!-- CT Visualization Section -->
        ${ctVisualizationHtml}

        <div class="analysis-id">
            Analysis ID: ${data.analysisId}
        </div>

        <div class="footer">
            <p><strong>DecXpert CT AI Analysis Engine v2.1</strong></p>
            <p>This report was generated using proprietary AI technology for chest CT analysis.</p>
            <p>Generated on: ${currentDate} at ${currentTime}</p>
        </div>
    </body>
    </html>
    `;
  }

  static generateTextReport(data: SimplePdfData): string {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    
    const findings = data.findings || {};
    const primaryDiagnosis = findings.primaryDiagnosis || 'Not determined';
    const confidence = findings.confidence || 0;

    let textReport = `
DECXPERT CT ANALYSIS REPORT
============================

Generated by DecXpert CT AI Engine v2.1
Report Date: ${currentDate} ${currentTime}

PATIENT INFORMATION:
-------------------
Name: ${data.patientData.name}
Patient ID: ${data.patientData.patientId}
Gender: ${data.patientData.gender}
Date of Birth: ${data.patientData.dateOfBirth}
Examination Date: ${data.patientData.examDate}

CLINICAL SUMMARY:
----------------
Primary Diagnosis: ${primaryDiagnosis}
Confidence Level: ${confidence}%
`;

    if (data.radiologicalImpression) {
      textReport += `
OVERALL RADIOLOGICAL READING:
----------------------------
${data.radiologicalImpression}
`;
    }

    textReport += `
RADIOLOGICAL ANALYSIS:
---------------------
${data.reportContent}
`;

    if (data.recommendations && data.recommendations.length > 0) {
      textReport += `
RECOMMENDATIONS:
---------------
${data.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
`;
    }

    if (data.clinicalCorrelation) {
      textReport += `
CLINICAL CORRELATION:
--------------------
${data.clinicalCorrelation}
`;
    }

    if (data.differentialDiagnoses && data.differentialDiagnoses.length > 0) {
      textReport += `
DIFFERENTIAL DIAGNOSES:
----------------------
${data.differentialDiagnoses.map((dd: any, i: number) => {
  const diagnosis = typeof dd === 'string' ? dd : (dd.diagnosis || dd.condition || 'Unknown');
  const probability = dd.probability ? ` (${dd.probability}% probability)` : '';
  return `${i + 1}. ${diagnosis}${probability}`;
}).join('\n')}
`;
    }

    textReport += `
ANALYSIS DETAILS:
----------------
Analysis ID: ${data.analysisId}
Generated on: ${currentDate} at ${currentTime}
DecXpert CT AI Analysis Engine v2.1

This report was generated using proprietary AI technology for chest CT analysis.
    `;

    return textReport.trim();
  }

  /**
   * Generate HTML report from unified ReportContent model
   * This ensures PDF output matches frontend display exactly
   */
  static generateFromReportContent(report: ReportContent): string {
    const radiologicalReadingHtml = formatRadiologicalReadingHtml(report.radiologicalReading);
    
    const criticalFindingsHtml = report.criticalFindings.present
      ? `
        <div class="report-section critical-findings-section">
            <h3>CRITICAL FINDINGS - REQUIRES IMMEDIATE ATTENTION</h3>
            <div class="critical-alert">
                <strong>The following critical findings require radiologist review:</strong>
                <ul>
                    ${report.criticalFindings.pathologies.map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
            <div class="ct-visualization-grid">
                ${report.criticalFindings.slices.map(slice => `
                    <div class="ct-slice-card critical-slice">
                        <div class="slice-header">
                            <span class="slice-number">Slice #${slice.sliceNumber}</span>
                            <span class="slice-confidence">${slice.confidence}% confidence</span>
                        </div>
                        <img src="data:image/png;base64,${slice.imageData}" alt="CT Slice ${slice.sliceNumber}" class="ct-image" />
                        <div class="slice-findings">
                            <strong>Detected:</strong> ${slice.detectedPathologies.join(', ')}<br>
                            <span class="findings-text">${slice.findings}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
      `
      : '';

    const differentialDiagnosesHtml = report.differentialDiagnoses.length > 0
      ? `
        <div class="report-section">
            <h3>Differential Diagnoses</h3>
            <ul class="differentials-list">
                ${report.differentialDiagnoses.map(dd => 
                  `<li><strong>${dd.diagnosis}</strong>${dd.probability ? ` (${dd.probability}% probability)` : ''}${dd.reasoning ? `<br><em>${dd.reasoning}</em>` : ''}</li>`
                ).join('')}
            </ul>
        </div>
      `
      : '';

    const recommendationsHtml = report.recommendations.length > 0
      ? `
        <div class="report-section">
            <h3>Recommendations</h3>
            <ul class="recommendations-list">
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
      `
      : '';

    const ctVisualizationHtml = report.ctVisualization.slices.length > 0
      ? `
        <div class="report-section ct-visualization-section">
            <h3>CT Visualization - Detected Pathology Slices</h3>
            <p class="visualization-note">The following CT slices demonstrate the detected pathological findings (${report.ctVisualization.totalCount} total slices with findings):</p>
            <div class="ct-visualization-grid">
                ${report.ctVisualization.slices.map(slice => `
                    <div class="ct-slice-card ${slice.isCritical ? 'critical-slice' : ''}">
                        <div class="slice-header">
                            <span class="slice-number">Slice #${slice.sliceNumber}</span>
                            <span class="slice-confidence">${slice.confidence}% confidence</span>
                        </div>
                        <img src="data:image/png;base64,${slice.imageData}" alt="CT Slice ${slice.sliceNumber}" class="ct-image" />
                        <div class="slice-findings">
                            <strong>Detected:</strong> ${slice.detectedPathologies.join(', ')}<br>
                            <span class="findings-text">${slice.findings}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
      `
      : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>DecXpert CT Analysis Report - ${report.patientInfo.name}</title>
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
            .patient-info {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
            }
            .patient-info h3 {
                color: #1e40af;
                margin-top: 0;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 10px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .info-item {
                display: flex;
                justify-content: space-between;
            }
            .info-label {
                font-weight: bold;
                color: #475569;
            }
            .info-value {
                color: #1e293b;
            }
            .report-section {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 25px;
                margin-bottom: 20px;
            }
            .report-section h3 {
                color: #1e40af;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 10px;
                margin-top: 0;
                font-size: 18px;
            }
            .clinical-summary {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
            }
            .radiological-reading {
                background: #f0f9ff;
                border-left: 4px solid #3b82f6;
                padding: 15px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
                font-size: 14px;
            }
            .recommendations-list, .differentials-list {
                margin: 10px 0;
                padding-left: 25px;
            }
            .recommendations-list li, .differentials-list li {
                margin: 8px 0;
                line-height: 1.5;
            }
            .footer {
                border-top: 2px solid #e2e8f0;
                padding-top: 20px;
                margin-top: 30px;
                text-align: center;
                color: #64748b;
                font-size: 12px;
            }
            .analysis-id {
                background: #f1f5f9;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                padding: 10px;
                margin-top: 20px;
                font-family: monospace;
                font-size: 12px;
                text-align: center;
            }
            .print-button {
                background: #1e40af;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin: 20px 0;
            }
            .critical-findings-section {
                border: 2px solid #dc2626;
                background: #fef2f2;
            }
            .critical-findings-section h3 {
                color: #dc2626;
                border-bottom-color: #dc2626;
            }
            .critical-alert {
                background: #fee2e2;
                border-left: 4px solid #dc2626;
                padding: 15px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
            }
            .critical-alert ul {
                margin: 10px 0 0 20px;
                padding: 0;
            }
            .critical-alert li {
                font-weight: bold;
                color: #991b1b;
            }
            .ct-visualization-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-top: 20px;
            }
            @media (max-width: 800px) {
                .ct-visualization-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            .ct-slice-card {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                overflow: hidden;
                background: #f8fafc;
            }
            .ct-slice-card.critical-slice {
                border: 2px solid #dc2626;
                background: #fef2f2;
            }
            .slice-header {
                background: #1e40af;
                color: white;
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                font-size: 12px;
            }
            .critical-slice .slice-header {
                background: #dc2626;
            }
            .ct-image {
                width: 100%;
                height: auto;
                display: block;
            }
            .slice-findings {
                padding: 10px;
                font-size: 11px;
                line-height: 1.4;
            }
            .findings-text {
                color: #64748b;
                display: block;
                margin-top: 5px;
            }
            .visualization-note {
                color: #64748b;
                font-style: italic;
                margin-bottom: 15px;
            }
            .ct-visualization-section {
                page-break-before: always;
            }
        </style>
        <script>
            function printReport() {
                window.print();
            }
            function saveAsPdf() {
                alert('To save as PDF: Use your browser\\'s Print function and select "Save as PDF" as the destination.');
                window.print();
            }
        </script>
    </head>
    <body>
        <div class="no-print">
            <button class="print-button" onclick="printReport()">Print Report</button>
            <button class="print-button" onclick="saveAsPdf()">Save as PDF</button>
        </div>
        
        <div class="header">
            <h1>DecXpert CT</h1>
            <h2>Professional Chest CT Analysis Report</h2>
        </div>

        <div class="patient-info">
            <h3>Patient Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Patient Name:</span>
                    <span class="info-value">${report.patientInfo.name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Patient ID:</span>
                    <span class="info-value">${report.patientInfo.patientId}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date of Birth:</span>
                    <span class="info-value">${report.patientInfo.dateOfBirth}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Gender:</span>
                    <span class="info-value">${report.patientInfo.gender}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Exam Date:</span>
                    <span class="info-value">${report.patientInfo.examDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Report Date:</span>
                    <span class="info-value">${report.patientInfo.reportDate} ${report.patientInfo.reportTime}</span>
                </div>
            </div>
        </div>

        <!-- Clinical Summary -->
        <div class="report-section">
            <h3>Clinical Summary</h3>
            <div class="clinical-summary">
                <strong>Primary Diagnosis:</strong> ${report.clinicalSummary.primaryDiagnosis}<br>
                <strong>Confidence Level:</strong> ${report.clinicalSummary.confidence}%
                ${report.clinicalSummary.hasCriticalFindings ? '<br><strong style="color: #dc2626;">CRITICAL FINDINGS PRESENT</strong>' : ''}
            </div>
        </div>

        <!-- Critical Findings -->
        ${criticalFindingsHtml}

        <!-- Overall Radiological Reading -->
        <div class="report-section">
            <h3>Overall Radiological Reading</h3>
            <div class="radiological-reading">${radiologicalReadingHtml}</div>
        </div>

        <!-- Recommendations -->
        ${recommendationsHtml}

        <!-- Clinical Correlation -->
        <div class="report-section">
            <h3>Clinical Correlation</h3>
            <div class="report-text">${report.clinicalCorrelation}</div>
        </div>

        <!-- Differential Diagnoses -->
        ${differentialDiagnosesHtml}

        <!-- CT Visualization Section -->
        ${ctVisualizationHtml}

        <div class="analysis-id">
            Analysis ID: ${report.metadata.analysisId}
        </div>

        <div class="footer">
            <p><strong>${report.metadata.engineVersion}</strong></p>
            <p>This report was generated using proprietary AI technology for chest CT analysis.</p>
            <p>Generated on: ${report.patientInfo.reportDate} at ${report.patientInfo.reportTime}</p>
        </div>
    </body>
    </html>
    `;
  }
}
