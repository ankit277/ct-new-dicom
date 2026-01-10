// @ts-ignore - html-pdf-node doesn't have type definitions
import * as pdf from 'html-pdf-node';

export interface PdfReportData {
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
}

export class PdfGeneratorService {
  static async generatePdfReport(data: PdfReportData): Promise<Buffer> {
    const htmlContent = this.generateHtmlTemplate(data);
    
    const options = {
      format: 'A4' as const,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm'
      },
      printBackground: true,
      displayHeaderFooter: false,
      puppeteerArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    };

    try {
      const file = { content: htmlContent };
      // @ts-ignore
      const pdfBuffer = await pdf.generatePdf(file, options);
      return pdfBuffer as Buffer;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error('Failed to generate PDF report');
    }
  }

  private static generateHtmlTemplate(data: PdfReportData): string {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    
    const findings = data.findings || {};
    const radiologyReport = data.radiologyReport;
    const primaryDiagnosis = findings.primaryDiagnosis || 'Not determined';
    const confidence = findings.confidence || 0;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>DecXpert CT Analysis Report</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 20px;
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
            .report-content {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 25px;
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            .report-content h3, .section-title {
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
            .section {
                margin-bottom: 25px;
                page-break-inside: avoid;
            }
            .section h4 {
                color: #374151;
                margin-bottom: 10px;
                font-weight: bold;
                font-size: 14px;
            }
            .findings-box {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 15px 0;
                border-radius: 0 4px 4px 0;
                font-size: 14px;
            }
            .normal-box {
                background: #d1fae5;
                border-left: 4px solid #10b981;
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
                white-space: pre-line;
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
            .list-item {
                margin: 8px 0;
                padding-left: 20px;
            }
        </style>
    </head>
    <body>
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
        <div class="report-content">
            <h3>Clinical Summary</h3>
            <div class="findings-box">
                <strong>Primary Diagnosis:</strong> ${primaryDiagnosis}<br>
                <strong>Confidence Level:</strong> ${confidence}%
            </div>
        </div>

        <!-- Overall Radiological Reading -->
        ${data.radiologicalImpression ? `
        <div class="report-content">
            <h3>Overall Radiological Reading</h3>
            <div class="radiological-reading">${data.radiologicalImpression}</div>
        </div>
        ` : ''}

        <!-- Detailed Medical Report -->
        <div class="report-content">
            <h3>Radiological Analysis Report</h3>
            <div class="report-text">${data.reportContent}</div>
        </div>

        <!-- Recommendations -->
        ${data.recommendations && data.recommendations.length > 0 ? `
        <div class="report-content">
            <h3>Recommendations</h3>
            ${data.recommendations.map(rec => `<div class="list-item">• ${rec}</div>`).join('')}
        </div>
        ` : ''}

        <!-- Clinical Correlation -->
        ${data.clinicalCorrelation ? `
        <div class="report-content">
            <h3>Clinical Correlation</h3>
            <div class="report-text">${data.clinicalCorrelation}</div>
        </div>
        ` : ''}

        <!-- Differential Diagnoses -->
        ${data.differentialDiagnoses && data.differentialDiagnoses.length > 0 ? `
        <div class="report-content">
            <h3>Differential Diagnoses</h3>
            ${data.differentialDiagnoses.map((dd, idx) => {
              const diagnosis = typeof dd === 'string' ? dd : (dd.diagnosis || dd.condition || 'Unknown');
              const probability = dd.probability ? ` (${dd.probability}% probability)` : '';
              return `<div class="list-item">• ${diagnosis}${probability}</div>`;
            }).join('')}
        </div>
        ` : ''}

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
}