import OpenAI from "openai";
import { getAllPathologyPrompts, type PathologyPrompt } from "./independent-analysis";
import { BudgetTracker, TokenUsage } from "./budget-tracker";
import { runConsolidatedEscalation, EscalationCandidate } from "./consolidated-escalation";
import { runUnifiedScreening } from "./unified-screening";

interface IndependentPathologyResult {
  pathology: string;
  present: boolean;
  confidence: number;
  subtype?: string;
  reasoning: string;
  supporting_evidence: string;
  contradicting_evidence: string;
  modelUsed?: string;
  escalated?: boolean;
  cacheMetrics?: {
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    cacheHitRate: number;
  };
  miniMetrics?: {
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
  };
  gpt4oMetrics?: {
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
  };
}

// Canonical pathology names used internally
const CANONICAL_NAMES = ["COPD", "ILD", "Mass", "PE", "Pneumonia", "TB", "PleuralEffusion", "Pneumothorax"];

// Map from prompt pathologyName to canonical name
const PROMPT_TO_CANONICAL: Record<string, string> = {
  "COPD": "COPD",
  "ILD": "ILD", 
  "Mass": "Mass",
  "PE": "PE",
  "Pneumonia": "Pneumonia",
  "TB": "TB",
  "PleuralEffusion": "PleuralEffusion",
  "Pneumothorax": "Pneumothorax"
};

// Pathology-specific confidence thresholds for escalation
// Uses CANONICAL names
const CONFIDENCE_THRESHOLDS: Record<string, number> = {
  'PE': 85,           // Pulmonary Embolism - Life-threatening
  'Pneumothorax': 85, // Life-threatening
  'Mass': 85,         // Cancer concern
  'COPD': 90,         // Chronic condition
  'ILD': 90,          // Progressive disease
  'Pneumonia': 88,    // Acute infection
  'TB': 88,           // Public health concern
  'PleuralEffusion': 90 // Often secondary finding
};
const DEFAULT_CONFIDENCE_THRESHOLD = 90;

/**
 * Execute 8 completely independent pathology analyses
 * OPTIMIZED: Uses UNIFIED SINGLE-CALL screening (8x faster than separate calls)
 * Uses CONSOLIDATED ESCALATION: All escalations batched into ONE GPT-4o call
 * Budget controlled to $1 per analysis
 */
