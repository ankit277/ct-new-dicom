/**
 * Advanced Lung Nodule Classification and Risk Stratification System
 * Enhanced classification logic for comprehensive nodule analysis
 */

export interface NoduleClassification {
  // Morphological Classification
  morphologicalCategory: 'solid' | 'subsolid' | 'ground-glass' | 'mixed' | 'cavitary';
  spiculationScore: number; // 0-5 scale
  marginDefinition: 'well-defined' | 'ill-defined' | 'lobulated' | 'spiculated';
  
  // Size-based Classification (Lung-RADS)
  lungRADSCategory: '1' | '2' | '3' | '4A' | '4B' | '4X';
  sizeCategory: 'minimal' | 'small' | 'intermediate' | 'large' | 'mass';
  
  // Location Risk Assessment
  locationRisk: 'high' | 'moderate' | 'low';
  anatomicalZone: 'upper' | 'middle' | 'lower' | 'mediastinal' | 'pleural';
  
  // Growth Characteristics
  growthPotential: 'high' | 'moderate' | 'low' | 'indeterminate';
  volumeDoublingTime: number | null; // in days
  
  // Malignancy Risk Stratification
  malignancyTier: 'very-high' | 'high' | 'intermediate' | 'low' | 'very-low';
  riskPercentile: number; // 0-100
}

export interface FollowUpRecommendation {
  action: 'immediate_biopsy' | 'pet_ct' | 'short_term_followup' | 'routine_followup' | 'discharge';
  timeframe: string;
  additionalStudies: string[];
  urgencyLevel: 'urgent' | 'high' | 'moderate' | 'routine';
  specialistReferral: boolean;
}

export interface RiskStratification {
  overallRisk: number; // 0-100
  riskFactors: {
    size: number;
    morphology: number;
    location: number;
    demographics: number;
    clinical: number;
  };
  riskCategory: 'Category-1' | 'Category-2' | 'Category-3' | 'Category-4A' | 'Category-4B' | 'Category-5';
  followUpRecommendation: FollowUpRecommendation;
}

export class AdvancedNoduleClassifier {
  
  /**
   * Comprehensive nodule classification using multiple parameters
   */
  static classifyNodule(
    size: number,
    morphology: string,
    lesionType: string,
    location: string,
    malignancyRisk: number,
    patientAge: number,
    smokingHistory: boolean
  ): NoduleClassification {
    
    // Morphological Classification
    const morphologicalCategory = this.determineMorphologicalCategory(lesionType, morphology);
    const spiculationScore = this.calculateSpiculationScore(morphology);
    const marginDefinition = this.determineMarginDefinition(morphology);
    
    // Size-based Lung-RADS Classification
    const lungRADSCategory = this.determineLungRADS(size, morphologicalCategory, malignancyRisk);
    const sizeCategory = this.determineSizeCategory(size);
    
    // Location Risk Assessment
    const locationRisk = this.assessLocationRisk(location, smokingHistory);
    const anatomicalZone = this.determineAnatomicalZone(location);
    
    // Growth Characteristics Assessment
    const growthPotential = this.assessGrowthPotential(size, morphologicalCategory, malignancyRisk);
    const volumeDoublingTime = this.estimateVolumeDoublingTime(growthPotential, morphologicalCategory);
    
    // Malignancy Risk Stratification
    const malignancyTier = this.determineMalignancyTier(malignancyRisk, size, morphology, patientAge, smokingHistory);
    const riskPercentile = this.calculateRiskPercentile(malignancyRisk, size, spiculationScore, patientAge, smokingHistory);
    
    return {
      morphologicalCategory,
      spiculationScore,
      marginDefinition,
      lungRADSCategory,
      sizeCategory,
      locationRisk,
      anatomicalZone,
      growthPotential,
      volumeDoublingTime,
      malignancyTier,
      riskPercentile
    };
  }

