/**
 * CONSOLIDATED ESCALATION SYSTEM
 * Batches all pathologies needing escalation into ONE GPT-4o call
 * Each pathology is fully evaluated with isolated analysis blocks
 */

import OpenAI from "openai";
import { BudgetTracker, TokenUsage } from "./budget-tracker";

export interface EscalationCandidate {
  pathologyName: string;
  miniResult: {
    present: boolean;
    confidence: number;
    subtype?: string;
    reasoning: string;
    supporting_evidence: string;
    contradicting_evidence: string;
  };
  systemPrompt: string;
  userPrompt: string;
}

export interface ConsolidatedResult {
  pathology: string;
  present: boolean;
  confidence: number;
  subtype?: string;
  reasoning: string;
  supporting_evidence: string;
  contradicting_evidence: string;
}

export interface ConsolidatedEscalationResponse {
  results: ConsolidatedResult[];
  tokenUsage: TokenUsage;
  cost: number;
  wasGpt4oUsed: boolean; // True if actual GPT-4o call was made, false if degraded to mini results
}

/**
 * Build the consolidated system prompt for isolated pathology evaluation
 */
function buildConsolidatedSystemPrompt(): string {
  return `You are an expert radiologist AI system performing CONSOLIDATED multi-pathology analysis.

CRITICAL ISOLATION RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. EVALUATE EACH PATHOLOGY COMPLETELY INDEPENDENTLY
2. DO NOT let findings from one pathology influence another
3. Treat each PATHOLOGY_BLOCK as a SEPARATE mini-case
4. Base each decision ONLY on evidence within that pathology's scope
5. Report uncertainty honestly - do not force conclusions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE FORMAT:
You MUST respond with a JSON object containing an array of pathology results.
Each pathology MUST have its own complete, independent analysis.

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
    }
  ]
}

IMPORTANT:
- Analyze each pathology in the order presented
- Complete one pathology's full analysis before moving to the next
- Each pathology gets its own isolated decision
- Do not reference other pathologies in your reasoning`;
}

/**
 * Build user prompt with isolated pathology blocks
 */
