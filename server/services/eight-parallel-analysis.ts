import OpenAI from "openai";
import { getAllPathologyPrompts, type PathologyPrompt } from "./independent-analysis";
import { BudgetTracker, TokenUsage } from "./budget-tracker";
import { runConsolidatedEscalation, EscalationCandidate } from "./consolidated-escalation";

interface IndependentPathologyResult {
  pathology: string;
  present: boolean;
  confidence: number;
  subtype?: string;
  reasoning: string;
  supporting_evidence: string;
  contradicting_evidence: string;
  modelUsed?: string; // Track which model was used (mini or 4o)
  escalated?: boolean; // Track if escalation occurred
  cacheMetrics?: {
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    cacheHitRate: number; // Percentage of tokens that were cached
  };
  // For escalated cases, track both mini and GPT-4o metrics
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

/**
 * Execute 8 completely independent pathology analyses in parallel
 * Uses CONSOLIDATED ESCALATION: All escalations batched into ONE GPT-4o call
 * Each pathology is fully evaluated independently within the consolidated call
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
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const budgetTracker = new BudgetTracker(1.0);

  const prompts = getAllPathologyPrompts({ examDate: patientInfo.examDate });
  
  console.log("🔬 Starting 8 INDEPENDENT parallel pathology analyses with CONSOLIDATED ESCALATION...");
  console.log("💰 Cost Control: $1.00 budget limit per analysis");
  console.log("🔄 Strategy: GPT-4o-mini screening → ONE consolidated GPT-4o call for all escalations");
  console.log("💾 Prompt caching enabled for additional savings");
  console.log("📊 Each pathology fully evaluated independently (no cross-interference)");
  
  const imageContent = Array.isArray(base64Images)
    ? base64Images.map(img => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/png;base64,${img}`
        }
      }))
    : [{
        type: "image_url" as const,
        image_url: {
          url: `data:image/png;base64,${base64Images}`
        }
      }];

  // Pathology-specific confidence thresholds for escalation
  // Critical pathologies (PE, Pneumothorax, Mass) use lower threshold for higher sensitivity
  // Non-critical pathologies use standard threshold for cost efficiency
  const CONFIDENCE_THRESHOLDS: Record<string, number> = {
    'Pulmonary Embolism': 85,   // Life-threatening - escalate at lower confidence
    'Pneumothorax': 85,         // Life-threatening - escalate at lower confidence
    'Mass/Nodule': 85,          // Cancer concern - escalate at lower confidence
    'COPD': 90,                 // Chronic condition - moderate threshold
    'ILD': 90,                  // Progressive disease - moderate threshold
    'Pneumonia': 88,            // Acute infection - slightly lower threshold
    'Tuberculosis': 88,         // Public health concern - slightly lower threshold
    'Pleural Effusion': 90      // Often secondary finding - moderate threshold
  };
  const DEFAULT_CONFIDENCE_THRESHOLD = 90;
  
  interface MiniScreeningResult {
    prompt: PathologyPrompt;
    miniResult: {
      present: boolean;
      confidence: number;
      subtype?: string;
      reasoning: string;
      supporting_evidence: string;
      contradicting_evidence: string;
    };
    needsEscalation: boolean;
    miniMetrics: {
      promptTokens: number;
      cachedTokens: number;
      completionTokens: number;
    };
  }

  console.log("\n📋 PHASE 1: GPT-4o-mini screening for all 8 pathologies...");
  
  const screeningPromises = prompts.map(async (prompt: PathologyPrompt): Promise<MiniScreeningResult> => {
    console.log(`  🎯 Screening ${prompt.pathologyName}...`);
    
    try {
      const miniResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 500,
        temperature: 0,
        seed: 12345,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: prompt.userPrompt },
              ...imageContent
            ]
          }
        ]
      });

      const miniResult = JSON.parse(miniResponse.choices[0].message.content || "{}");
      const miniUsage = miniResponse.usage;
      
      const tokenUsage: TokenUsage = {
        promptTokens: miniUsage?.prompt_tokens || 0,
        cachedTokens: miniUsage?.prompt_tokens_details?.cached_tokens || 0,
        completionTokens: miniUsage?.completion_tokens || 0
      };
      
      budgetTracker.recordCall('gpt-4o-mini', tokenUsage);

      const miniConfidence = miniResult.confidence || 0;
      const miniPresent = miniResult.present || false;
      // Use pathology-specific threshold for escalation decision
      const pathologyThreshold = CONFIDENCE_THRESHOLDS[prompt.pathologyName] || DEFAULT_CONFIDENCE_THRESHOLD;
      const needsEscalation = miniConfidence < pathologyThreshold || miniPresent;

      if (tokenUsage.cachedTokens > 0) {
        const cacheRate = (tokenUsage.cachedTokens / tokenUsage.promptTokens * 100).toFixed(1);
        console.log(`  💾 ${prompt.pathologyName}: Cache hit ${cacheRate}%`);
      }

      const status = needsEscalation 
        ? `⬆️ ESCALATE (${miniPresent ? 'DETECTED' : 'uncertain'}, ${miniConfidence}% < ${pathologyThreshold}% threshold)`
        : `✅ FINAL (${miniConfidence}% ≥ ${pathologyThreshold}% threshold - confident negative)`;
      console.log(`  ${status} - ${prompt.pathologyName}`);

      return {
        prompt,
        miniResult: {
          present: miniPresent,
          confidence: miniConfidence,
          subtype: miniResult.subtype,
          reasoning: miniResult.reasoning || "",
          supporting_evidence: miniResult.supporting_evidence || "",
          contradicting_evidence: miniResult.contradicting_evidence || ""
        },
        needsEscalation,
        miniMetrics: {
          promptTokens: tokenUsage.promptTokens,
          cachedTokens: tokenUsage.cachedTokens,
          completionTokens: tokenUsage.completionTokens
        }
      };
    } catch (error) {
      console.error(`  ❌ ${prompt.pathologyName} screening failed:`, error);
      return {
        prompt,
        miniResult: {
          present: false,
          confidence: 0,
          reasoning: "Screening failed",
          supporting_evidence: "",
          contradicting_evidence: ""
        },
        needsEscalation: false,
        miniMetrics: { promptTokens: 0, cachedTokens: 0, completionTokens: 0 }
      };
    }
  });

  const screeningResults = await Promise.all(screeningPromises);
  
  const escalationCandidates: EscalationCandidate[] = screeningResults
    .filter(r => r.needsEscalation)
    .map(r => ({
      pathologyName: r.prompt.pathologyName,
      miniResult: r.miniResult,
      systemPrompt: r.prompt.systemPrompt,
      userPrompt: r.prompt.userPrompt
    }));

  console.log(`\n📋 PHASE 2: Consolidated escalation for ${escalationCandidates.length} patholog${escalationCandidates.length !== 1 ? 'ies' : 'y'}...`);
  
  let escalationResults: Map<string, any> = new Map();
  let consolidatedMetrics = { promptTokens: 0, cachedTokens: 0, completionTokens: 0 };
  let wasGpt4oUsed = false; // Track if actual GPT-4o confirmation happened

  if (escalationCandidates.length > 0) {
    const escalationResponse = await runConsolidatedEscalation(
      escalationCandidates,
      base64Images,
      budgetTracker
    );
    
    escalationResponse.results.forEach(r => {
      escalationResults.set(r.pathology, r);
    });
    consolidatedMetrics = escalationResponse.tokenUsage;
    wasGpt4oUsed = escalationResponse.wasGpt4oUsed;
    
    if (!wasGpt4oUsed && escalationCandidates.length > 0) {
      console.log("  ⚠️ GPT-4o confirmation was skipped (budget/error) - using mini results");
    }
  } else {
    console.log("  ✅ No escalations needed - all pathologies resolved by GPT-4o-mini");
  }

  // Track exact consolidated metrics (not distributed/rounded)
  const consolidatedGpt4oMetrics = {
    promptTokens: consolidatedMetrics.promptTokens,
    cachedTokens: consolidatedMetrics.cachedTokens,
    completionTokens: consolidatedMetrics.completionTokens
  };

  const results: IndependentPathologyResult[] = screeningResults.map(screening => {
    const escalatedResult = escalationResults.get(screening.prompt.pathologyName);
    
    if (escalatedResult) {
      // Only mark as gpt-4o if actual GPT-4o call was made (not degraded due to budget/error)
      const actuallyUsedGpt4o = wasGpt4oUsed;
      
      return {
        pathology: screening.prompt.pathologyName,
        present: escalatedResult.present,
        confidence: escalatedResult.confidence,
        subtype: escalatedResult.subtype,
        reasoning: escalatedResult.reasoning,
        supporting_evidence: escalatedResult.supporting_evidence,
        contradicting_evidence: escalatedResult.contradicting_evidence,
        modelUsed: actuallyUsedGpt4o ? "gpt-4o" : "gpt-4o-mini", // Reflect actual model used
        escalated: actuallyUsedGpt4o, // Only true if GPT-4o was actually called
        cacheMetrics: {
          promptTokens: screening.miniMetrics.promptTokens,
          cachedTokens: screening.miniMetrics.cachedTokens,
          completionTokens: screening.miniMetrics.completionTokens,
          cacheHitRate: screening.miniMetrics.promptTokens > 0 
            ? (screening.miniMetrics.cachedTokens / screening.miniMetrics.promptTokens * 100) 
            : 0
        },
        miniMetrics: screening.miniMetrics,
        gpt4oMetrics: actuallyUsedGpt4o ? consolidatedGpt4oMetrics : undefined // Only include if GPT-4o was used
      } as IndependentPathologyResult;
    } else {
      return {
        pathology: screening.prompt.pathologyName,
        present: screening.miniResult.present,
        confidence: screening.miniResult.confidence,
        subtype: screening.miniResult.subtype,
        reasoning: screening.miniResult.reasoning,
        supporting_evidence: screening.miniResult.supporting_evidence,
        contradicting_evidence: screening.miniResult.contradicting_evidence,
        modelUsed: "gpt-4o-mini",
        escalated: false,
        cacheMetrics: {
          promptTokens: screening.miniMetrics.promptTokens,
          cachedTokens: screening.miniMetrics.cachedTokens,
          completionTokens: screening.miniMetrics.completionTokens,
          cacheHitRate: screening.miniMetrics.promptTokens > 0 
            ? (screening.miniMetrics.cachedTokens / screening.miniMetrics.promptTokens * 100) 
            : 0
        }
      } as IndependentPathologyResult;
    }
  });
  
  // Get cost metrics from budget tracker
  const metrics = budgetTracker.getMetrics();
  const miniCount = results.filter(r => r.modelUsed === "gpt-4o-mini").length;
  const gpt4oCount = results.filter(r => r.modelUsed === "gpt-4o").length;
  
  // Calculate cache metrics across all mini screenings
  const totalMiniCachedTokens = screeningResults.reduce((sum, r) => sum + r.miniMetrics.cachedTokens, 0);
  const totalMiniPromptTokens = screeningResults.reduce((sum, r) => sum + r.miniMetrics.promptTokens, 0);
  const miniCacheHitRate = totalMiniPromptTokens > 0 ? (totalMiniCachedTokens / totalMiniPromptTokens * 100) : 0;
  
  // Calculate what OLD METHOD would have cost (individual GPT-4o calls per escalation)
  // Old method: Each escalation = separate GPT-4o call with same images
  const gpt4oInputPrice = 2.50 / 1_000_000;
  const gpt4oOutputPrice = 10.00 / 1_000_000;
  
  // Estimate old method cost: if we had made N separate GPT-4o calls instead of 1 consolidated
  // Each individual call would have ~same prompt tokens as consolidated (images are the bulk)
  // So old cost ≈ N * (consolidated_cost) for GPT-4o portion
  const oldMethodGpt4oCost = gpt4oCount > 0 ? metrics.gpt4oCost * gpt4oCount : 0;
  const oldMethodTotalCost = metrics.miniCost + oldMethodGpt4oCost;
  
  const consolidationSavings = oldMethodTotalCost > 0 
    ? ((oldMethodTotalCost - metrics.totalCost) / oldMethodTotalCost * 100) 
    : 0;
  
  console.log("\n✅ All 8 independent analyses completed with CONSOLIDATED ESCALATION");
  console.log("📊 Results summary:", results.map(r => `${r.pathology}=${r.present}`).join(", "));
  console.log(`\n💰 COST CONTROL REPORT ($3.00 budget):`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  📋 Phase 1 (Mini Screening): 8 pathologies → $${metrics.miniCost.toFixed(4)}`);
  console.log(`  🔄 Phase 2 (Consolidated): ${gpt4oCount} escalations in 1 call → $${metrics.gpt4oCost.toFixed(4)}`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  💵 TOTAL COST: $${metrics.totalCost.toFixed(4)} / $3.00 budget (${budgetTracker.getUtilization().toFixed(1)}% used)`);
  console.log(`  💾 Mini cache hit rate: ${miniCacheHitRate.toFixed(1)}%`);
  if (gpt4oCount > 0) {
    console.log(`  🎯 Consolidation savings: ${consolidationSavings.toFixed(1)}% vs ${gpt4oCount} individual GPT-4o calls (~$${oldMethodTotalCost.toFixed(4)})`);
  }
  console.log(`  ✅ Budget status: ${budgetTracker.isBudgetExceeded() ? '❌ EXCEEDED' : '✅ WITHIN LIMIT'}`);
  
  return results;
}

/**
 * Convert 8 independent results into CtAnalysisResult format
 * Returns proper structure for batch combining logic
 */
export function mergeIndependentResults(results: IndependentPathologyResult[]): any {
  const resultMap = new Map(results.map(r => [r.pathology, r]));
  
  const copdResult = resultMap.get("COPD");
  const ildResult = resultMap.get("ILD");
  const massResult = resultMap.get("Mass");
  const peResult = resultMap.get("PE");
  const pneumoniaResult = resultMap.get("Pneumonia");
  const tbResult = resultMap.get("TB");
  const pleuralResult = resultMap.get("PleuralEffusion");
  const pneumothoraxResult = resultMap.get("Pneumothorax");

  // Calculate average confidence from all pathologies
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  // Build MedicalFindings object
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
    confidence: avgConfidence, // THIS IS CRITICAL - combineBatchResults expects this
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

  // 🔧 CRITICAL FIX: Create BOTH old format AND new format for full compatibility
  // This ensures conflict reconciliation works correctly for single-slice studies
  return {
    findings,
    // OLD FORMAT (for batched multi-slice compatibility)
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
    primaryDiagnosis: "Independent analysis completed",
    recommendations: [],
    votingMetadata: {
      batchCount: 1,
      pathologyVotes: {}
    }
  };
}