  /**
   * Generate comprehensive risk stratification
   */
  static stratifyRisk(
    classification: NoduleClassification,
    size: number,
    malignancyRisk: number,
    patientAge: number,
    smokingHistory: boolean,
    familyHistory: boolean,
    previousCancer: boolean
  ): RiskStratification {
    
    // Calculate individual risk factor scores
    const sizeRisk = this.calculateSizeRisk(size);
    const morphologyRisk = this.calculateMorphologyRisk(classification.spiculationScore, classification.marginDefinition);
    const locationRisk = this.calculateLocationRisk(classification.locationRisk);
    const demographicsRisk = this.calculateDemographicsRisk(patientAge, smokingHistory);
    const clinicalRisk = this.calculateClinicalRisk(familyHistory, previousCancer);
    
    // Weighted overall risk calculation
    const overallRisk = Math.min(100, Math.round(
      sizeRisk * 0.25 +
      morphologyRisk * 0.30 +
      locationRisk * 0.15 +
      demographicsRisk * 0.20 +
      clinicalRisk * 0.10 +
      malignancyRisk * 0.20  // AI malignancy risk as additional factor
    ));
    
    // Determine risk category based on overall risk and specific criteria
    const riskCategory = this.determineRiskCategory(overallRisk, size, classification.lungRADSCategory);
    
    // Generate follow-up recommendations
    const followUpRecommendation = this.generateFollowUpRecommendation(
      riskCategory,
      overallRisk,
      size,
      classification.growthPotential
    );
    
    return {
      overallRisk,
      riskFactors: {
        size: sizeRisk,
        morphology: morphologyRisk,
        location: locationRisk,
        demographics: demographicsRisk,
        clinical: clinicalRisk
      },
      riskCategory,
      followUpRecommendation
    };
  }

  // Private helper methods for classification logic

  private static determineMorphologicalCategory(lesionType: string, morphology: string): NoduleClassification['morphologicalCategory'] {
    const type = lesionType.toLowerCase();
    const morph = morphology.toLowerCase();
    
    if (type.includes('cavitary') || morph.includes('cavit')) return 'cavitary';
    if (type.includes('ground-glass') || type.includes('ggn')) return 'ground-glass';
    if (type.includes('part-solid') || type.includes('subsolid')) return 'subsolid';
    if (type.includes('mixed')) return 'mixed';
    return 'solid';
  }

  private static calculateSpiculationScore(morphology: string): number {
    const morph = morphology.toLowerCase();
    if (morph.includes('highly spiculated') || morph.includes('corona radiata')) return 5;
    if (morph.includes('spiculated') || morph.includes('irregular')) return 4;
    if (morph.includes('lobulated') || morph.includes('notched')) return 3;
    if (morph.includes('slightly irregular')) return 2;
    if (morph.includes('smooth') || morph.includes('well-defined')) return 1;
    return 2; // default moderate score
  }

  private static determineMarginDefinition(morphology: string): NoduleClassification['marginDefinition'] {
    const morph = morphology.toLowerCase();
    if (morph.includes('spiculated')) return 'spiculated';
    if (morph.includes('lobulated')) return 'lobulated';
    if (morph.includes('ill-defined') || morph.includes('irregular')) return 'ill-defined';
    return 'well-defined';
  }

  private static determineLungRADS(size: number, morphology: NoduleClassification['morphologicalCategory'], malignancyRisk: number): NoduleClassification['lungRADSCategory'] {
    // Lung-RADS v1.1 criteria implementation
    
    if (size < 6 && morphology === 'solid') return '2';
    if (size >= 6 && size < 8 && morphology === 'solid') return '3';
    if (size >= 8 && size < 15 && morphology === 'solid') return '4A';
    if (size >= 15 && morphology === 'solid') return '4B';
    
    // Subsolid nodules
    if (morphology === 'ground-glass') {
      if (size < 20) return '2';
      if (size >= 20) return '3';
    }
    
    if (morphology === 'subsolid' || morphology === 'mixed') {
      if (size < 6) return '2';
      if (size >= 6) return '4A';
    }
    
    // High malignancy risk override
    if (malignancyRisk >= 80) return '4B';
    if (malignancyRisk >= 60) return '4A';
    
    // Cavitary or highly suspicious features
    if (morphology === 'cavitary') return '4A';
    
    return '2'; // default
  }