function buildConsolidatedUserPrompt(
  candidates: EscalationCandidate[],
  imageContent: Array<{ type: "image_url"; image_url: { url: string } }>
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const pathologyBlocks = candidates.map((candidate, index) => {
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║ PATHOLOGY BLOCK ${index + 1}/${candidates.length}: ${candidate.pathologyName.toUpperCase()}
╠══════════════════════════════════════════════════════════════════════════════╣
║ EVALUATE THIS PATHOLOGY COMPLETELY INDEPENDENTLY                              ║
║ DO NOT reference other pathologies in your analysis                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

TRIAGE SUMMARY (from initial screening):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Initial Detection: ${candidate.miniResult.present ? 'POSSIBLE POSITIVE' : 'UNCERTAIN'}
• Initial Confidence: ${candidate.miniResult.confidence}%
• Initial Reasoning: ${candidate.miniResult.reasoning}
• Initial Evidence For: ${candidate.miniResult.supporting_evidence || 'N/A'}
• Initial Evidence Against: ${candidate.miniResult.contradicting_evidence || 'N/A'}
${candidate.miniResult.subtype ? `• Initial Subtype: ${candidate.miniResult.subtype}` : ''}

PATHOLOGY-SPECIFIC EVALUATION CRITERIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${candidate.userPrompt}

YOUR TASK FOR ${candidate.pathologyName.toUpperCase()}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Re-examine the CT images focusing ONLY on ${candidate.pathologyName} features
2. Confirm or refute the initial screening findings
3. Provide detailed evidence-based reasoning
4. Assign final confidence score
5. Complete this pathology's analysis before proceeding

═══════════════════════════════════════════════════════════════════════════════
END OF ${candidate.pathologyName.toUpperCase()} BLOCK
═══════════════════════════════════════════════════════════════════════════════
`;
  }).join('\n\n');

  const textContent = `CONSOLIDATED PATHOLOGY ESCALATION ANALYSIS
════════════════════════════════════════════════════════════════════════════════
You are reviewing ${candidates.length} patholog${candidates.length > 1 ? 'ies' : 'y'} that require expert confirmation.
Each pathology MUST be evaluated COMPLETELY INDEPENDENTLY.

IMAGES: The CT scan images are provided below for your analysis.

${pathologyBlocks}

FINAL INSTRUCTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Analyze each pathology block SEQUENTIALLY and INDEPENDENTLY
2. For EACH pathology, provide a complete isolated analysis
3. DO NOT let one pathology's findings influence another
4. Return results in the exact JSON format specified
5. Include ALL ${candidates.length} patholog${candidates.length > 1 ? 'ies' : 'y'} in your response

Respond with ONLY the JSON object containing "pathologyResults" array.`;

  return [
    { type: "text" as const, text: textContent },
    ...imageContent
  ];
}

/**
 * Execute consolidated escalation for all candidates in ONE API call
 * Enforces budget limit before making the call
 */
export async function runConsolidatedEscalation(
  candidates: EscalationCandidate[],
  base64Images: string | string[],
  budgetTracker: BudgetTracker
): Promise<ConsolidatedEscalationResponse> {
  
  if (candidates.length === 0) {
    return {
      results: [],
      tokenUsage: { promptTokens: 0, cachedTokens: 0, completionTokens: 0 },
      cost: 0,
      wasGpt4oUsed: false
    };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log(`\n🔄 CONSOLIDATED ESCALATION: Processing ${candidates.length} patholog${candidates.length > 1 ? 'ies' : 'y'} in ONE GPT-4o call`);
  console.log(`   Pathologies: ${candidates.map(c => c.pathologyName).join(', ')}`);

  // BUDGET ENFORCEMENT: Estimate cost before making call
  // Estimate ~2000 prompt tokens per image + 500 per pathology block + 300 completion per pathology
  const imageCount = Array.isArray(base64Images) ? base64Images.length : 1;
  const estimatedPromptTokens = (imageCount * 2000) + (candidates.length * 500);
  const estimatedCompletionTokens = candidates.length * 300;
  
  if (!budgetTracker.canAfford('gpt-4o', { prompt: estimatedPromptTokens, completion: estimatedCompletionTokens })) {
    console.log(`   ⚠️ BUDGET LIMIT: Projected cost would exceed $3.00 limit`);
    console.log(`   📉 DEGRADING: Using mini screening results instead of GPT-4o confirmation`);
    
    // Return mini results without escalation to stay within budget
    return {
      results: candidates.map(c => ({
        pathology: c.pathologyName,
        present: c.miniResult.present,
        confidence: Math.min(c.miniResult.confidence, 80), // Cap confidence since not confirmed
        subtype: c.miniResult.subtype,
        reasoning: c.miniResult.reasoning + " [Budget limit reached - not confirmed by GPT-4o]",
        supporting_evidence: c.miniResult.supporting_evidence,
        contradicting_evidence: c.miniResult.contradicting_evidence
      })),
      tokenUsage: { promptTokens: 0, cachedTokens: 0, completionTokens: 0 },
      cost: 0,
      wasGpt4oUsed: false // Budget blocked the GPT-4o call
    };
  }

  console.log(`   💰 Budget check passed: $${budgetTracker.getRemainingBudget().toFixed(4)} remaining`);

  const imageContent = Array.isArray(base64Images)
    ? base64Images.map(img => ({
        type: "image_url" as const,
        image_url: { url: `data:image/png;base64,${img}` }
      }))
    : [{
        type: "image_url" as const,
        image_url: { url: `data:image/png;base64,${base64Images}` }
      }];

  const systemPrompt = buildConsolidatedSystemPrompt();
  const userContent = buildConsolidatedUserPrompt(candidates, imageContent);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 2000 + (candidates.length * 300),
      temperature: 0,
      seed: 12345,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    });

    const usage = response.usage;
    const tokenUsage: TokenUsage = {
      promptTokens: usage?.prompt_tokens || 0,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens || 0,
      completionTokens: usage?.completion_tokens || 0
    };

    const cost = budgetTracker.recordCall('gpt-4o', tokenUsage);

    const cacheHitRate = tokenUsage.promptTokens > 0 
      ? (tokenUsage.cachedTokens / tokenUsage.promptTokens * 100) 
      : 0;

    if (tokenUsage.cachedTokens > 0) {
      console.log(`   💾 Cache hit! ${tokenUsage.cachedTokens}/${tokenUsage.promptTokens} tokens (${cacheHitRate.toFixed(1)}%)`);
    }
    console.log(`   💵 Consolidated call cost: $${cost.toFixed(4)}`);

    const responseContent = JSON.parse(response.choices[0].message.content || "{}");
    const pathologyResults = responseContent.pathologyResults || [];

    const results: ConsolidatedResult[] = candidates.map(candidate => {
      const result = pathologyResults.find(
        (r: any) => r.pathologyId?.toLowerCase() === candidate.pathologyName.toLowerCase() ||
                   r.pathologyId?.toLowerCase().replace(/[_\s]/g, '') === candidate.pathologyName.toLowerCase().replace(/[_\s]/g, '')
      );

      if (result) {
        console.log(`   ✅ ${candidate.pathologyName}: ${result.present ? 'DETECTED' : 'NOT DETECTED'} (${result.confidence}% confidence)`);
        return {
          pathology: candidate.pathologyName,
          present: result.present || false,
          confidence: result.confidence || 0,
          subtype: result.subtype || candidate.miniResult.subtype,
          reasoning: result.reasoning || "",
          supporting_evidence: result.supporting_evidence || "",
          contradicting_evidence: result.contradicting_evidence || ""
        };
      } else {
        console.log(`   ⚠️ ${candidate.pathologyName}: Using mini result (not found in consolidated response)`);
        return {
          pathology: candidate.pathologyName,
          present: candidate.miniResult.present,
          confidence: candidate.miniResult.confidence,
          subtype: candidate.miniResult.subtype,
          reasoning: candidate.miniResult.reasoning,
          supporting_evidence: candidate.miniResult.supporting_evidence,
          contradicting_evidence: candidate.miniResult.contradicting_evidence
        };
      }
    });

    return { results, tokenUsage, cost, wasGpt4oUsed: true };

  } catch (error) {
    console.error(`   ❌ Consolidated escalation failed:`, error);
    
    return {
      results: candidates.map(c => ({
        pathology: c.pathologyName,
        present: c.miniResult.present,
        confidence: c.miniResult.confidence,
        subtype: c.miniResult.subtype,
        reasoning: c.miniResult.reasoning + " (escalation failed, using screening result)",
        supporting_evidence: c.miniResult.supporting_evidence,
        contradicting_evidence: c.miniResult.contradicting_evidence
      })),
      tokenUsage: { promptTokens: 0, cachedTokens: 0, completionTokens: 0 },
      cost: 0,
      wasGpt4oUsed: false // API call failed
    };
  }
}
