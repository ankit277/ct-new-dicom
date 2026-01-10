/**
 * Validation System for High-Sensitivity Lung Nodule Detection Rules
 * Tests to verify 95% sensitivity and 90% specificity targets
 */

import { HighSensitivityNoduleDetector, type LungCancerRiskFactors, type NoduleDetectionResult } from "./lungCancerDetectionRules";
import { AdvancedNoduleClassifier, type NoduleClassification, type RiskStratification } from "./advancedNoduleClassification";

export interface TestCase {
  id: string;
  name: string;
  description: string;
  aiResult: any;
  riskFactors: LungCancerRiskFactors;
  groundTruth: boolean; // True if actual cancer, false if benign
  expectedSensitivity: boolean; // Should be detected as high risk
  expectedSpecificity: boolean; // Should be correctly classified
}

export interface ValidationResults {
  totalCases: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  sensitivity: number;
  specificity: number;
  accuracy: number;
  precision: number;
  f1Score: number;
  meetsTargets: boolean;
  failedCases: string[];
}

export class DetectionRulesValidator {

  /**
   * Generate comprehensive test cases for validation
   */
  static generateTestCases(): TestCase[] {
    const testCases: TestCase[] = [];

    // HIGH SENSITIVITY TEST CASES - These should be detected (True Positives)

    // Case 1: Large spiculated mass with high malignancy risk
    testCases.push({
      id: "TP01",
      name: "Large Spiculated Mass",
      description: "25mm spiculated mass in RUL with 85% malignancy risk",
      aiResult: {
        Lung_Cancer: {
          present: true,
          confidence: 90,
          size_mm: 25,
          location: "RUL",
          morphology: "spiculated",
          lesion_type: "solid",
          malignancy_risk: 85,
          TNM_stage: "T2a"
        }
      },
      riskFactors: { age: 68, smokingHistory: true, packYears: 40 },
      groundTruth: true,
      expectedSensitivity: true,
      expectedSpecificity: true
    });

    // Case 2: Small nodule with high-risk morphology
    testCases.push({
      id: "TP02",
      name: "Small High-Risk Nodule",
      description: "8mm irregular nodule in LUL with spiculation",
      aiResult: {
        Lung_Cancer: {
          present: true,
          confidence: 75,
          size_mm: 8,
          location: "LUL",
          morphology: "irregular spiculated",
          lesion_type: "solid",
          malignancy_risk: 65,
          TNM_stage: "T1a"
        }
      },
      riskFactors: { age: 62, smokingHistory: true, packYears: 30 },
      groundTruth: true,
      expectedSensitivity: true,
      expectedSpecificity: true
    });

    // Case 3: Multiple nodules scenario
    testCases.push({
      id: "TP03",
      name: "Multiple Pulmonary Nodules",
      description: "Multiple nodules largest 12mm with moderate malignancy risk",
      aiResult: {
        Lung_Cancer: {
          present: true,
          confidence: 80,
          size_mm: 12,
          largest_nodule_size: 12,
          number_of_nodules: 4,
          location: "bilateral",
          morphology: "lobulated",
          lesion_type: "solid",
          malignancy_risk: 70,
          TNM_stage: "T3"
        }
      },
      riskFactors: { age: 58, smokingHistory: true, familyHistory: true },
      groundTruth: true,
      expectedSensitivity: true,
      expectedSpecificity: true
    });

    // Case 4: Ground-glass nodule with growth potential
    testCases.push({
      id: "TP04",
      name: "Persistent Ground-Glass Nodule",
      description: "15mm persistent ground-glass nodule",
      aiResult: {
        Lung_Cancer: {
          present: true,
          confidence: 70,
          size_mm: 15,
          location: "RUL",
          morphology: "well-defined",
          lesion_type: "ground-glass",
          malignancy_risk: 55,
          TNM_stage: "T1b"
        }
      },
      riskFactors: { age: 55, smokingHistory: false, familyHistory: true },
      groundTruth: true,
      expectedSensitivity: true,
      expectedSpecificity: true
    });

    // Case 5: Small nodule in high-risk patient
    testCases.push({
      id: "TP05",
      name: "Small Nodule High-Risk Patient",
      description: "6mm nodule in elderly smoker with family history",
      aiResult: {
        Lung_Cancer: {
          present: false, // AI missed it
          confidence: 45,
          size_mm: 6,
          location: "RUL",
          morphology: "smooth",
          lesion_type: "solid",
          malignancy_risk: 25
        }
      },
      riskFactors: { age: 72, smokingHistory: true, packYears: 50, familyHistory: true, previousCancer: true },
      groundTruth: true,
      expectedSensitivity: true, // High-sensitivity rules should catch this
      expectedSpecificity: true
    });

    // Case 6: Part-solid nodule
    testCases.push({
      id: "TP06",
      name: "Part-Solid Nodule",
      description: "10mm part-solid nodule with solid component",
      aiResult: {
        Lung_Cancer: {
          present: true,
          confidence: 82,
          size_mm: 10,
          location: "LLL",
          morphology: "lobulated",
          lesion_type: "part-solid",
          malignancy_risk: 72,
          TNM_stage: "T1b"
        }
      },
      riskFactors: { age: 64, smokingHistory: true },
      groundTruth: true,
      expectedSensitivity: true,
      expectedSpecificity: true
    });

    // SPECIFICITY TEST CASES - These should NOT be flagged as high risk (True Negatives)

    // Case 7: Small smooth nodule in low-risk patient
    testCases.push({
      id: "TN01",
      name: "Small Smooth Nodule",
      description: "4mm smooth nodule in young non-smoker",
      aiResult: {
        Lung_Cancer: {
          present: false,
          confidence: 30,
          size_mm: 4,
          location: "RLL",
          morphology: "smooth well-defined",
          lesion_type: "solid",
          malignancy_risk: 10
        }
      },
      riskFactors: { age: 35, smokingHistory: false },
      groundTruth: false,
      expectedSensitivity: false,
      expectedSpecificity: true
    });

    // Case 8: Small ground-glass nodule
    testCases.push({
      id: "TN02",
      name: "Small Ground-Glass Nodule",
      description: "5mm pure ground-glass nodule",
      aiResult: {
        Lung_Cancer: {
          present: false,
          confidence: 25,
          size_mm: 5,
          location: "LUL",
          morphology: "well-defined",
          lesion_type: "ground-glass",
          malignancy_risk: 15
        }
      },
      riskFactors: { age: 45, smokingHistory: false },
      groundTruth: false,
      expectedSensitivity: false,
      expectedSpecificity: true
    });

    // Case 9: Inflammatory nodule
    testCases.push({
      id: "TN03",
      name: "Inflammatory Nodule",
      description: "8mm smooth nodule likely inflammatory",
      aiResult: {
        Lung_Cancer: {
          present: false,
          confidence: 20,
          size_mm: 8,
          location: "RML",
          morphology: "smooth",
          lesion_type: "solid",
          malignancy_risk: 12
        }
      },
      riskFactors: { age: 40, smokingHistory: false },
      groundTruth: false,
      expectedSensitivity: false,
      expectedSpecificity: true
    });

    // Case 10: Calcified nodule
    testCases.push({
      id: "TN04",
      name: "Calcified Nodule",
      description: "7mm calcified granuloma",
      aiResult: {
        Lung_Cancer: {
          present: false,
          confidence: 15,
          size_mm: 7,
          location: "RUL",
          morphology: "smooth calcified",
          lesion_type: "solid",
          malignancy_risk: 5
        }
      },
      riskFactors: { age: 50, smokingHistory: false },
      groundTruth: false,
      expectedSensitivity: false,
      expectedSpecificity: true
    });

    // CHALLENGING CASES FOR EDGE TESTING

    // Case 11: Borderline size nodule
    testCases.push({
      id: "EDGE01",
      name: "Borderline Size Nodule",
      description: "7mm nodule in moderate-risk patient",
      aiResult: {
        Lung_Cancer: {
          present: false,
          confidence: 55,
          size_mm: 7,
          location: "RUL",
          morphology: "lobulated",
          lesion_type: "solid",
          malignancy_risk: 40
        }
      },
      riskFactors: { age: 58, smokingHistory: true, packYears: 20 },
      groundTruth: true,
      expectedSensitivity: true, // Should be caught by high-sensitivity rules
      expectedSpecificity: true
    });

    // Case 12: Large benign nodule
    testCases.push({
      id: "FP01",
      name: "Large Benign Nodule",
      description: "18mm hamartoma - large but benign",
      aiResult: {
        Lung_Cancer: {
          present: true,
          confidence: 65,
          size_mm: 18,
          location: "RLL",
          morphology: "lobulated",
          lesion_type: "solid",
          malignancy_risk: 45
        }
      },
      riskFactors: { age: 52, smokingHistory: false },
      groundTruth: false, // Actually benign
      expectedSensitivity: true, // Will be flagged as high risk
      expectedSpecificity: false // This is a false positive case
    });

    return testCases;
  }