  private static determineSizeCategory(size: number): NoduleClassification['sizeCategory'] {
    if (size < 4) return 'minimal';
    if (size < 8) return 'small';
    if (size < 20) return 'intermediate';
    if (size < 30) return 'large';
    return 'mass';
  }

  private static assessLocationRisk(location: string, smokingHistory: boolean): NoduleClassification['locationRisk'] {
    const loc = location.toLowerCase();
    
    // Upper lobe predilection for nodule/mass, especially with smoking
    if ((loc.includes('upper') || loc.includes('rul') || loc.includes('lul')) && smokingHistory) {
      return 'high';
    }
    
    if (loc.includes('upper') || loc.includes('rul') || loc.includes('lul')) {
      return 'moderate';
    }
    
    return 'low';
  }

  private static determineAnatomicalZone(location: string): NoduleClassification['anatomicalZone'] {
    const loc = location.toLowerCase();
    if (loc.includes('upper') || loc.includes('rul') || loc.includes('lul')) return 'upper';
    if (loc.includes('middle') || loc.includes('rml')) return 'middle';
    if (loc.includes('lower') || loc.includes('rll') || loc.includes('lll')) return 'lower';
    if (loc.includes('mediastin')) return 'mediastinal';
    if (loc.includes('pleural')) return 'pleural';
    return 'upper'; // default
  }

  private static assessGrowthPotential(size: number, morphology: NoduleClassification['morphologicalCategory'], malignancyRisk: number): NoduleClassification['growthPotential'] {
    // Higher growth potential for solid nodules with high malignancy risk
    if (morphology === 'solid' && malignancyRisk >= 70 && size >= 8) return 'high';
    if (morphology === 'subsolid' && malignancyRisk >= 60) return 'high';
    if (morphology === 'solid' && malignancyRisk >= 50) return 'moderate';
    if (morphology === 'ground-glass' && size < 10) return 'low';
    return 'indeterminate';
  }

  private static estimateVolumeDoublingTime(growthPotential: NoduleClassification['growthPotential'], morphology: NoduleClassification['morphologicalCategory']): number | null {
    // Estimated volume doubling times based on morphology and growth potential
    if (growthPotential === 'high') {
      return morphology === 'solid' ? 150 : 200; // days
    }
    if (growthPotential === 'moderate') {
      return morphology === 'solid' ? 300 : 400; // days
    }
    if (growthPotential === 'low') {
      return morphology === 'solid' ? 600 : 800; // days
    }
    return null; // indeterminate
  }

  private static determineMalignancyTier(malignancyRisk: number, size: number, morphology: string, age: number, smokingHistory: boolean): NoduleClassification['malignancyTier'] {
    let score = malignancyRisk;
    
    // Size adjustments
    if (size >= 20) score += 15;
    else if (size >= 10) score += 10;
    else if (size >= 6) score += 5;
    
    // Morphology adjustments
    if (morphology.toLowerCase().includes('spiculated')) score += 20;
    else if (morphology.toLowerCase().includes('irregular')) score += 10;
    
    // Demographics adjustments
    if (age >= 65 && smokingHistory) score += 15;
    else if (age >= 50 && smokingHistory) score += 10;
    else if (smokingHistory) score += 8;
    
    if (score >= 85) return 'very-high';
    if (score >= 70) return 'high';
    if (score >= 40) return 'intermediate';
    if (score >= 20) return 'low';
    return 'very-low';
  }