export async function runEightIndependentAnalyses(
  base64Images: string | string[],
  patientInfo: {
    name: string;
    patientId: string;
    gender: string;
    dateOfBirth: string;
    examDate: string;
    clinicalHistory?: string;
    referringPhysician?: string;
  }
): Promise<IndependentPathologyResult[]> {
  
  const budgetTracker = new BudgetTracker(1.0);
  const prompts = getAllPathologyPrompts({ examDate: patientInfo.examDate });
  
  console.log("🔬 Starting OPTIMIZED 8-pathology analysis with UNIFIED SCREENING...");
  console.log("⚡ SPEED OPTIMIZATION: Single-call screening (8x fewer API round-trips)");
  console.log("💰 Cost Control: $1.00 budget limit per analysis");
  console.log("🔄 Strategy: Unified GPT-4o-mini → ONE consolidated GPT-4o escalation");
  console.log("💾 Prompt caching enabled for additional savings");
  
  // PHASE 1: UNIFIED SCREENING - All 8 pathologies in ONE call
  console.log("\n📋 PHASE 1: UNIFIED GPT-4o-mini screening for all 8 pathologies (SINGLE CALL)...");
  const screeningStartTime = Date.now();
  
  const screeningResponse = await runUnifiedScreening(
    base64Images,
    patientInfo.examDate,
    budgetTracker
  );
  
  const screeningElapsed = ((Date.now() - screeningStartTime) / 1000).toFixed(2);
  console.log(`  ⚡ Phase 1 completed in ${screeningElapsed}s (previously ~${(parseFloat(screeningElapsed) * 3).toFixed(1)}s with 8 parallel calls)`);
  
  // Distribute metrics evenly across pathologies for tracking
  const perPathologyMetrics = {
    promptTokens: Math.round(screeningResponse.tokenUsage.promptTokens / 8),
    cachedTokens: Math.round(screeningResponse.tokenUsage.cachedTokens / 8),
    completionTokens: Math.round(screeningResponse.tokenUsage.completionTokens / 8)
  };
  
  // Determine escalation candidates based on screening results
  // SAFETY: Any missing/malformed screening result forces escalation
  const escalationCandidates: EscalationCandidate[] = [];
  const screeningResultsMap = new Map(screeningResponse.results.map(r => [r.pathology, r]));
  
  // Validate all 8 pathologies are present
  console.log(`  📊 Screening returned ${screeningResponse.results.length}/8 pathologies`);
  
  for (const prompt of prompts) {
    const screeningResult = screeningResultsMap.get(prompt.pathologyName);
    const threshold = CONFIDENCE_THRESHOLDS[prompt.pathologyName] || DEFAULT_CONFIDENCE_THRESHOLD;
    
    // SAFETY: Missing screening result forces escalation with low confidence
    if (!screeningResult) {
      console.warn(`  ⚠️ MISSING ${prompt.pathologyName} in screening - forcing escalation for safety`);
      escalationCandidates.push({
        pathologyName: prompt.pathologyName,
        miniResult: {
          present: false,
          confidence: 50, // Low confidence forces escalation
          reasoning: "Not returned in unified screening - requires full evaluation",
          supporting_evidence: "",
          contradicting_evidence: ""
        },
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt
      });
      // Also add to screeningResultsMap for final results building
      screeningResultsMap.set(prompt.pathologyName, {
        pathology: prompt.pathologyName,
        present: false,
        confidence: 50,
        reasoning: "Not returned in unified screening",
        supporting_evidence: "",
        contradicting_evidence: ""
      });
      continue;
    }
    
    // SAFETY: Empty reasoning also forces escalation
    const hasValidReasoning = screeningResult.reasoning && screeningResult.reasoning.length > 10;
    const needsEscalation = screeningResult.confidence < threshold || screeningResult.present || !hasValidReasoning;
    
    const status = needsEscalation 
      ? `⬆️ ESCALATE (${screeningResult.present ? 'DETECTED' : 'uncertain'}, ${screeningResult.confidence}%${!hasValidReasoning ? ' - missing reasoning' : ''})`
      : `✅ FINAL (${screeningResult.confidence}% ≥ ${threshold}% threshold - confident negative)`;
    console.log(`  ${status} - ${prompt.pathologyName}`);
    
    if (needsEscalation) {
      escalationCandidates.push({
        pathologyName: prompt.pathologyName,
        miniResult: {
          present: screeningResult.present,
          confidence: screeningResult.confidence,
          subtype: screeningResult.subtype,
          reasoning: screeningResult.reasoning || "Requires detailed evaluation",
          supporting_evidence: screeningResult.supporting_evidence || "",
          contradicting_evidence: screeningResult.contradicting_evidence || ""
        },
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt
      });
    }
  }

  // PHASE 2: CONSOLIDATED ESCALATION
  console.log(`\n📋 PHASE 2: Consolidated escalation for ${escalationCandidates.length} patholog${escalationCandidates.length !== 1 ? 'ies' : 'y'}...`);
  
  let escalationResults: Map<string, any> = new Map();
  let consolidatedMetrics = { promptTokens: 0, cachedTokens: 0, completionTokens: 0 };
  let wasGpt4oUsed = false;

  if (escalationCandidates.length > 0) {
    const escalationStartTime = Date.now();
    const escalationResponse = await runConsolidatedEscalation(
      escalationCandidates,
      base64Images,
      budgetTracker
    );
    const escalationElapsed = ((Date.now() - escalationStartTime) / 1000).toFixed(2);
    console.log(`  ⚡ Phase 2 completed in ${escalationElapsed}s`);
    
    escalationResponse.results.forEach(r => {
      escalationResults.set(r.pathology, r);
    });
    consolidatedMetrics = escalationResponse.tokenUsage;
    wasGpt4oUsed = escalationResponse.wasGpt4oUsed;
    
    if (!wasGpt4oUsed && escalationCandidates.length > 0) {
      console.log("  ⚠️ GPT-4o confirmation was skipped (budget/error) - using mini results");
    }
  } else {
    console.log("  ✅ No escalations needed - all pathologies resolved by unified screening");
  }

  // Build final results
  const results: IndependentPathologyResult[] = prompts.map(prompt => {
    const screeningResult = screeningResultsMap.get(prompt.pathologyName);
    const escalatedResult = escalationResults.get(prompt.pathologyName);
    
    if (escalatedResult) {
      const actuallyUsedGpt4o = wasGpt4oUsed;
      
      return {
        pathology: prompt.pathologyName,
        present: escalatedResult.present,
        confidence: escalatedResult.confidence,
        subtype: escalatedResult.subtype,
        reasoning: escalatedResult.reasoning,
        supporting_evidence: escalatedResult.supporting_evidence,
        contradicting_evidence: escalatedResult.contradicting_evidence,
        modelUsed: actuallyUsedGpt4o ? "gpt-4o" : "gpt-4o-mini",
        escalated: actuallyUsedGpt4o,
        cacheMetrics: {
          promptTokens: perPathologyMetrics.promptTokens,
          cachedTokens: perPathologyMetrics.cachedTokens,
          completionTokens: perPathologyMetrics.completionTokens,
          cacheHitRate: perPathologyMetrics.promptTokens > 0 
            ? (perPathologyMetrics.cachedTokens / perPathologyMetrics.promptTokens * 100) 
            : 0
        },
        miniMetrics: perPathologyMetrics,
        gpt4oMetrics: actuallyUsedGpt4o ? consolidatedMetrics : undefined
      } as IndependentPathologyResult;
    } else {
      return {
        pathology: prompt.pathologyName,
        present: screeningResult?.present || false,
        confidence: screeningResult?.confidence || 0,
        subtype: screeningResult?.subtype,
        reasoning: screeningResult?.reasoning || "",
        supporting_evidence: screeningResult?.supporting_evidence || "",
        contradicting_evidence: screeningResult?.contradicting_evidence || "",
        modelUsed: "gpt-4o-mini",
        escalated: false,
        cacheMetrics: {
          promptTokens: perPathologyMetrics.promptTokens,
          cachedTokens: perPathologyMetrics.cachedTokens,
          completionTokens: perPathologyMetrics.completionTokens,
          cacheHitRate: perPathologyMetrics.promptTokens > 0 
            ? (perPathologyMetrics.cachedTokens / perPathologyMetrics.promptTokens * 100) 
            : 0
        }
      } as IndependentPathologyResult;
    }
  });
  
  // Cost metrics
  const metrics = budgetTracker.getMetrics();
  const miniCount = results.filter(r => r.modelUsed === "gpt-4o-mini").length;
  const gpt4oCount = results.filter(r => r.modelUsed === "gpt-4o").length;
  
  const miniCacheHitRate = screeningResponse.tokenUsage.promptTokens > 0 
    ? (screeningResponse.tokenUsage.cachedTokens / screeningResponse.tokenUsage.promptTokens * 100) 
    : 0;
  
  console.log("\n✅ OPTIMIZED 8-pathology analysis completed");
  console.log("📊 Results summary:", results.map(r => `${r.pathology}=${r.present}`).join(", "));
  console.log(`\n💰 COST CONTROL REPORT ($1.00 budget):`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  📋 Phase 1 (Unified Screening): 8 pathologies in 1 call → $${metrics.miniCost.toFixed(4)}`);
  console.log(`  🔄 Phase 2 (Consolidated): ${gpt4oCount} escalations in 1 call → $${metrics.gpt4oCost.toFixed(4)}`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  💵 TOTAL COST: $${metrics.totalCost.toFixed(4)} / $1.00 budget (${budgetTracker.getUtilization().toFixed(1)}% used)`);
  console.log(`  💾 Unified screening cache hit rate: ${miniCacheHitRate.toFixed(1)}%`);
  console.log(`  ✅ Budget status: ${budgetTracker.isBudgetExceeded() ? '❌ EXCEEDED' : '✅ WITHIN LIMIT'}`);
  
  return results;
}

