/**
 * Comprehensive Test for High-Sensitivity Nodule/Mass Detection System
 */

import { HighSensitivityNoduleDetector, type LungCancerRiskFactors } from './services/lungCancerDetectionRules';
import { AdvancedNoduleClassifier } from './services/advancedNoduleClassification';
import { DetectionRulesValidator } from './services/detectionRulesValidation';

async function runComprehensiveTest() {
  console.log('🧪 COMPREHENSIVE NODULE/MASS DETECTION SYSTEM TEST');
  console.log('=' .repeat(80));

  try {
    // Test Case 1: High-Risk Spiculated Mass (Should be detected)
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
    
    const riskFactors1: LungCancerRiskFactors = {
      age: 65,
      smokingHistory: true,
      packYears: 40
    };
    
    const result1 = HighSensitivityNoduleDetector.detectNoduleHighSensitivity(testCase1, riskFactors1);
    
    console.log(`   Risk Score: ${result1.riskScore}/100`);
    console.log(`   Detection Confidence: ${result1.detectionConfidence}%`);
    console.log(`   High Risk: ${result1.isHighRisk ? '✅ YES' : '❌ NO'}`);
    console.log(`   Sensitivity Category: ${result1.sensitivityCategory.toUpperCase()}`);
    console.log(`   Rules Triggered: ${result1.rulesTriggered.length}`);
    console.log(`   Action: ${result1.recommendedAction}`);

    // Test Case 2: Small Nodule in Low-Risk Patient (Should NOT be flagged)
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
    
    const riskFactors2: LungCancerRiskFactors = {
      age: 35,
      smokingHistory: false
    };
    
    const result2 = HighSensitivityNoduleDetector.detectNoduleHighSensitivity(testCase2, riskFactors2);
    
    console.log(`   Risk Score: ${result2.riskScore}/100`);
    console.log(`   Detection Confidence: ${result2.detectionConfidence}%`);
    console.log(`   High Risk: ${result2.isHighRisk ? '❌ NO' : '✅ NO'} (Expected: NO)`);
    console.log(`   Sensitivity Category: ${result2.sensitivityCategory.toUpperCase()}`);
    console.log(`   Specificity Flags: ${result2.specificityFlags.length}`);

    // Test Case 3: Edge Case - Small size but high-risk patient
    console.log('\n📋 TEST CASE 3: Edge Case - Small Nodule, High-Risk Patient');
    const testCase3 = {
      Lung_Cancer: {
        present: false,
        confidence: 55,
        size_mm: 6,
        location: "LUL",
        morphology: "lobulated",
        lesion_type: "solid",
        malignancy_risk: 35
      }
    };
    
    const riskFactors3: LungCancerRiskFactors = {
      age: 72,
      smokingHistory: true,
      packYears: 45,
      familyHistory: true,
      previousCancer: true
    };
    
    const result3 = HighSensitivityNoduleDetector.detectNoduleHighSensitivity(testCase3, riskFactors3);
    
    console.log(`   Risk Score: ${result3.riskScore}/100`);
    console.log(`   Detection Confidence: ${result3.detectionConfidence}%`);
    console.log(`   High Risk: ${result3.isHighRisk ? '✅ YES' : '❌ NO'} (Expected: YES due to high-risk factors)`);
    console.log(`   Rules Triggered: ${result3.rulesTriggered.slice(0, 3).join(', ')}${result3.rulesTriggered.length > 3 ? '...' : ''}`);

    // Test Advanced Classification System
    console.log('\n🔬 ADVANCED CLASSIFICATION TEST');
    if (result1.isHighRisk) {
      const classification = AdvancedNoduleClassifier.classifyNodule(
        18, 'spiculated irregular', 'solid', 'RUL', 75, 65, true
      );
      
      const stratification = AdvancedNoduleClassifier.stratifyRisk(
        classification, 18, 75, 65, true, false, false
      );
      
      console.log(`   Morphological Category: ${classification.morphologicalCategory.toUpperCase()}`);
      console.log(`   Lung-RADS Category: ${classification.lungRADSCategory}`);
      console.log(`   Malignancy Tier: ${classification.malignancyTier.toUpperCase()}`);
      console.log(`   Overall Risk: ${stratification.overallRisk}%`);
      console.log(`   Risk Category: ${stratification.riskCategory}`);
      console.log(`   Follow-up: ${stratification.followUpRecommendation.action.replace(/_/g, ' ').toUpperCase()}`);
      console.log(`   Timeframe: ${stratification.followUpRecommendation.timeframe}`);
    }

    // Run Full Validation System
    console.log('\n🎯 FULL VALIDATION SYSTEM TEST');
    console.log('Running comprehensive validation with all test cases...');
    
    const validationResults = DetectionRulesValidator.runCompleteValidation();
    
    console.log('\n📊 VALIDATION PERFORMANCE METRICS:');
    console.log(`   Total Test Cases: ${validationResults.totalCases}`);
    console.log(`   True Positives: ${validationResults.truePositives} (Cancers correctly detected)`);
    console.log(`   False Negatives: ${validationResults.falseNegatives} (Cancers missed - CRITICAL!)`);
    console.log(`   True Negatives: ${validationResults.trueNegatives} (Benign correctly identified)`);
    console.log(`   False Positives: ${validationResults.falsePositives} (Benign flagged as suspicious)`);
    
    console.log('\n🎯 TARGET ACHIEVEMENT:');
    console.log(`   SENSITIVITY: ${validationResults.sensitivity.toFixed(1)}% ${validationResults.sensitivity >= 95 ? '✅ ACHIEVED' : '❌ BELOW TARGET'} (Target: ≥95%)`);
    console.log(`   SPECIFICITY: ${validationResults.specificity.toFixed(1)}% ${validationResults.specificity >= 90 ? '✅ ACHIEVED' : '❌ BELOW TARGET'} (Target: ≥90%)`);
    console.log(`   ACCURACY: ${validationResults.accuracy.toFixed(1)}%`);
    console.log(`   PRECISION: ${validationResults.precision.toFixed(1)}%`);
    console.log(`   F1-SCORE: ${validationResults.f1Score.toFixed(1)}%`);
    
    // Overall Assessment
    console.log('\n🏥 CLINICAL ASSESSMENT:');
    if (validationResults.meetsTargets) {
      console.log('   ✅ SYSTEM VALIDATED: Detection rules meet both sensitivity and specificity targets');
      console.log('   ✅ Ready for clinical deployment with high confidence');
      console.log('   ✅ Excellent balance between catching cancers and avoiding false alarms');
    } else {
      console.log('   ⚠️  SYSTEM REQUIRES OPTIMIZATION');
      if (validationResults.sensitivity < 95) {
        console.log(`   ❌ Sensitivity gap: ${(95 - validationResults.sensitivity).toFixed(1)}% below target`);
        console.log('   💡 Risk: May miss some cancers - critical for patient safety');
      }
      if (validationResults.specificity < 90) {
        console.log(`   ❌ Specificity gap: ${(90 - validationResults.specificity).toFixed(1)}% below target`);
        console.log('   💡 Risk: May generate excessive false positives');
      }
    }
    
    // Failed Cases Analysis
    if (validationResults.failedCases.length > 0) {
      console.log('\n⚠️  CASES REQUIRING ATTENTION:');
      validationResults.failedCases.forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure}`);
      });
    }
    
    // Final Status
    console.log('\n' + '=' .repeat(80));
    console.log('🎉 COMPREHENSIVE TEST COMPLETED');
    console.log('=' .repeat(80));
    console.log(`FINAL STATUS: ${validationResults.meetsTargets ? '✅ SYSTEM VALIDATED AND READY' : '⚠️  SYSTEM REQUIRES FURTHER OPTIMIZATION'}`);
    console.log(`NODULE/MASS DETECTION: ${validationResults.meetsTargets ? 'OPTIMIZED FOR 95% SENSITIVITY & 90% SPECIFICITY' : 'TARGETS NOT FULLY ACHIEVED'}`);
    
    return validationResults;
    
  } catch (error) {
    console.error('❌ COMPREHENSIVE TEST FAILED:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  }
}

// Export for potential use in other modules
export { runComprehensiveTest };

// Run the test immediately
runComprehensiveTest()
  .then((results) => {
    console.log('\n✅ Test completed successfully');
    process.exit(results.meetsTargets ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  });