  private static calculateRiskPercentile(malignancyRisk: number, size: number, spiculationScore: number, age: number, smokingHistory: boolean): number {
    let percentile = malignancyRisk;
    
    // Size contribution
    percentile += (size / 30) * 20; // Scale to 20 points max
    
    // Spiculation contribution
    percentile += spiculationScore * 4; // Scale to 20 points max
    
    // Demographics contribution
    if (age >= 65) percentile += 15;
    else if (age >= 50) percentile += 10;
    
    if (smokingHistory) percentile += 10;
    
    return Math.min(100, Math.round(percentile));
  }

  // Risk calculation methods

  private static calculateSizeRisk(size: number): number {
    if (size >= 30) return 100;
    if (size >= 20) return 85;
    if (size >= 15) return 70;
    if (size >= 10) return 55;
    if (size >= 8) return 40;
    if (size >= 6) return 25;
    if (size >= 4) return 15;
    return 5;
  }

  private static calculateMorphologyRisk(spiculationScore: number, marginDefinition: NoduleClassification['marginDefinition']): number {
    let risk = spiculationScore * 15; // 0-75 range
    
    if (marginDefinition === 'spiculated') risk += 20;
    else if (marginDefinition === 'lobulated') risk += 15;
    else if (marginDefinition === 'ill-defined') risk += 10;
    
    return Math.min(100, risk);
  }

  private static calculateLocationRisk(locationRisk: NoduleClassification['locationRisk']): number {
    switch (locationRisk) {
      case 'high': return 80;
      case 'moderate': return 50;
      case 'low': return 20;
      default: return 35;
    }
  }

  private static calculateDemographicsRisk(age: number, smokingHistory: boolean): number {
    let risk = 0;
    
    // Age risk
    if (age >= 75) risk += 30;
    else if (age >= 65) risk += 25;
    else if (age >= 55) risk += 20;
    else if (age >= 45) risk += 15;
    else risk += 5;
    
    // Smoking risk
    if (smokingHistory) risk += 40;
    
    return Math.min(100, risk);
  }

  private static calculateClinicalRisk(familyHistory: boolean, previousCancer: boolean): number {
    let risk = 0;
    if (familyHistory) risk += 20;
    if (previousCancer) risk += 30;
    return Math.min(100, risk);
  }

  private static determineRiskCategory(overallRisk: number, size: number, lungRADS: NoduleClassification['lungRADSCategory']): RiskStratification['riskCategory'] {
    // High risk criteria override
    if (overallRisk >= 80 || size >= 20 || lungRADS === '4B') return 'Category-5';
    if (overallRisk >= 60 || lungRADS === '4A') return 'Category-4B';
    if (overallRisk >= 40 || lungRADS === '3') return 'Category-4A';
    if (overallRisk >= 20 || lungRADS === '2') return 'Category-3';
    if (overallRisk >= 10) return 'Category-2';
    return 'Category-1';
  }

  private static generateFollowUpRecommendation(
    riskCategory: RiskStratification['riskCategory'],
    overallRisk: number,
    size: number,
    growthPotential: NoduleClassification['growthPotential']
  ): FollowUpRecommendation {
    
    switch (riskCategory) {
      case 'Category-5':
        return {
          action: 'immediate_biopsy',
          timeframe: 'Within 1-2 weeks',
          additionalStudies: ['PET-CT', 'Tissue sampling', 'Staging workup'],
          urgencyLevel: 'urgent',
          specialistReferral: true
        };
        
      case 'Category-4B':
        return {
          action: 'pet_ct',
          timeframe: 'Within 1 month',
          additionalStudies: ['PET-CT', 'Multidisciplinary review'],
          urgencyLevel: 'high',
          specialistReferral: true
        };
        
      case 'Category-4A':
        return {
          action: 'short_term_followup',
          timeframe: '3 months',
          additionalStudies: ['Repeat CT', 'Consider PET-CT if growth'],
          urgencyLevel: 'moderate',
          specialistReferral: false
        };
        
      case 'Category-3':
        return {
          action: 'routine_followup',
          timeframe: '6 months',
          additionalStudies: ['Repeat CT'],
          urgencyLevel: 'routine',
          specialistReferral: false
        };
        
      case 'Category-2':
        return {
          action: 'routine_followup',
          timeframe: '12 months',
          additionalStudies: ['Annual CT if high risk patient'],
          urgencyLevel: 'routine',
          specialistReferral: false
        };
        
      default:
        return {
          action: 'discharge',
          timeframe: 'No routine follow-up required',
          additionalStudies: ['Return if symptoms develop'],
          urgencyLevel: 'routine',
          specialistReferral: false
        };
    }
  }