  /**
   * Run validation tests on the detection rules
   */
  static validateDetectionRules(testCases: TestCase[]): ValidationResults {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    const failedCases: string[] = [];

    console.log("🧪 Running High-Sensitivity Detection Rules Validation");
    console.log(`📊 Testing ${testCases.length} cases for 95% sensitivity and 90% specificity targets`);

    for (const testCase of testCases) {
      // Run high-sensitivity detection
      const detectionResult = HighSensitivityNoduleDetector.detectNoduleHighSensitivity(
        testCase.aiResult,
        testCase.riskFactors
      );

      // Run advanced classification if nodule detected
      let classification: NoduleClassification | null = null;
      let stratification: RiskStratification | null = null;
      
      if (detectionResult.isHighRisk || testCase.aiResult.Lung_Cancer?.present) {
        const lungCancer = testCase.aiResult.Lung_Cancer || {};
        classification = AdvancedNoduleClassifier.classifyNodule(
          lungCancer.size_mm || 0,
          lungCancer.morphology || '',
          lungCancer.lesion_type || '',
          lungCancer.location || '',
          lungCancer.malignancy_risk || detectionResult.riskScore,
          testCase.riskFactors.age || 50,
          testCase.riskFactors.smokingHistory || false
        );
        
        stratification = AdvancedNoduleClassifier.stratifyRisk(
          classification,
          lungCancer.size_mm || 0,
          lungCancer.malignancy_risk || detectionResult.riskScore,
          testCase.riskFactors.age || 50,
          testCase.riskFactors.smokingHistory || false,
          testCase.riskFactors.familyHistory || false,
          testCase.riskFactors.previousCancer || false
        );
      }

      const predicted = detectionResult.isHighRisk;
      const actual = testCase.groundTruth;

      // Calculate confusion matrix
      if (predicted && actual) {
        truePositives++;
      } else if (predicted && !actual) {
        falsePositives++;
        failedCases.push(`${testCase.id}: False Positive - ${testCase.name}`);
      } else if (!predicted && actual) {
        falseNegatives++;
        failedCases.push(`${testCase.id}: False Negative - ${testCase.name} (CRITICAL - Missed cancer!)`);
      } else if (!predicted && !actual) {
        trueNegatives++;
      }

      console.log(`   ${testCase.id}: ${predicted ? 'DETECTED' : 'NOT DETECTED'} | Ground Truth: ${actual ? 'CANCER' : 'BENIGN'} | Risk: ${detectionResult.riskScore}% | ${predicted === actual ? '✅' : '❌'}`);
    }

    const totalCases = testCases.length;
    const sensitivity = totalCases > 0 ? (truePositives / (truePositives + falseNegatives)) * 100 : 0;
    const specificity = totalCases > 0 ? (trueNegatives / (trueNegatives + falsePositives)) * 100 : 0;
    const accuracy = totalCases > 0 ? ((truePositives + trueNegatives) / totalCases) * 100 : 0;
    const precision = (truePositives + falsePositives) > 0 ? (truePositives / (truePositives + falsePositives)) * 100 : 0;
    const f1Score = (precision + sensitivity) > 0 ? (2 * (precision * sensitivity) / (precision + sensitivity)) : 0;

    const meetsTargets = sensitivity >= 95 && specificity >= 90;

    console.log("\n📈 VALIDATION RESULTS:");
    console.log(`   True Positives: ${truePositives}`);
    console.log(`   False Positives: ${falsePositives}`);
    console.log(`   True Negatives: ${trueNegatives}`);
    console.log(`   False Negatives: ${falseNegatives}`);
    console.log(`   Sensitivity: ${sensitivity.toFixed(1)}% (Target: ≥95%)`);
    console.log(`   Specificity: ${specificity.toFixed(1)}% (Target: ≥90%)`);
    console.log(`   Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`   Precision: ${precision.toFixed(1)}%`);
    console.log(`   F1-Score: ${f1Score.toFixed(1)}%`);
    console.log(`   🎯 Meets Targets: ${meetsTargets ? '✅ YES' : '❌ NO'}`);

    if (failedCases.length > 0) {
      console.log(`\n⚠️  FAILED CASES (${failedCases.length}):`);
      failedCases.forEach(failure => console.log(`   ${failure}`));
    }

    return {
      totalCases,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      sensitivity,
      specificity,
      accuracy,
      precision,
      f1Score,
      meetsTargets,
      failedCases
    };
  }

  /**
   * Generate comprehensive validation report
   */
  static generateValidationReport(results: ValidationResults): string {
    const report = [];
    
    report.push('=== HIGH-SENSITIVITY LUNG NODULE DETECTION VALIDATION REPORT ===');
    report.push(`Target: 95% Sensitivity, 90% Specificity for Nodule/Mass Detection`);
    report.push('');
    
    report.push('PERFORMANCE METRICS:');
    report.push(`📊 Total Test Cases: ${results.totalCases}`);
    report.push(`✅ True Positives: ${results.truePositives} (Cancers correctly detected)`);
    report.push(`❌ False Negatives: ${results.falseNegatives} (Cancers missed - CRITICAL)`);
    report.push(`✅ True Negatives: ${results.trueNegatives} (Benign correctly identified)`);
    report.push(`⚠️  False Positives: ${results.falsePositives} (Benign flagged as suspicious)`);
    report.push('');
    
    report.push('KEY PERFORMANCE INDICATORS:');
    report.push(`🎯 SENSITIVITY: ${results.sensitivity.toFixed(1)}% (Target: ≥95%) ${results.sensitivity >= 95 ? '✅' : '❌'}`);
    report.push(`🎯 SPECIFICITY: ${results.specificity.toFixed(1)}% (Target: ≥90%) ${results.specificity >= 90 ? '✅' : '❌'}`);
    report.push(`📈 ACCURACY: ${results.accuracy.toFixed(1)}%`);
    report.push(`🎯 PRECISION: ${results.precision.toFixed(1)}%`);
    report.push(`📊 F1-SCORE: ${results.f1Score.toFixed(1)}%`);
    report.push('');
    
    report.push('TARGET ACHIEVEMENT:');
    if (results.meetsTargets) {
      report.push('🎉 SUCCESS: Detection rules meet both sensitivity and specificity targets!');
      report.push('✅ 95% Sensitivity Target: ACHIEVED');
      report.push('✅ 90% Specificity Target: ACHIEVED');
    } else {
      report.push('⚠️  PERFORMANCE GAP: Detection rules do not fully meet targets');
      if (results.sensitivity < 95) {
        report.push(`❌ Sensitivity Gap: ${(95 - results.sensitivity).toFixed(1)}% below target`);
        report.push('   💡 Recommendation: Lower detection thresholds or add more sensitive rules');
      }
      if (results.specificity < 90) {
        report.push(`❌ Specificity Gap: ${(90 - results.specificity).toFixed(1)}% below target`);
        report.push('   💡 Recommendation: Add more specific criteria or refine morphology rules');
      }
    }
    report.push('');
    
    if (results.failedCases.length > 0) {
      report.push('CASES REQUIRING ATTENTION:');
      results.failedCases.forEach((failure, index) => {
        report.push(`${index + 1}. ${failure}`);
      });
      report.push('');
    }
    
    report.push('CLINICAL INTERPRETATION:');
    if (results.sensitivity >= 95) {
      report.push('✅ High Sensitivity: System successfully minimizes missed cancers');
      report.push('   - Excellent at catching early-stage and subtle malignancies');
      report.push('   - Reduces risk of delayed diagnosis');
    } else {
      report.push('⚠️  Sensitivity Concern: Risk of missing some cancers');
      report.push('   - May miss subtle or early-stage malignancies');
      report.push('   - Consider additional detection criteria');
    }
    
    if (results.specificity >= 90) {
      report.push('✅ Good Specificity: System appropriately excludes most benign lesions');
      report.push('   - Reduces unnecessary biopsies and patient anxiety');
      report.push('   - Maintains cost-effectiveness');
    } else {
      report.push('⚠️  Specificity Concern: May generate excessive false positives');
      report.push('   - Risk of unnecessary procedures and patient anxiety');
      report.push('   - May impact healthcare resource utilization');
    }
    
    report.push('');
    report.push('SYSTEM VALIDATION STATUS:');
    report.push(`${results.meetsTargets ? '🎉 VALIDATED' : '⚠️  REQUIRES OPTIMIZATION'}: ${results.meetsTargets ? 'System ready for clinical use' : 'Further tuning recommended'}`);
    
    return report.join('\n');
  }

  /**
   * Run complete validation suite
   */
  static runCompleteValidation(): ValidationResults {
    console.log("🚀 Starting Complete High-Sensitivity Detection Rules Validation");
    
    const testCases = this.generateTestCases();
    const results = this.validateDetectionRules(testCases);
    const report = this.generateValidationReport(results);
    
    console.log("\n" + report);
    
    return results;
  }
}