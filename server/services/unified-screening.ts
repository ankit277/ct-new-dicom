/**
 * UNIFIED SINGLE-CALL SCREENING
 * Replaces 8 separate GPT-4o-mini calls with ONE consolidated call
 * Achieves ~8x reduction in API round-trip latency
 */

import OpenAI from "openai";
import { getAllPathologyPrompts, type PathologyPrompt } from "./independent-analysis";
import { BudgetTracker, TokenUsage } from "./budget-tracker";

export interface UnifiedScreeningResult {
  pathology: string;
  present: boolean;
  confidence: number;
  subtype?: string;
  reasoning: string;
  supporting_evidence: string;
  contradicting_evidence: string;
}

export interface UnifiedScreeningResponse {
  results: UnifiedScreeningResult[];
  tokenUsage: TokenUsage;
  cost: number;
}

// Canonical pathology names from independent-analysis.ts
const CANONICAL_PATHOLOGY_NAMES = [
  "COPD", "ILD", "Mass", "PE", "Pneumonia", "TB", "PleuralEffusion", "Pneumothorax"
];

// Map variations to canonical names
const PATHOLOGY_NAME_MAP: Record<string, string> = {
  "COPD": "COPD",
  "copd": "COPD",
  "ILD": "ILD",
  "ild": "ILD",
  "Mass": "Mass",
  "mass": "Mass",
  "Mass/Nodule": "Mass",
  "Lung Cancer": "Mass",
  "Nodule": "Mass",
  "PE": "PE",
  "pe": "PE",
  "Pulmonary Embolism": "PE",
  "Pulmonary_Embolism": "PE",
  "Pneumonia": "Pneumonia",
  "pneumonia": "Pneumonia",
  "TB": "TB",
  "tb": "TB",
  "Tuberculosis": "TB",
  "PleuralEffusion": "PleuralEffusion",
  "Pleural Effusion": "PleuralEffusion",
  "Pleural_Effusion": "PleuralEffusion",
  "pleuraleffusion": "PleuralEffusion",
  "Pneumothorax": "Pneumothorax",
  "pneumothorax": "Pneumothorax"
};

/**
 * Build the unified system prompt for all 8 pathologies
 */
function buildUnifiedSystemPrompt(): string {
  return `You are an expert radiologist AI system performing UNIFIED multi-pathology screening.

CRITICAL ISOLATION RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. EVALUATE EACH PATHOLOGY COMPLETELY INDEPENDENTLY
2. DO NOT let findings from one pathology influence another
3. Treat each PATHOLOGY_BLOCK as a SEPARATE mini-case
4. Base each decision ONLY on evidence within that pathology's scope
5. Report uncertainty honestly - do not force conclusions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE FORMAT:
You MUST respond with a JSON object containing an array of EXACTLY 8 pathology results.
Each pathology MUST have its own complete, independent analysis.
Use these EXACT pathologyId values: COPD, ILD, Mass, PE, Pneumonia, TB, PleuralEffusion, Pneumothorax

{
  "pathologyResults": [
    {
      "pathologyId": "COPD",
      "present": boolean,
      "confidence": number (0-100),
      "subtype": string or null,
      "reasoning": "comprehensive independent reasoning for THIS pathology only",
      "supporting_evidence": "evidence FOR this pathology",
      "contradicting_evidence": "evidence AGAINST this pathology"
    },
    {
      "pathologyId": "ILD",
      ...
    },
    {
      "pathologyId": "Mass",
      ...
    },
    {
      "pathologyId": "PE",
      ...
    },
    {
      "pathologyId": "Pneumonia",
      ...
    },
    {
      "pathologyId": "TB",
      ...
    },
    {
      "pathologyId": "PleuralEffusion",
      ...
    },
    {
      "pathologyId": "Pneumothorax",
      ...
    }
  ]
}

CRITICAL:
- You MUST include ALL 8 pathologies in your response
- Use EXACT pathologyId values: COPD, ILD, Mass, PE, Pneumonia, TB, PleuralEffusion, Pneumothorax
- Analyze each pathology in the order presented
- Complete one pathology's full analysis before moving to the next
- Each pathology gets its own isolated decision
- Do not reference other pathologies in your reasoning`;
}

/**
 * Build user prompt with all 8 pathology blocks
 */