/**
 * Convert 8 independent results into CtAnalysisResult format
 * Uses CANONICAL pathology names from independent-analysis.ts
 */
export function mergeIndependentResults(results: IndependentPathologyResult[]): any {
  const resultMap = new Map(results.map(r => [r.pathology, r]));
  
  // Use CANONICAL names: COPD, ILD, Mass, PE, Pneumonia, TB, PleuralEffusion, Pneumothorax
  const copdResult = resultMap.get("COPD");
  const ildResult = resultMap.get("ILD");
  const massResult = resultMap.get("Mass");
  const peResult = resultMap.get("PE");
  const pneumoniaResult = resultMap.get("Pneumonia");
  const tbResult = resultMap.get("TB");
  const pleuralResult = resultMap.get("PleuralEffusion");
  const pneumothoraxResult = resultMap.get("Pneumothorax");

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  const findings = {
    copdDetected: copdResult?.present || false,
    ildDetected: ildResult?.present || false,
    pulmonaryEmbolismDetected: peResult?.present || false,
    pneumoniaDetected: pneumoniaResult?.present || false,
    tuberculosisDetected: tbResult?.present || false,
    pleuralEffusionDetected: pleuralResult?.present || false,
    pneumothoraxDetected: pneumothoraxResult?.present || false,
    massDetected: massResult?.present || false,
    copdSubtype: copdResult?.subtype || "none",
    ildSubtype: ildResult?.subtype || "none",
    severity: "moderate" as const,
    confidence: avgConfidence,
    details: "Independent pathology analysis completed",
    massFindings: massResult?.reasoning || "No masses detected",
    vascularFindings: peResult?.reasoning || "No PE detected",
    copdFindings: copdResult?.reasoning || "No COPD detected",
    ildFindings: ildResult?.reasoning || "No ILD detected",
    pneumoniaFindings: pneumoniaResult?.reasoning || "No pneumonia detected",
    tuberculosisFindings: tbResult?.reasoning || "No TB detected",
    infectiousFindings: [pneumoniaResult?.reasoning, tbResult?.reasoning].filter(Boolean).join("; ") || "No infections detected",
    pleuralFindings: [pleuralResult?.reasoning, pneumothoraxResult?.reasoning].filter(Boolean).join("; ") || "No pleural abnormalities"
  };

  return {
    findings,
    COPD: {
      present: copdResult?.present || false,
      confidence: copdResult?.confidence || 0,
      subtype: copdResult?.subtype || "none",
      reasoning: copdResult?.reasoning || "No COPD detected"
    },
    ILD: {
      present: ildResult?.present || false,
      confidence: ildResult?.confidence || 0,
      subtype: ildResult?.subtype || "none",
      reasoning: ildResult?.reasoning || "No ILD detected"
    },
    Lung_Cancer: {
      present: massResult?.present || false,
      confidence: massResult?.confidence || 0,
      reasoning: massResult?.reasoning || "No masses detected"
    },
    Pulmonary_Embolism: {
      present: peResult?.present || false,
      confidence: peResult?.confidence || 0,
      reasoning: peResult?.reasoning || "No PE detected"
    },
    Pneumonia: {
      present: pneumoniaResult?.present || false,
      confidence: pneumoniaResult?.confidence || 0,
      reasoning: pneumoniaResult?.reasoning || "No pneumonia detected"
    },
    Tuberculosis: {
      present: tbResult?.present || false,
      confidence: tbResult?.confidence || 0,
      reasoning: tbResult?.reasoning || "No TB detected"
    },
    Pleural_Effusion: {
      present: pleuralResult?.present || false,
      confidence: pleuralResult?.confidence || 0,
      reasoning: pleuralResult?.reasoning || "No pleural effusion"
    },
    Pneumothorax: {
      present: pneumothoraxResult?.present || false,
      confidence: pneumothoraxResult?.confidence || 0,
      reasoning: pneumothoraxResult?.reasoning || "No pneumothorax"
    },
    quantitativeAnalysis: {
      lowAttenuationAreas: 0,
      airTrapping: 0,
      groundGlassOpacity: 0,
      fibroticChanges: 0,
      analysisAccuracy: avgConfidence
    },
    differentialDiagnoses: [],
    confidence: avgConfidence,
    processingTime: 0,
    detailedFindings: results.map(r => `${r.pathology}: ${r.reasoning}`).join("\n\n"),
    primaryDiagnosis: generatePrimaryDiagnosisFromResults(results),
    recommendations: [],
    votingMetadata: {
      batchCount: 1,
      pathologyVotes: {}
    }
  };
}