  /**
   * Generate comprehensive classification report
   */
  static generateClassificationReport(
    classification: NoduleClassification,
    riskStratification: RiskStratification
  ): string {
    const report = [];
    
    report.push('=== ADVANCED NODULE CLASSIFICATION REPORT ===');
    report.push('');
    
    report.push('MORPHOLOGICAL ANALYSIS:');
    report.push(`- Category: ${classification.morphologicalCategory.toUpperCase()}`);
    report.push(`- Margin Definition: ${classification.marginDefinition}`);
    report.push(`- Spiculation Score: ${classification.spiculationScore}/5`);
    report.push('');
    
    report.push('SIZE & LUNG-RADS CLASSIFICATION:');
    report.push(`- Size Category: ${classification.sizeCategory}`);
    report.push(`- Lung-RADS Category: ${classification.lungRADSCategory}`);
    report.push('');
    
    report.push('LOCATION & GROWTH ASSESSMENT:');
    report.push(`- Anatomical Zone: ${classification.anatomicalZone.toUpperCase()}`);
    report.push(`- Location Risk: ${classification.locationRisk.toUpperCase()}`);
    report.push(`- Growth Potential: ${classification.growthPotential.toUpperCase()}`);
    if (classification.volumeDoublingTime) {
      report.push(`- Estimated Volume Doubling Time: ${classification.volumeDoublingTime} days`);
    }
    report.push('');
    
    report.push('MALIGNANCY RISK ASSESSMENT:');
    report.push(`- Overall Risk: ${riskStratification.overallRisk}%`);
    report.push(`- Risk Percentile: ${classification.riskPercentile}th percentile`);
    report.push(`- Malignancy Tier: ${classification.malignancyTier.toUpperCase()}`);
    report.push(`- Risk Category: ${riskStratification.riskCategory}`);
    report.push('');
    
    report.push('RISK FACTOR BREAKDOWN:');
    report.push(`- Size Risk: ${riskStratification.riskFactors.size}%`);
    report.push(`- Morphology Risk: ${riskStratification.riskFactors.morphology}%`);
    report.push(`- Location Risk: ${riskStratification.riskFactors.location}%`);
    report.push(`- Demographics Risk: ${riskStratification.riskFactors.demographics}%`);
    report.push(`- Clinical Risk: ${riskStratification.riskFactors.clinical}%`);
    report.push('');
    
    report.push('FOLLOW-UP RECOMMENDATIONS:');
    report.push(`- Recommended Action: ${riskStratification.followUpRecommendation.action.replace(/_/g, ' ').toUpperCase()}`);
    report.push(`- Timeframe: ${riskStratification.followUpRecommendation.timeframe}`);
    report.push(`- Urgency Level: ${riskStratification.followUpRecommendation.urgencyLevel.toUpperCase()}`);
    report.push(`- Specialist Referral: ${riskStratification.followUpRecommendation.specialistReferral ? 'YES' : 'NO'}`);
    report.push('');
    
    if (riskStratification.followUpRecommendation.additionalStudies.length > 0) {
      report.push('ADDITIONAL STUDIES RECOMMENDED:');
      riskStratification.followUpRecommendation.additionalStudies.forEach((study, index) => {
        report.push(`${index + 1}. ${study}`);
      });
    }
    
    return report.join('\n');
  }
}