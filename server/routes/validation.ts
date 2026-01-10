/**
 * API Routes for High-Sensitivity Detection Rules Validation
 */

import { Router, Request, Response } from 'express';
import { DetectionRulesValidator } from '../services/detectionRulesValidation';

const router = Router();

/**
 * Run validation tests for high-sensitivity detection rules
 * GET /api/validation/nodule-detection
 */
router.get('/nodule-detection', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Starting high-sensitivity detection rules validation');
    
    // Run complete validation suite
    const results = DetectionRulesValidator.runCompleteValidation();
    
    // Generate comprehensive report
    const report = DetectionRulesValidator.generateValidationReport(results);
    
    res.json({
      success: true,
      message: 'High-sensitivity detection rules validation completed',
      results: {
        performanceMetrics: {
          sensitivity: results.sensitivity,
          specificity: results.specificity,
          accuracy: results.accuracy,
          precision: results.precision,
          f1Score: results.f1Score
        },
        targetAchievement: {
          meetsTargets: results.meetsTargets,
          sensitivityTarget: results.sensitivity >= 95,
          specificityTarget: results.specificity >= 90
        },
        confusionMatrix: {
          truePositives: results.truePositives,
          falsePositives: results.falsePositives,
          trueNegatives: results.trueNegatives,
          falseNegatives: results.falseNegatives,
          totalCases: results.totalCases
        },
        failedCases: results.failedCases,
        validationReport: report
      }
    });
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run validation tests',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get validation summary for dashboard
 * GET /api/validation/summary
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const testCases = DetectionRulesValidator.generateTestCases();
    const results = DetectionRulesValidator.validateDetectionRules(testCases);
    
    res.json({
      success: true,
      summary: {
        totalTestCases: results.totalCases,
        sensitivity: `${results.sensitivity.toFixed(1)}%`,
        specificity: `${results.specificity.toFixed(1)}%`,
        accuracy: `${results.accuracy.toFixed(1)}%`,
        targetsAchieved: results.meetsTargets,
        status: results.meetsTargets ? 'VALIDATED' : 'REQUIRES_OPTIMIZATION',
        riskProfile: {
          highRisk: results.truePositives,
          lowRisk: results.trueNegatives,
          falseAlarms: results.falsePositives,
          missedCases: results.falseNegatives
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate validation summary'
    });
  }
});

export default router;