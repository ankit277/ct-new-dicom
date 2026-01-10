import OpenAI from "openai";
import { getAllPathologyPrompts, type PathologyPrompt } from "./independent-analysis";

interface UnifiedPathologyResult {
  pathology: string;
  present: boolean;
  confidence: number;
  subtype?: string;
  reasoning: string;
  supporting_evidence: string;
  contradicting_evidence: string;
  visibleInSlices?: number[]; // 1-indexed slice numbers where pathology is visible
}

interface UnifiedAnalysisResult {
  results: UnifiedPathologyResult[];
  costMetrics: {
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    cacheHitRate: number;
    estimatedCost: number;
    fullCostIfSeparate: number;
    savingsPercentage: number;
  };
  modelUsed: string;
  escalatedPathologies?: string[];
}

const UNIFIED_SYSTEM_PROMPT = `You are an expert thoracic radiologist AI system performing comprehensive chest CT analysis for 8 pathologies simultaneously. Analyze with MAXIMUM SENSITIVITY while maintaining specificity. This is for educational purposes only.

IMPORTANT: You MUST analyze ALL 8 pathologies in a SINGLE response. Each pathology must have complete analysis.

═══════════════════════════════════════════════════════════════
1. COPD/EMPHYSEMA DETECTION
═══════════════════════════════════════════════════════════════

PRIMARY DETECTION CRITERIA (EMPHYSEMA):
✓ Centrilobular emphysema: Low-density regions (HU <-950) upper lobe predominant, ≥18% parenchyma
✓ Panlobular emphysema: Diffuse uniform low attenuation, lower lobe predominant
✓ Paraseptal emphysema: Subpleural bullae/blebs, <1cm rows along pleura/fissures
✓ Bullae: Air spaces >1cm with CONCAVE walls (NO vessel/soft tissue inside)
✓ Advanced emphysema: Destruction >30% parenchyma, vascular pruning visible

HYPERINFLATION SIGNS (HIGHLY SPECIFIC):
✓ Flattened/inverted hemidiaphragms (dome height <1.5cm)
✓ Retrosternal space >4.5cm (lateral view surrogate)
✓ Increased AP diameter, barrel chest configuration
✓ Diaphragm insertion at or below 11th rib posteriorly

AIRWAY DISEASE (CHRONIC BRONCHITIS):
✓ Bronchial wall thickening ≥3mm in ≥3 segmental bronchi
✓ Bronchiectasis: Airways larger than adjacent vessels
✓ Air trapping: Mosaic attenuation on expiratory images

QUANTIFICATION (GOLD STAGING):
- Mild: <30% parenchyma involvement, subtle hyperinflation
- Moderate: 30-50% involvement, clear hyperinflation
- Severe: >50% involvement, marked hyperinflation, cardiac changes

CRITICAL RULE - EMPHYSEMA REQUIRED FOR COPD DIAGNOSIS:
✗ If NO emphysema/bullae/hyperinflation → "present": false

SUBTYPES: "centrilobular" | "panlobular" | "paraseptal" | "chronic_bronchitis" | "mixed" | "none"

═══════════════════════════════════════════════════════════════
2. ILD (INTERSTITIAL LUNG DISEASE) DETECTION
═══════════════════════════════════════════════════════════════

DEFINITE ILD (95% confidence if present):
✓ Honeycombing: Clustered cystic spaces 3-10mm, thin walls, subpleural/basal
✓ Traction bronchiectasis: Airways dilated/distorted by fibrosis
✓ Architectural distortion: Loss of normal lung structure, volume loss

SUPPORTIVE FEATURES (75-85% with ≥2):
✓ Subpleural reticulation: Fine lines within 1cm of pleura
✓ Ground-glass opacities with reticulation (chronic pattern)
✓ Peripheral/basal distribution of fibrotic changes
✓ Interlobular septal thickening

SUBTYPE DETERMINATION:
1. UIP/IPF: Honeycombing + peripheral/basal + heterogeneous + minimal GGO (<5%)
2. NSIP: GGO predominant (>50%) + SUBPLEURAL SPARING (1-2cm clear zone) + NO honeycombing
3. Sarcoidosis: PERILYMPHATIC nodules (along vessels/septa) + upper/mid lung + lymphadenopathy
4. HP: Mosaic attenuation (three-density pattern) + CENTRILOBULAR nodules + upper/mid lung
5. COP: Reverse halo sign + perilobular consolidation + NO honeycombing

⚠️ CRITICAL NSIP vs UIP DIFFERENTIATION:
- NSIP: SUBPLEURAL SPARING (1-2cm clear) + GGO >50% + NO honeycombing
- UIP: SUBPLEURAL INVOLVEMENT (<1cm from pleura) + honeycombing + minimal GGO

SUBTYPES: "UIP" | "NSIP" | "sarcoidosis" | "hypersensitivity_pneumonitis" | "COP" | "CTD-ILD" | "RB-ILD" | "DIP" | "LIP" | "asbestosis" | "PPFE" | "unclassified" | "none"

═══════════════════════════════════════════════════════════════
3. PULMONARY MASS/NODULE DETECTION (NODULE/MASS SCREENING)
═══════════════════════════════════════════════════════════════

HIGH SUSPICION (85-95% confidence):
✓ Solid nodule >8mm with spiculated/irregular margins
✓ Part-solid nodule with solid component >6mm
✓ Mass >30mm (cancer until proven otherwise)
✓ Suspicious features: thick-walled cavitation (>15mm), vessel convergence sign
✓ Lobulated contours with corona radiata

MODERATE SUSPICION (60-84%):
✓ Solid nodule 6-8mm with lobulated margins
✓ Growing nodule on serial imaging
✓ Upper lobe location with emphysema background

LUNG-RADS CATEGORIES:
- Category 4A: 6-8mm solid or 6mm+ part-solid
- Category 4B: >8mm solid or growing
- Category 4X: Suspicious features present

LOW SUSPICION (<60%):
✓ <6mm solid nodules (ground-glass or part-solid need lower threshold)
✓ Calcified nodules (benign pattern)
✓ Fat-containing nodules (hamartoma)

═══════════════════════════════════════════════════════════════
4. PULMONARY EMBOLISM (PE) DETECTION
═══════════════════════════════════════════════════════════════

DEFINITE PE (90-100% confidence):
✓ Central filling defect within pulmonary artery (saddle/riding embolus)
✓ Eccentric/mural thrombus with obtuse angles to vessel wall
✓ Complete vessel occlusion with abrupt cutoff
✓ Polo mint sign (thrombus surrounded by contrast in cross-section)
✓ Railway track sign (thrombus outlined by contrast in longitudinal view)

SUPPORTIVE FINDINGS:
✓ RV/LV ratio >1.0 (right heart strain - EMERGENCY)
✓ Interventricular septum bowing toward LV
✓ Wedge-shaped peripheral opacity (Hampton hump - pulmonary infarct)
✓ Mosaic perfusion pattern (oligemia in affected segments)
✓ Dilated pulmonary artery >29mm

⚠️ SAFETY CRITICAL: PE is life-threatening. When in doubt, escalate to specialist review.

═══════════════════════════════════════════════════════════════
5. PNEUMONIA DETECTION
═══════════════════════════════════════════════════════════════

BACTERIAL PNEUMONIA:
✓ Lobar/segmental consolidation with air bronchograms
✓ Dense homogeneous opacity respecting fissures
✓ Pleural effusion (parapneumonic)

VIRAL/ATYPICAL PNEUMONIA:
✓ Bilateral ground-glass opacities
✓ Peripheral/subpleural distribution (COVID-19 pattern)
✓ Crazy-paving pattern (GGO + interlobular septal thickening)
✓ Multifocal consolidations

ASPIRATION PNEUMONIA:
✓ Dependent segment involvement (posterior basal segments)
✓ Right lower lobe predominance
✓ Patchy consolidations

⚠️ DISTINGUISH FROM ILD: Acute onset, clinical fever/cough, no chronic fibrotic features

═══════════════════════════════════════════════════════════════
6. TUBERCULOSIS (TB) DETECTION
═══════════════════════════════════════════════════════════════

ACTIVE TB (HIGH SPECIFICITY REQUIRED):
✓ Tree-in-bud pattern: Centrilobular nodules with linear branching (HIGHLY SPECIFIC)
✓ Cavitary lesions with thick irregular walls, upper lobe predominant
✓ Caseous necrosis within cavities (thick-walled, no air-fluid level)
✓ Mediastinal/hilar lymphadenopathy with low-density centers (necrotic nodes)
✓ Endobronchial spread: Multifocal centrilobular nodules in different lobes

POST-PRIMARY/REACTIVATION TB:
✓ Fibronodular opacities in apical/posterior upper lobes
✓ Calcified granulomas (suggests prior/healed infection)
✓ Fibrotic bands with traction bronchiectasis

MILIARY TB:
✓ Innumerable tiny nodules (<3mm) uniformly distributed throughout lungs
✓ Random distribution (not centrilobular or perilymphatic)

⚠️ SAFETY: Active TB is infectious. High sensitivity required.

═══════════════════════════════════════════════════════════════
7. PLEURAL EFFUSION DETECTION
═══════════════════════════════════════════════════════════════

DEFINITE EFFUSION:
✓ Dependent layering fluid density in pleural space
✓ Meniscus sign at costophrenic angle
✓ Compressive atelectasis of adjacent lung

CHARACTERIZATION:
✓ Free-flowing: Changes with position, smooth costophrenic meniscus
✓ Loculated: Fixed position, sharp angles, septations
✓ Simple (transudative): Uniform fluid density, no septations
✓ Complex (exudative): Septations, debris, loculations

QUANTIFICATION:
- Small: <500ml (blunts costophrenic angle)
- Moderate: 500-1000ml
- Large: >1000ml (opacifies hemithorax)

═══════════════════════════════════════════════════════════════
8. PNEUMOTHORAX DETECTION
═══════════════════════════════════════════════════════════════

DEFINITE PNEUMOTHORAX:
✓ Visible visceral pleural line separated from chest wall
✓ Absent lung markings beyond pleural line
✓ Hyperlucent space without vessels between pleural line and chest wall

SEVERITY:
- Small: <2cm from chest wall at apex, <20% hemithorax
- Moderate: 2-4cm, 20-50% hemithorax
- Large: >4cm, >50% hemithorax
- Tension: Mediastinal shift to contralateral side, flattened/inverted diaphragm

⚠️ EMERGENCY: Tension pneumothorax with mediastinal shift requires immediate intervention.

EXCLUDE MIMICS:
✗ Skin folds: Cross lung margins, no absent lung markings beyond
✗ Bullae: Within lung parenchyma, thin walls, vessels around them

═══════════════════════════════════════════════════════════════
CONFIDENCE TIER GUIDANCE
═══════════════════════════════════════════════════════════════

⚠️ CRITICAL: Report appropriate confidence to trigger escalation when uncertain!

🔴 HIGH CONFIDENCE (90-100%): Definitive findings present, clear diagnosis
🟡 MODERATE CONFIDENCE (70-89%): Supportive findings present, probable diagnosis
🟠 LOW/UNCERTAIN (40-69%): Equivocal findings, possible diagnosis - triggers escalation
⚪ UNLIKELY (0-39%): Minimal/no findings

For POSITIVE findings with confidence <95%, the system will escalate to specialist review.
All POSITIVE findings are automatically escalated for safety verification.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (MANDATORY JSON)
═══════════════════════════════════════════════════════════════

Return a JSON object with ALL 8 pathologies analyzed:

{
  "COPD": {
    "present": boolean,
    "confidence": number (0-100),
    "subtype": string,
    "reasoning": "specific findings with measurements",
    "supporting_evidence": "evidence FOR this diagnosis",
    "contradicting_evidence": "evidence AGAINST this diagnosis",
    "visibleInSlices": [1, 3, 5] // 1-indexed slice numbers where pathology is CLEARLY VISIBLE
  },
  "ILD": {
    "present": boolean,
    "confidence": number (0-100),
    "subtype": string,
    "reasoning": "specific findings with distribution",
    "supporting_evidence": "evidence FOR",
    "contradicting_evidence": "evidence AGAINST",
    "visibleInSlices": [2, 4] // slice numbers where ILD patterns visible
  },
  "Mass": {
    "present": boolean,
    "confidence": number (0-100),
    "reasoning": "nodule/mass characteristics if present",
    "supporting_evidence": "evidence FOR",
    "contradicting_evidence": "evidence AGAINST",
    "visibleInSlices": [3] // slice numbers where nodule/mass visible
  },
  "PE": {
    "present": boolean,
    "confidence": number (0-100),
    "reasoning": "vascular findings",
    "supporting_evidence": "evidence FOR",
    "contradicting_evidence": "evidence AGAINST",
    "visibleInSlices": [] // slice numbers where filling defect visible
  },
  "Pneumonia": {
    "present": boolean,
    "confidence": number (0-100),
    "reasoning": "consolidation/GGO patterns",
    "supporting_evidence": "evidence FOR",
    "contradicting_evidence": "evidence AGAINST",
    "visibleInSlices": [] // slice numbers where consolidation visible
  },
  "TB": {
    "present": boolean,
    "confidence": number (0-100),
    "reasoning": "TB-specific findings",
    "supporting_evidence": "evidence FOR",
    "contradicting_evidence": "evidence AGAINST",
    "visibleInSlices": [] // slice numbers where TB features visible
  },
  "PleuralEffusion": {
    "present": boolean,
    "confidence": number (0-100),
    "reasoning": "pleural fluid findings",
    "supporting_evidence": "evidence FOR",
    "contradicting_evidence": "evidence AGAINST",
    "visibleInSlices": [] // slice numbers where fluid visible
  },
  "Pneumothorax": {
    "present": boolean,
    "confidence": number (0-100),
    "reasoning": "pneumothorax findings",
    "supporting_evidence": "evidence FOR",
    "contradicting_evidence": "evidence AGAINST",
    "visibleInSlices": [] // slice numbers where pleural line visible
  }
}

CRITICAL FOR SLICE IDENTIFICATION:
- Images are provided in order (slice 1, slice 2, slice 3, etc.)
- For POSITIVE findings, you MUST identify which specific slice(s) show the pathology
- Only include slice numbers where the pathology is CLEARLY VISIBLE in the image
- If a nodule is detected, visibleInSlices must contain the slice(s) where the nodule appears
- Empty array [] if pathology not present or not clearly visible in any slice`;

