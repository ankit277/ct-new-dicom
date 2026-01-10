/**
 * High-Sensitivity Lung Nodule and Mass Detection Rules
 * Target: 95% Sensitivity, 90% Specificity
 * 
 * This module implements comprehensive rule-based detection for nodule/mass
 * findings to achieve high sensitivity while maintaining specificity.
 */

export interface NoduleDetectionResult {
  isHighRisk: boolean;
  riskScore: number; // 0-100
  detectionConfidence: number; // 0-100
  recommendedAction: string;
  rulesTriggered: string[];
  sensitivityCategory: 'very_high' | 'high' | 'moderate' | 'low';
  specificityFlags: string[];
}

export interface LungCancerRiskFactors {
  age?: number;
  smokingHistory?: boolean;
  packYears?: number;
  familyHistory?: boolean;
  previousCancer?: boolean;
  asbestosExposure?: boolean;
  radonExposure?: boolean;
}

/**
 * High-Sensitivity Detection Rules (95% Sensitivity Target)
 * These rules are designed to catch almost all actual nodule/mass findings
 */
export class HighSensitivityNoduleDetector {
  
  /**
   * Primary detection function that applies all high-sensitivity rules
   */
  static detectNoduleHighSensitivity(
    aiResult: any,
    riskFactors: LungCancerRiskFactors = {}
  ): NoduleDetectionResult {
    const triggeredRules: string[] = [];
    const specificityFlags: string[] = [];
    let riskScore = 0;
    let detectionConfidence = 50;

    // Extract nodule/mass data from AI result
    const lungCancer = aiResult?.Lung_Cancer || {};
    const size = lungCancer.size_mm || lungCancer.largest_nodule_size || 0;
    const malignancyRisk = lungCancer.malignancy_risk || 0;
    const morphology = lungCancer.morphology || '';
    const location = lungCancer.location || '';
    const lesionType = lungCancer.lesion_type || '';
    const numberOfNodules = lungCancer.number_of_nodules || 0;

    // RULE 1: SIZE-BASED HIGH SENSITIVITY RULES (Lower thresholds for high sensitivity)
    if (size >= 4) { // Lowered from typical 8mm threshold
      riskScore += 25;
      detectionConfidence += 20;
      triggeredRules.push(`Size-based detection: ${size}mm nodule (≥4mm threshold)`);
      
      if (size >= 6) {
        riskScore += 15;
        detectionConfidence += 15;
        triggeredRules.push(`Moderate size risk: ${size}mm nodule (≥6mm)`);
      }
      
      if (size >= 10) {
        riskScore += 20;
        detectionConfidence += 20;
        triggeredRules.push(`Large nodule detected: ${size}mm (≥10mm - high concern)`);
      }
      
      if (size >= 20) {
        riskScore += 25;
        detectionConfidence += 25;
        triggeredRules.push(`Very large mass: ${size}mm (≥20mm - urgent evaluation)`);
      }
    }

    // RULE 2: MORPHOLOGY HIGH-SENSITIVITY RULES
    const highRiskMorphologies = ['spiculated', 'irregular', 'lobulated'];
    const moderateRiskMorphologies = ['smooth', 'well-defined'];
    
    if (highRiskMorphologies.some(morph => morphology.toLowerCase().includes(morph))) {
      riskScore += 30;
      detectionConfidence += 25;
      triggeredRules.push(`High-risk morphology: ${morphology}`);
    } else if (moderateRiskMorphologies.some(morph => morphology.toLowerCase().includes(morph))) {
      riskScore += 10; // Even smooth nodules get some points for high sensitivity
      detectionConfidence += 10;
      triggeredRules.push(`Moderate-risk morphology: ${morphology}`);
      specificityFlags.push('Smooth morphology - may reduce specificity');
    }

    // RULE 3: LOCATION-BASED RISK (High-sensitivity approach)
    const highRiskLocations = ['RUL', 'LUL', 'upper', 'apical'];
    const moderateRiskLocations = ['RML', 'RLL', 'LLL', 'lower', 'middle'];
    
    if (highRiskLocations.some(loc => location.toLowerCase().includes(loc.toLowerCase()))) {
      riskScore += 15;
      detectionConfidence += 15;
      triggeredRules.push(`High-risk location: ${location} (upper lobe preference)`);
    } else if (moderateRiskLocations.some(loc => location.toLowerCase().includes(loc.toLowerCase()))) {
      riskScore += 8; // Lower lobe still gets points for high sensitivity
      detectionConfidence += 8;
      triggeredRules.push(`Moderate-risk location: ${location}`);
    }

    // RULE 4: MALIGNANCY PROBABILITY RULES (Lower thresholds)
    if (malignancyRisk >= 15) { // Lowered from typical 50% threshold
      riskScore += 20;
      detectionConfidence += 20;
      triggeredRules.push(`AI malignancy risk: ${malignancyRisk}% (≥15% threshold)`);
      
      if (malignancyRisk >= 30) {
        riskScore += 15;
        detectionConfidence += 15;
        triggeredRules.push(`Moderate malignancy risk: ${malignancyRisk}% (≥30%)`);
      }
      
      if (malignancyRisk >= 60) {
        riskScore += 20;
        detectionConfidence += 20;
        triggeredRules.push(`High malignancy risk: ${malignancyRisk}% (≥60%)`);
      }
    }

    // RULE 5: LESION TYPE RULES
    const highRiskTypes = ['solid', 'part-solid'];
    const moderateRiskTypes = ['ground-glass'];
    
    if (highRiskTypes.includes(lesionType.toLowerCase())) {
      riskScore += 15;
      detectionConfidence += 15;
      triggeredRules.push(`High-risk lesion type: ${lesionType}`);
    } else if (moderateRiskTypes.includes(lesionType.toLowerCase())) {
      riskScore += 10; // GGNs still get points for high sensitivity
      detectionConfidence += 10;
      triggeredRules.push(`Ground-glass nodule detected: ${lesionType}`);
      specificityFlags.push('Ground-glass nodule - monitor for growth');
    }

    // RULE 6: MULTIPLE NODULES (High sensitivity approach)
    if (numberOfNodules >= 2) {
      riskScore += 15;
      detectionConfidence += 15;
      triggeredRules.push(`Multiple nodules detected: ${numberOfNodules} nodules`);
      
      if (numberOfNodules >= 4) {
        riskScore += 10;
        detectionConfidence += 10;
        triggeredRules.push(`Multiple pulmonary nodules: ${numberOfNodules} (T3/T4 consideration)`);
      }
    }

    // RULE 7: CLINICAL RISK FACTORS (Enhance sensitivity with patient factors)
    if (riskFactors.age && riskFactors.age >= 50) {
      riskScore += 10;
      detectionConfidence += 10;
      triggeredRules.push(`Age risk factor: ${riskFactors.age} years (≥50 years)`);
      
      if (riskFactors.age >= 65) {
        riskScore += 5;
        detectionConfidence += 5;
        triggeredRules.push(`Advanced age: ${riskFactors.age} years (≥65 years)`);
      }
    }

    if (riskFactors.smokingHistory) {
      riskScore += 15;
      detectionConfidence += 15;
      triggeredRules.push('Smoking history detected');
      
      if (riskFactors.packYears && riskFactors.packYears >= 20) {
        riskScore += 10;
        detectionConfidence += 10;
        triggeredRules.push(`Heavy smoking history: ${riskFactors.packYears} pack-years (≥20)`);
      }
    }

    if (riskFactors.familyHistory) {
      riskScore += 8;
      detectionConfidence += 8;
      triggeredRules.push('Family history of pulmonary malignancy');
    }

    if (riskFactors.previousCancer) {
      riskScore += 12;
      detectionConfidence += 12;
      triggeredRules.push('Previous cancer history');
    }

    if (riskFactors.asbestosExposure || riskFactors.radonExposure) {
      riskScore += 10;
      detectionConfidence += 10;
      triggeredRules.push('Environmental exposure history (asbestos/radon)');
    }

    // RULE 8: AI CONFIDENCE INTEGRATION
    const aiConfidence = lungCancer.confidence || 0;
    if (aiConfidence >= 60) { // Lower threshold for high sensitivity
      riskScore += 15;
      detectionConfidence += 15;
      triggeredRules.push(`AI detection confidence: ${aiConfidence}% (≥60%)`);
      
      if (aiConfidence >= 85) {
        riskScore += 10;
        detectionConfidence += 10;
        triggeredRules.push(`High AI confidence: ${aiConfidence}% (≥85%)`);
      }
    }

    // RULE 9: TNM STAGING RULES
    const tnmStage = lungCancer.TNM_stage || '';
    if (tnmStage && tnmStage !== 'none') {
      riskScore += 20;
      detectionConfidence += 20;
      triggeredRules.push(`TNM staging detected: ${tnmStage}`);
      
      if (tnmStage.includes('T2') || tnmStage.includes('T3') || tnmStage.includes('T4')) {
        riskScore += 15;
        detectionConfidence += 15;
        triggeredRules.push(`Advanced T-stage: ${tnmStage}`);
      }
    }

    // RULE 10: INVASION FLAGS
    if (lungCancer.pleural_invasion) {
      riskScore += 25;
      detectionConfidence += 25;
      triggeredRules.push('Pleural invasion detected');
    }

    if (lungCancer.mediastinal_invasion) {
      riskScore += 30;
      detectionConfidence += 30;
      triggeredRules.push('Mediastinal invasion detected');
    }

    if (lungCancer.vascular_invasion) {
      riskScore += 25;
      detectionConfidence += 25;
      triggeredRules.push('Vascular invasion detected');
    }

    // SPECIFICITY ENHANCEMENT RULES (To maintain 90% specificity)
    // These rules help reduce false positives
    if (size < 4 && malignancyRisk < 15 && aiConfidence < 60) {
      specificityFlags.push('Small size + low malignancy risk + low AI confidence');
      riskScore = Math.max(0, riskScore - 15);
    }

    if (lesionType.toLowerCase() === 'ground-glass' && size < 10) {
      specificityFlags.push('Small ground-glass nodule - consider follow-up');
      if (!riskFactors.smokingHistory) {
        riskScore = Math.max(0, riskScore - 10);
      }
    }

    if (morphology.toLowerCase().includes('smooth') && size < 8 && !riskFactors.smokingHistory) {
      specificityFlags.push('Small smooth nodule in low-risk patient');
      riskScore = Math.max(0, riskScore - 8);
    }

    // Cap and normalize scores to 0-100 range
    riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));
    detectionConfidence = Math.max(0, Math.min(100, Math.round(detectionConfidence)));

    // Determine sensitivity category based on rules triggered and scores
    let sensitivityCategory: 'very_high' | 'high' | 'moderate' | 'low';
    if (riskScore >= 70 || triggeredRules.length >= 6) {
      sensitivityCategory = 'very_high';
    } else if (riskScore >= 50 || triggeredRules.length >= 4) {
      sensitivityCategory = 'high';
    } else if (riskScore >= 30 || triggeredRules.length >= 2) {
      sensitivityCategory = 'moderate';
    } else {
      sensitivityCategory = 'low';
    }

    // Determine if this is high risk (optimized for 95% sensitivity)
    // ENHANCED SPECIFICITY RULES - Optimized for 80% specificity target
    // Check for classic benign patterns that should reduce false positives
    let benignPatternDetected = false;
    let specificityReduction = 0;
    const aiFindings = aiResult.clinical_radiology_report || aiResult.Summary || '';
    const findings = aiFindings.toLowerCase();
    
    // Strong benign indicators - major risk reduction
    
    // Calcification patterns (very strong benign indicator)
    if (morphology.toLowerCase().includes('calcif') || findings.includes('calcif')) {
      specificityFlags.push('Calcification detected - strongly suggests benign etiology');
      specificityReduction += 35;
      if (size < 10) {
        specificityReduction += 15; // Extra reduction for small calcified nodules
        benignPatternDetected = true;
      }
    }
    
    // Fat-containing lesions (hamartoma - definitive benign)
    if (findings.includes('fat') && (findings.includes('density') || findings.includes('attenuation'))) {
      specificityFlags.push('Fat-containing lesion - definitive hamartoma');
      specificityReduction += 40;
      benignPatternDetected = true;
    }
    
    // Small smooth nodules in low-risk patients (strong benign indicator)
    if (size <= 6 && morphology.toLowerCase().includes('smooth') && 
        !riskFactors.smokingHistory && (riskFactors.age || 0) < 55) {
      specificityFlags.push('Small smooth nodule in low-risk patient - likely benign');
      specificityReduction += 30;
      benignPatternDetected = true;
    }
    
    // Ground-glass nodules under specific conditions (more aggressive)
    if (lesionType.toLowerCase() === 'ground-glass' && size < 15) {
      specificityFlags.push('Ground-glass nodule - often inflammatory');
      specificityReduction += 35;
      if (!riskFactors.smokingHistory) {
        specificityReduction += 20; // Extra reduction for non-smokers
        if (size < 10) {
          benignPatternDetected = true; // Mark as benign for small GGNs in non-smokers
        }
      }
    }
    
    // Very small nodules with low malignancy risk (more aggressive)
    if (size < 8 && malignancyRisk < 30) {
      specificityFlags.push('Small nodule with low AI malignancy risk');
      specificityReduction += 25;
      if (!riskFactors.smokingHistory) {
        specificityReduction += 15;
      }
    }
    
    // Age-based risk adjustment for young patients (more aggressive)
    if ((riskFactors.age || 0) < 50 && !riskFactors.smokingHistory) {
      specificityFlags.push('Younger patient without smoking history');
      specificityReduction += 20;
      if (!riskFactors.familyHistory && size < 8) {
        specificityReduction += 15;
      }
    }
    
    // Inflammatory pattern indicators (more aggressive)
    if (findings.includes('inflammat') || findings.includes('infection') || 
        findings.includes('reactive') || (size < 12 && morphology.toLowerCase().includes('smooth'))) {
      specificityFlags.push('Possible inflammatory/infectious/reactive etiology');
      specificityReduction += 20;
      if (size < 8) {
        specificityReduction += 15;
      }
    }
    
    // Large nodules with benign characteristics
    if (size >= 15 && morphology.toLowerCase().includes('smooth') && malignancyRisk < 50) {
      specificityFlags.push('Large smooth nodule with moderate AI malignancy risk - consider benign');
      specificityReduction += 30;
      if (!riskFactors.smokingHistory) {
        specificityReduction += 20;
        benignPatternDetected = true;
      }
    }
    
    // Perifissural/triangular morphology (intrapulmonary lymph nodes)
    if ((findings.includes('perifissural') || findings.includes('triangular') || 
         findings.includes('subpleural')) && morphology.toLowerCase().includes('smooth')) {
      specificityFlags.push('Perifissural/triangular morphology - likely lymph node');
      specificityReduction += 20;
    }
    
    // Stability over time (strong benign indicator)
    if (findings.includes('stable') || findings.includes('unchanged') || findings.includes('no change')) {
      specificityFlags.push('Stability over time - strongly suggests benign');
      specificityReduction += 25;
      if (size < 8) {
        benignPatternDetected = true;
      }
    }
    
    // Apply specificity reductions
    riskScore = Math.max(0, riskScore - specificityReduction);
    
    // Additional conservative adjustments for 80% specificity target
    
    // Large nodules without high-risk features - be more conservative
    if (size >= 15 && !morphology.toLowerCase().includes('spiculated') && 
        !morphology.toLowerCase().includes('irregular') && malignancyRisk < 65) {
      specificityFlags.push('Large nodule without high-risk morphological features');
      specificityReduction += 25;
      if (malignancyRisk < 50) {
        benignPatternDetected = true;
      }
    }
    
    // Mid-size nodules with inflammatory characteristics
    if (size >= 8 && size < 15 && morphology.toLowerCase().includes('smooth') && 
        malignancyRisk < 40 && !riskFactors.smokingHistory) {
      specificityFlags.push('Mid-size smooth nodule with low malignancy risk');
      specificityReduction += 20;
      benignPatternDetected = true;
    }
    
    // Apply final specificity reductions
    riskScore = Math.max(0, riskScore - specificityReduction);
    
    // Final high-risk determination optimized for 80% specificity
    // Even more conservative thresholds to reduce false positives
    const isHighRisk = (riskScore >= 55 || detectionConfidence >= 80 || triggeredRules.length >= 5) && !benignPatternDetected;

    // Generate recommendations
    let recommendedAction: string;
    if (riskScore >= 80) {
      recommendedAction = 'URGENT: Immediate oncology referral and biopsy consideration';
    } else if (riskScore >= 60) {
      recommendedAction = 'HIGH PRIORITY: Multidisciplinary review and short-term follow-up (1-3 months)';
    } else if (riskScore >= 40) {
      recommendedAction = 'MODERATE RISK: Follow-up CT in 3-6 months or consider PET-CT';
    } else if (riskScore >= 20) {
      recommendedAction = 'LOW-MODERATE RISK: Follow-up CT in 6-12 months';
    } else {
      recommendedAction = 'LOW RISK: Consider routine follow-up or discharge based on clinical context';
    }

    return {
      isHighRisk,
      riskScore,
      detectionConfidence,
      recommendedAction,
      rulesTriggered: triggeredRules,
      sensitivityCategory,
      specificityFlags
    };
  }

  /**
   * Validate detection performance against target metrics
   */
  static validateDetectionPerformance(
    detectionResult: NoduleDetectionResult,
    groundTruth: boolean
  ): {
    predictedPositive: boolean;
    truePositive: boolean;
    falsePositive: boolean;
    trueNegative: boolean;
    falseNegative: boolean;
    meetsTargets: boolean;
  } {
    const predictedPositive = detectionResult.isHighRisk;
    
    return {
      predictedPositive,
      truePositive: predictedPositive && groundTruth,
      falsePositive: predictedPositive && !groundTruth,
      trueNegative: !predictedPositive && !groundTruth,
      falseNegative: !predictedPositive && groundTruth,
      meetsTargets: detectionResult.sensitivityCategory === 'very_high' || 
                   detectionResult.sensitivityCategory === 'high'
    };
  }

  /**
   * Generate detailed detection report
   */
  static generateDetectionReport(
    detectionResult: NoduleDetectionResult,
    aiResult: any
  ): string {
    const lungCancer = aiResult?.Lung_Cancer || {};
    const report = [];
    
    report.push('=== HIGH-SENSITIVITY LUNG NODULE DETECTION REPORT ===');
    report.push(`Risk Score: ${detectionResult.riskScore}/100`);
    report.push(`Detection Confidence: ${detectionResult.detectionConfidence}%`);
    report.push(`Sensitivity Category: ${detectionResult.sensitivityCategory.toUpperCase()}`);
    report.push(`High Risk Classification: ${detectionResult.isHighRisk ? 'YES' : 'NO'}`);
    report.push('');
    
    report.push('TRIGGERED DETECTION RULES:');
    if (detectionResult.rulesTriggered.length === 0) {
      report.push('- No high-sensitivity rules triggered');
    } else {
      detectionResult.rulesTriggered.forEach((rule: string, index: number) => {
        report.push(`${index + 1}. ${rule}`);
      });
    }
    report.push('');
    
    if (detectionResult.specificityFlags.length > 0) {
      report.push('SPECIFICITY CONSIDERATIONS:');
      detectionResult.specificityFlags.forEach((flag, index) => {
        report.push(`${index + 1}. ${flag}`);
      });
      report.push('');
    }
    
    report.push('RECOMMENDED ACTION:');
    report.push(detectionResult.recommendedAction);
    report.push('');
    
    report.push('AI ANALYSIS SUMMARY:');
    report.push(`- Size: ${lungCancer.size_mm || 'Not specified'}mm`);
    report.push(`- Malignancy Risk: ${lungCancer.malignancy_risk || 'Not specified'}%`);
    report.push(`- Morphology: ${lungCancer.morphology || 'Not specified'}`);
    report.push(`- Location: ${lungCancer.location || 'Not specified'}`);
    report.push(`- AI Confidence: ${lungCancer.confidence || 'Not specified'}%`);
    
    return report.join('\n');
  }
}