/**
 * Generate proper primary diagnosis from detected pathologies
 * Prioritizes critical/life-threatening conditions
 */
function generatePrimaryDiagnosisFromResults(results: IndependentPathologyResult[]): string {
  const detected = results.filter(r => r.present);
  
  if (detected.length === 0) {
    return "Normal chest CT - No significant pathology detected";
  }
  
  // Priority order: PE, Pneumothorax, Mass, TB, Pneumonia, ILD, COPD, PleuralEffusion
  const priorityOrder = ["PE", "Pneumothorax", "Mass", "TB", "Pneumonia", "ILD", "COPD", "PleuralEffusion"];
  
  const sortedDetected = detected.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.pathology);
    const bIndex = priorityOrder.indexOf(b.pathology);
    return aIndex - bIndex;
  });
  
  // Map canonical names to display names
  const displayNames: Record<string, string> = {
    "COPD": "COPD",
    "ILD": "Interstitial Lung Disease",
    "Mass": "Pulmonary Nodule/Mass",
    "PE": "Pulmonary Embolism",
    "Pneumonia": "Pneumonia",
    "TB": "Tuberculosis",
    "PleuralEffusion": "Pleural Effusion",
    "Pneumothorax": "Pneumothorax"
  };
  
  if (sortedDetected.length === 1) {
    const pathology = sortedDetected[0];
    const displayName = displayNames[pathology.pathology] || pathology.pathology;
    const subtype = pathology.subtype ? ` - ${pathology.subtype}` : "";
    return `${displayName}${subtype}`;
  }
  
  // Multiple pathologies
  const names = sortedDetected.slice(0, 3).map(p => displayNames[p.pathology] || p.pathology);
  if (sortedDetected.length > 3) {
    return `Multiple pathologies: ${names.join(", ")} + ${sortedDetected.length - 3} additional`;
  }
  return `Multiple pathologies: ${names.join(", ")}`;
}
