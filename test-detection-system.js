/**
 * Comprehensive Test for High-Sensitivity Lung Cancer Detection System
 */

// Import the detection modules
const { HighSensitivityNoduleDetector } = require('./server/services/lungCancerDetectionRules.ts');
const { AdvancedNoduleClassifier } = require('./server/services/advancedNoduleClassification.ts');
const { DetectionRulesValidator } = require('./server/services/detectionRulesValidation.ts');

console.log('🧪 Starting Comprehensive Lung Cancer Detection System Test');
console.log('=' .repeat(80));

async function testDetectionSystem() {
  try {
    // Test Case 1: High-Risk Spiculated Mass
    console.log('\n📋 TEST CASE 1: High-Risk Spiculated Mass');
    const testCase1 = {
      Lung_Cancer: {
        present: true,
        confidence: 85,
        size_mm: 18,
        location: "RUL",
        morphology: "spiculated irregular",
        lesion_type: "solid",
        malignancy_risk: 75,
        TNM_stage: "T1c"
      }
    };
    
    const riskFactors1 = {
      age: 65,
      smokingHistory: true,
      packYears: 40
    };
    
    const result1 = HighSensitivityNoduleDetector.detectNoduleHighSensitivity(testCase1, riskFactors1);
    
    console.log(`   Risk Score: ${result1.riskScore}/100`);
    console.log(`   Detection Confidence: ${result1.detectionConfidence}%`);
    console.log(`   High Risk: ${result1.isHighRisk ? 'YES' : 'NO'}`);
    console.log(`   Sensitivity Category: ${result1.sensitivityCategory}`);
    console.log(`   Rules Triggered: ${result1.rulesTriggered.length}`);
    console.log(`   Recommended Action: ${result1.recommendedAction}`);
    
    // Test Case 2: Small Nodule in Low-Risk Patient
    console.log('\n📋 TEST CASE 2: Small Nodule in Low-Risk Patient');
    const testCase2 = {
      Lung_Cancer: {
        present: false,
        confidence: 25,
        size_mm: 4,
        location: "RLL",
        morphology: "smooth well-defined",
        lesion_type: "solid",
        malignancy_risk: 8
      }
    };
    
    const riskFactors2 = {
      age: 35,
      smokingHistory: false
    };
    
    const result2 = HighSensitivityNoduleDetector.detectNoduleHighSensitivity(testCase2, riskFactors2);
    
    console.log(`   Risk Score: ${result2.riskScore}/100`);
    console.log(`   Detection Confidence: ${result2.detectionConfidence}%`);
    console.log(`   High Risk: ${result2.isHighRisk ? 'YES' : 'NO'}`);
    console.log(`   Sensitivity Category: ${result2.sensitivityCategory}`);
    console.log(`   Specificity Flags: ${result2.specificityFlags.length}`);
    
    // Test Case 3: Borderline Case with Multiple Risk Factors
    console.log('\n📋 TEST CASE 3: Borderline Case with Multiple Risk Factors');
    const testCase3 = {
      Lung_Cancer: {
        present: false,
        confidence: 55,
        size_mm: 7,
        location: "LUL",
        morphology: "lobulated",
        lesion_type: "solid",
        malignancy_risk: 45
      }
    };
    
    const riskFactors3 = {
      age: 72,
      smokingHistory: true,
      packYears: 35,
      familyHistory: true,
      previousCancer: true
    };
    
    const result3 = HighSensitivityNoduleDetector.detectNoduleHighSensitivity(testCase3, riskFactors3);
    
    console.log(`   Risk Score: ${result3.riskScore}/100`);
    console.log(`   Detection Confidence: ${result3.detectionConfidence}%`);
    console.log(`   High Risk: ${result3.isHighRisk ? 'YES' : 'NO'}`);
    console.log(`   Rules Triggered: ${result3.rulesTriggered.join(', ')}`);
    
    // Test Advanced Classification
    console.log('\n🔬 ADVANCED CLASSIFICATION TEST');
    if (result1.isHighRisk) {
      const classification = AdvancedNoduleClassifier.classifyNodule(
        18, 'spiculated irregular', 'solid', 'RUL', 75, 65, true
      );
      
      const stratification = AdvancedNoduleClassifier.stratifyRisk(
        classification, 18, 75, 65, true, false, false
      );
      
      console.log(`   Morphological Category: ${classification.morphologicalCategory}`);
      console.log(`   Lung-RADS Category: ${classification.lungRADSCategory}`);
      console.log(`   Malignancy Tier: ${classification.malignancyTier}`);
      console.log(`   Overall Risk: ${stratification.overallRisk}%`);
      console.log(`   Risk Category: ${stratification.riskCategory}`);
      console.log(`   Follow-up Action: ${stratification.followUpRecommendation.action}`);
    }
    
    // Run Validation System
    console.log('\n🎯 VALIDATION SYSTEM TEST');
    console.log('Generating test cases and running validation...');
    
    const testCases = DetectionRulesValidator.generateTestCases();
    console.log(`   Generated ${testCases.length} test cases`);
    
    const validationResults = DetectionRulesValidator.validateDetectionRules(testCases);
    
    console.log('\n📊 VALIDATION RESULTS:');
    console.log(`   Total Cases: ${validationResults.totalCases}`);
    console.log(`   True Positives: ${validationResults.truePositives}`);
    console.log(`   False Positives: ${validationResults.falsePositives}`);
    console.log(`   True Negatives: ${validationResults.trueNegatives}`);
    console.log(`   False Negatives: ${validationResults.falseNegatives}`);
    console.log(`   Sensitivity: ${validationResults.sensitivity.toFixed(1)}% (Target: ≥95%)`);
    console.log(`   Specificity: ${validationResults.specificity.toFixed(1)}% (Target: ≥90%)`);
    console.log(`   Accuracy: ${validationResults.accuracy.toFixed(1)}%`);
    console.log(`   Meets Targets: ${validationResults.meetsTargets ? '✅ YES' : '❌ NO'}`);
    
    if (validationResults.failedCases.length > 0) {
      console.log('\n⚠️  FAILED CASES:');
      validationResults.failedCases.forEach(failure => {
        console.log(`   ${failure}`);
      });
    }
    
    // Performance Summary
    console.log('\n🎉 SYSTEM PERFORMANCE SUMMARY');
    console.log('=' .repeat(50));
    console.log(`SENSITIVITY: ${validationResults.sensitivity.toFixed(1)}% ${validationResults.sensitivity >= 95 ? '✅' : '❌'}`);
    console.log(`SPECIFICITY: ${validationResults.specificity.toFixed(1)}% ${validationResults.specificity >= 90 ? '✅' : '❌'}`);
    console.log(`OVERALL STATUS: ${validationResults.meetsTargets ? '🎉 VALIDATED' : '⚠️  REQUIRES OPTIMIZATION'}`);
    
    // Detailed Report
    const detailedReport = DetectionRulesValidator.generateValidationReport(validationResults);
    console.log('\n📄 DETAILED VALIDATION REPORT:');
    console.log(detailedReport);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the comprehensive test
testDetectionSystem();