function buildUnifiedUserPrompt(
  prompts: PathologyPrompt[],
  imageContent: Array<{ type: "image_url"; image_url: { url: string } }>
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const pathologyBlocks = prompts.map((prompt, index) => {
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║ PATHOLOGY BLOCK ${index + 1}/${prompts.length}: ${prompt.pathologyName.toUpperCase()} (pathologyId: "${prompt.pathologyName}")
╠══════════════════════════════════════════════════════════════════════════════╣
║ EVALUATE THIS PATHOLOGY COMPLETELY INDEPENDENTLY                              ║
║ DO NOT reference other pathologies in your analysis                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

PATHOLOGY-SPECIFIC EVALUATION CRITERIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${prompt.userPrompt}

YOUR TASK FOR ${prompt.pathologyName.toUpperCase()}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Examine the CT images focusing ONLY on ${prompt.pathologyName} features
2. Identify evidence for and against this pathology
3. Provide detailed evidence-based reasoning
4. Assign confidence score (0-100)
5. Complete this pathology's analysis before proceeding

═══════════════════════════════════════════════════════════════════════════════
END OF ${prompt.pathologyName.toUpperCase()} BLOCK
═══════════════════════════════════════════════════════════════════════════════
`;
  }).join('\n\n');

  const textContent = `UNIFIED 8-PATHOLOGY SCREENING ANALYSIS
════════════════════════════════════════════════════════════════════════════════
Evaluate ALL 8 pathologies in a SINGLE pass. Each pathology MUST be evaluated COMPLETELY INDEPENDENTLY.

REQUIRED pathologyId values (use EXACTLY these): COPD, ILD, Mass, PE, Pneumonia, TB, PleuralEffusion, Pneumothorax

IMAGES: The CT scan images are provided below for your analysis.

${pathologyBlocks}

FINAL INSTRUCTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Analyze each pathology block SEQUENTIALLY and INDEPENDENTLY
2. For EACH pathology, provide a complete isolated analysis
3. DO NOT let one pathology's findings influence another
4. Return results in the exact JSON format specified
5. Include ALL 8 pathologies using EXACT pathologyId values:
   COPD, ILD, Mass, PE, Pneumonia, TB, PleuralEffusion, Pneumothorax

Respond with ONLY the JSON object containing "pathologyResults" array with EXACTLY 8 entries.`;

  return [
    { type: "text" as const, text: textContent },
    ...imageContent
  ];
}

/**
 * Normalize pathology name to canonical form
 */
function normalizePathologyName(name: string): string {
  return PATHOLOGY_NAME_MAP[name] || PATHOLOGY_NAME_MAP[name.trim()] || name;
}

/**
 * Execute unified screening for all 8 pathologies in ONE API call
 * Replaces 8 separate parallel calls with 1 consolidated call
 */
export async function runUnifiedScreening(
  base64Images: string | string[],
  examDate: string,
  budgetTracker: BudgetTracker
): Promise<UnifiedScreeningResponse> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompts = getAllPathologyPrompts({ examDate });

  console.log(`\n⚡ UNIFIED SCREENING: Processing all 8 pathologies in ONE GPT-4o-mini call`);

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

  const systemPrompt = buildUnifiedSystemPrompt();
  const userContent = buildUnifiedUserPrompt(prompts, imageContent);

  try {
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 4000,
      temperature: 0,
      seed: 12345,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`  ✅ Unified screening completed in ${(elapsedMs / 1000).toFixed(2)}s`);

    const usage = response.usage;
    const tokenUsage: TokenUsage = {
      promptTokens: usage?.prompt_tokens || 0,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens || 0,
      completionTokens: usage?.completion_tokens || 0
    };

    budgetTracker.recordCall('gpt-4o-mini', tokenUsage);

    if (tokenUsage.cachedTokens > 0) {
      const cacheRate = (tokenUsage.cachedTokens / tokenUsage.promptTokens * 100).toFixed(1);
      console.log(`  💾 Cache hit: ${cacheRate}% (${tokenUsage.cachedTokens}/${tokenUsage.promptTokens} tokens)`);
    }

    const responseContent = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(responseContent);

    // Parse and normalize results
    const rawResults = parsed.pathologyResults || [];
    const resultMap = new Map<string, UnifiedScreeningResult>();

    for (const r of rawResults) {
      const rawId = r.pathologyId || r.pathology || "";
      const normalizedId = normalizePathologyName(rawId);
      
      if (CANONICAL_PATHOLOGY_NAMES.includes(normalizedId)) {
        resultMap.set(normalizedId, {
          pathology: normalizedId,
          present: r.present || false,
          confidence: r.confidence || 0,
          subtype: r.subtype,
          reasoning: r.reasoning || "",
          supporting_evidence: r.supporting_evidence || "",
          contradicting_evidence: r.contradicting_evidence || ""
        });
      } else {
        console.warn(`  ⚠️ Unrecognized pathology ID: "${rawId}" (normalized: "${normalizedId}")`);
      }
    }

    // VALIDATION: Ensure ALL 8 pathologies are present
    const missingPathologies: string[] = [];
    for (const name of CANONICAL_PATHOLOGY_NAMES) {
      if (!resultMap.has(name)) {
        missingPathologies.push(name);
      }
    }

    if (missingPathologies.length > 0) {
      console.warn(`  ⚠️ Missing ${missingPathologies.length} pathologies: ${missingPathologies.join(', ')}`);
      console.warn(`  ⚠️ Adding default entries for missing pathologies (will force escalation for safety)`);
      
      // Add defaults for missing pathologies - with LOW confidence to force escalation
      for (const name of missingPathologies) {
        resultMap.set(name, {
          pathology: name,
          present: false,
          confidence: 50, // Low confidence forces escalation for safety
          reasoning: "Not returned in unified screening - requires individual evaluation",
          supporting_evidence: "",
          contradicting_evidence: ""
        });
      }
    }

    // Build final results in canonical order
    const completeResults = CANONICAL_PATHOLOGY_NAMES.map(name => resultMap.get(name)!);

    const cost = budgetTracker.getMetrics().miniCost;
    console.log(`  💰 Unified screening cost: $${cost.toFixed(4)}`);
    console.log(`  📊 Received ${rawResults.length}/8 pathologies, ${8 - missingPathologies.length}/8 matched`);

    return {
      results: completeResults,
      tokenUsage,
      cost
    };

  } catch (error) {
    console.error("❌ Unified screening failed:", error);
    
    // Return low-confidence results on failure to force escalation
    console.warn("  ⚠️ Falling back to low-confidence defaults (will force escalation)");
    return {
      results: CANONICAL_PATHOLOGY_NAMES.map(name => ({
        pathology: name,
        present: false,
        confidence: 50, // Low confidence forces escalation for safety
        reasoning: "Unified screening failed - requires individual evaluation",
        supporting_evidence: "",
        contradicting_evidence: ""
      })),
      tokenUsage: { promptTokens: 0, cachedTokens: 0, completionTokens: 0 },
      cost: 0
    };
  }
}