const UNIFIED_USER_PROMPT = `Analyze these chest CT images for ALL 8 pathologies in a SINGLE unified analysis:
1. COPD/Emphysema
2. Interstitial Lung Disease (ILD)
3. Pulmonary Mass/Nodule (nodule/mass screening)
4. Pulmonary Embolism (PE)
5. Pneumonia
6. Tuberculosis (TB)
7. Pleural Effusion
8. Pneumothorax

For EACH pathology:
- Determine if PRESENT (true/false)
- Assign CONFIDENCE (0-100%)
- Provide REASONING with specific findings
- List SUPPORTING and CONTRADICTING evidence
- Identify WHICH SLICE(S) show the pathology (visibleInSlices array with 1-indexed slice numbers)

Return your analysis as a single JSON object with all 8 pathologies.

CRITICAL: 
- Analyze ALL 8 pathologies - do not skip any
- For POSITIVE findings, you MUST specify visibleInSlices with the slice numbers where the finding is CLEARLY VISIBLE
- Images are numbered 1, 2, 3... in the order provided`;

export async function runUnifiedAnalysis(
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
): Promise<UnifiedAnalysisResult> {
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log("🔬 Starting UNIFIED 8-pathology analysis (90% cost reduction)...");
  console.log("💰 Cost Optimization: Images sent ONCE instead of 8x");
  console.log("💾 Prompt caching: Long system prompt gets 50% discount on cached tokens");
  
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

  const imageCount = Array.isArray(base64Images) ? base64Images.length : 1;
  console.log(`📊 Analyzing ${imageCount} images in SINGLE API call`);

  // 💰 COST OPTIMIZATION: Balanced escalation thresholds
  // Only trust high-confidence negatives (≥80%) from mini model
  // All positives and uncertain results escalate to GPT-4o for accuracy
  const CONFIDENCE_THRESHOLD = 80; // Trust mini only for high-confidence negatives

  try {
    console.log("  🎯 Step 1: Unified screening with GPT-4o-mini...");
    
    const miniResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 4000,
      temperature: 0,
      seed: 12345,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: UNIFIED_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: UNIFIED_USER_PROMPT
            },
            ...imageContent
          ]
        }
      ]
    });

    const miniResult = JSON.parse(miniResponse.choices[0].message.content || "{}");
    
    const miniUsage = miniResponse.usage;
    const miniPromptTokens = miniUsage?.prompt_tokens || 0;
    const miniCachedTokens = miniUsage?.prompt_tokens_details?.cached_tokens || 0;
    const miniCompletionTokens = miniUsage?.completion_tokens || 0;
    const miniCacheHitRate = miniPromptTokens > 0 ? (miniCachedTokens / miniPromptTokens * 100) : 0;

    if (miniCachedTokens > 0) {
      console.log(`  💾 Cache hit! ${miniCachedTokens}/${miniPromptTokens} tokens cached (${miniCacheHitRate.toFixed(1)}%)`);
    }

    const pathologies = ["COPD", "ILD", "Mass", "PE", "Pneumonia", "TB", "PleuralEffusion", "Pneumothorax"];
    const pathologiesNeedingEscalation: string[] = [];
    
    for (const path of pathologies) {
      const result = miniResult[path];
      if (result) {
        // 💰 COST OPTIMIZATION + SAFETY: Smart escalation rules
        // 1. Very uncertain results (< 60%) → always escalate
        // 2. ALL POSITIVE detections → always escalate (safety - confirm with GPT-4o)
        // 3. High-confidence negatives (≥60%) → trust mini (MAIN COST SAVINGS)
        // Most studies are mostly negative, so trusting high-confidence negatives = big savings
        const isVeryUncertain = result.confidence < CONFIDENCE_THRESHOLD;
        const isPositive = result.present;
        
        const needsEscalation = isVeryUncertain || isPositive;
        
        if (needsEscalation) {
          pathologiesNeedingEscalation.push(path);
        }
        console.log(`  ${result.present ? '🔴' : '⚪'} ${path}: ${result.present ? 'DETECTED' : 'NOT DETECTED'} (${result.confidence}% confidence)${needsEscalation ? ' → escalate' : ''}`);
      }
    }

    let finalResult = miniResult;
    let totalPromptTokens = miniPromptTokens;
    let totalCachedTokens = miniCachedTokens;
    let totalCompletionTokens = miniCompletionTokens;
    let modelUsed = "gpt-4o-mini";
    
    if (pathologiesNeedingEscalation.length > 0) {
      console.log(`  ⬆️ Escalating ${pathologiesNeedingEscalation.length} pathologies to GPT-4o with DETAILED per-pathology prompts...`);
      
      const detailedPrompts = getAllPathologyPrompts({ examDate: patientInfo.examDate });
      const pathologyNameMap: Record<string, string> = {
        "COPD": "COPD",
        "ILD": "ILD", 
        "Mass": "Mass",
        "PE": "PE",
        "Pneumonia": "Pneumonia",
        "TB": "TB",
        "PleuralEffusion": "PleuralEffusion",
        "Pneumothorax": "Pneumothorax"
      };
      
      const escalationPromises = pathologiesNeedingEscalation.map(async (pathName) => {
        const prompt = detailedPrompts.find(p => p.pathologyName === pathName);
        if (!prompt) {
          console.warn(`  ⚠️ No detailed prompt found for ${pathName}`);
          return { pathName, result: null, usage: null };
        }
        
        console.log(`    🔍 Detailed analysis for ${pathName} with GPT-4o...`);
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_completion_tokens: 1000,
          temperature: 0,
          seed: 12345,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: prompt.systemPrompt
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt.userPrompt
                },
                ...imageContent
              ]
            }
          ]
        });
        
        const result = JSON.parse(response.choices[0].message.content || "{}");
        return { pathName, result, usage: response.usage };
      });
      
      const escalationResults = await Promise.all(escalationPromises);
      
      for (const { pathName, result, usage } of escalationResults) {
        if (result && usage) {
          finalResult[pathName] = result;
          totalPromptTokens += usage.prompt_tokens || 0;
          totalCachedTokens += usage.prompt_tokens_details?.cached_tokens || 0;
          totalCompletionTokens += usage.completion_tokens || 0;
          
          if ((usage.prompt_tokens_details?.cached_tokens || 0) > 0) {
            console.log(`    💾 ${pathName}: Cache hit ${usage.prompt_tokens_details?.cached_tokens}/${usage.prompt_tokens} tokens`);
          }
          console.log(`    ✅ ${pathName}: ${result.present ? 'CONFIRMED' : 'RULED OUT'} (${result.confidence}% confidence)`);
        }
      }
      
      modelUsed = `hybrid (mini unified + ${escalationResults.filter(r => r.result).length} GPT-4o detailed)`;
    }

    const results: UnifiedPathologyResult[] = pathologies.map(path => ({
      pathology: path,
      present: finalResult[path]?.present || false,
      confidence: finalResult[path]?.confidence || 0,
      subtype: finalResult[path]?.subtype,
      reasoning: finalResult[path]?.reasoning || "No findings",
      supporting_evidence: finalResult[path]?.supporting_evidence || "",
      contradicting_evidence: finalResult[path]?.contradicting_evidence || "",
      visibleInSlices: Array.isArray(finalResult[path]?.visibleInSlices) ? finalResult[path].visibleInSlices : []
    }));

    const miniInputPrice = 0.150 / 1_000_000;
    const miniCachedPrice = 0.075 / 1_000_000;
    const miniOutputPrice = 0.600 / 1_000_000;
    const gpt4oInputPrice = 2.50 / 1_000_000;
    const gpt4oCachedPrice = 1.25 / 1_000_000;
    const gpt4oOutputPrice = 10.00 / 1_000_000;

    const uncachedTokens = totalPromptTokens - totalCachedTokens;
    
    let estimatedCost: number;
    if (pathologiesNeedingEscalation.length > 0) {
      const miniCost = ((miniPromptTokens - miniCachedTokens) * miniInputPrice) +
                       (miniCachedTokens * miniCachedPrice) +
                       (miniCompletionTokens * miniOutputPrice);
      const gpt4oCost = ((totalPromptTokens - miniPromptTokens - (totalCachedTokens - miniCachedTokens)) * gpt4oInputPrice) +
                        ((totalCachedTokens - miniCachedTokens) * gpt4oCachedPrice) +
                        ((totalCompletionTokens - miniCompletionTokens) * gpt4oOutputPrice);
      estimatedCost = miniCost + gpt4oCost;
    } else {
      estimatedCost = (uncachedTokens * miniInputPrice) +
                      (totalCachedTokens * miniCachedPrice) +
                      (totalCompletionTokens * miniOutputPrice);
    }

    const baselinePromptTokensPerPathology = miniPromptTokens;
    const legacyCost = (baselinePromptTokensPerPathology * 8 * gpt4oInputPrice) + (500 * 8 * gpt4oOutputPrice);
    
    const savingsPercentage = legacyCost > 0 ? ((legacyCost - estimatedCost) / legacyCost * 100) : 0;

    console.log(`\n💰 UNIFIED ANALYSIS COST REPORT:`);
    console.log(`  📊 Total tokens: ${totalPromptTokens.toLocaleString()} prompt + ${totalCompletionTokens.toLocaleString()} completion`);
    console.log(`  💾 Cache: ${totalCachedTokens.toLocaleString()} tokens cached (${totalPromptTokens > 0 ? (totalCachedTokens/totalPromptTokens*100).toFixed(1) : 0}% hit rate)`);
    console.log(`  💵 Actual cost: $${estimatedCost.toFixed(4)}`);
    console.log(`  📉 Legacy 8x GPT-4o cost: $${legacyCost.toFixed(4)}`);
    console.log(`  🎯 SAVINGS: ${savingsPercentage.toFixed(1)}% cost reduction!`);
    console.log(`  📋 Escalated pathologies: ${pathologiesNeedingEscalation.length}/8`);

    return {
      results,
      costMetrics: {
        promptTokens: totalPromptTokens,
        cachedTokens: totalCachedTokens,
        completionTokens: totalCompletionTokens,
        cacheHitRate: totalPromptTokens > 0 ? (totalCachedTokens / totalPromptTokens * 100) : 0,
        estimatedCost,
        fullCostIfSeparate: legacyCost,
        savingsPercentage
      },
      modelUsed,
      escalatedPathologies: pathologiesNeedingEscalation.length > 0 ? pathologiesNeedingEscalation : undefined
    };

  } catch (error) {
    console.error("❌ Unified analysis failed:", error);
    throw error;
  }
}

export function mergeUnifiedResults(analysis: UnifiedAnalysisResult): any {
  const resultMap = new Map(analysis.results.map(r => [r.pathology, r]));
  
  const copdResult = resultMap.get("COPD");
  const ildResult = resultMap.get("ILD");
  const massResult = resultMap.get("Mass");
  const peResult = resultMap.get("PE");
  const pneumoniaResult = resultMap.get("Pneumonia");
  const tbResult = resultMap.get("TB");
  const pleuralResult = resultMap.get("PleuralEffusion");
  const pneumothoraxResult = resultMap.get("Pneumothorax");

  const avgConfidence = analysis.results.reduce((sum, r) => sum + r.confidence, 0) / analysis.results.length;

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
    details: "Unified 8-pathology analysis completed (90% cost optimized)",
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
      reasoning: copdResult?.reasoning || "No COPD detected",
      visibleInSlices: copdResult?.visibleInSlices || []
    },
    ILD: {
      present: ildResult?.present || false,
      confidence: ildResult?.confidence || 0,
      subtype: ildResult?.subtype || "none",
      reasoning: ildResult?.reasoning || "No ILD detected",
      visibleInSlices: ildResult?.visibleInSlices || []
    },
    Lung_Cancer: {
      present: massResult?.present || false,
      confidence: massResult?.confidence || 0,
      reasoning: massResult?.reasoning || "No masses detected",
      visibleInSlices: massResult?.visibleInSlices || []
    },
    Pulmonary_Embolism: {
      present: peResult?.present || false,
      confidence: peResult?.confidence || 0,
      reasoning: peResult?.reasoning || "No PE detected",
      visibleInSlices: peResult?.visibleInSlices || []
    },
    Pneumonia: {
      present: pneumoniaResult?.present || false,
      confidence: pneumoniaResult?.confidence || 0,
      reasoning: pneumoniaResult?.reasoning || "No pneumonia detected",
      visibleInSlices: pneumoniaResult?.visibleInSlices || []
    },
    Tuberculosis: {
      present: tbResult?.present || false,
      confidence: tbResult?.confidence || 0,
      reasoning: tbResult?.reasoning || "No TB detected",
      visibleInSlices: tbResult?.visibleInSlices || []
    },
    Pleural_Effusion: {
      present: pleuralResult?.present || false,
      confidence: pleuralResult?.confidence || 0,
      reasoning: pleuralResult?.reasoning || "No pleural effusion",
      visibleInSlices: pleuralResult?.visibleInSlices || []
    },
    Pneumothorax: {
      present: pneumothoraxResult?.present || false,
      confidence: pneumothoraxResult?.confidence || 0,
      reasoning: pneumothoraxResult?.reasoning || "No pneumothorax",
      visibleInSlices: pneumothoraxResult?.visibleInSlices || []
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
    detailedFindings: analysis.results.map(r => `${r.pathology}: ${r.reasoning}`).join("\n\n"),
    primaryDiagnosis: "Unified analysis completed",
    recommendations: [],
    votingMetadata: {
      batchCount: 1,
      pathologyVotes: {}
    },
    costMetrics: analysis.costMetrics
  };
}
