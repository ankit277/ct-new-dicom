/**
 * BUDGET TRACKER FOR $3 COST CEILING
 * Tracks API costs per analysis and enforces budget limits
 */

export interface TokenUsage {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
}

export interface CostMetrics {
  totalCost: number;
  miniCost: number;
  gpt4oCost: number;
  tokenBreakdown: {
    miniPromptTokens: number;
    miniCachedTokens: number;
    miniCompletionTokens: number;
    gpt4oPromptTokens: number;
    gpt4oCachedTokens: number;
    gpt4oCompletionTokens: number;
  };
}

// OpenAI pricing (as of 2025)
const PRICING = {
  'gpt-4o': {
    input: 2.50 / 1_000_000,
    cached: 1.25 / 1_000_000,
    output: 10.00 / 1_000_000,
  },
  'gpt-4o-mini': {
    input: 0.150 / 1_000_000,
    cached: 0.075 / 1_000_000,
    output: 0.600 / 1_000_000,
  },
};

export class BudgetTracker {
  private budgetLimit: number;
  private currentCost: number = 0;
  private metrics: CostMetrics;

  constructor(budgetLimit: number = 1.0) {
    this.budgetLimit = budgetLimit;
    this.metrics = {
      totalCost: 0,
      miniCost: 0,
      gpt4oCost: 0,
      tokenBreakdown: {
        miniPromptTokens: 0,
        miniCachedTokens: 0,
        miniCompletionTokens: 0,
        gpt4oPromptTokens: 0,
        gpt4oCachedTokens: 0,
        gpt4oCompletionTokens: 0,
      },
    };
  }

  /**
   * Calculate cost for a given model and token usage
   */
  calculateCost(model: 'gpt-4o' | 'gpt-4o-mini', usage: TokenUsage): number {
    const pricing = PRICING[model];
    const uncachedTokens = usage.promptTokens - usage.cachedTokens;
    
    return (
      (uncachedTokens * pricing.input) +
      (usage.cachedTokens * pricing.cached) +
      (usage.completionTokens * pricing.output)
    );
  }

  /**
   * Project cost for next API call without committing
   */
  projectCost(model: 'gpt-4o' | 'gpt-4o-mini', estimatedTokens: { prompt: number; completion: number }): number {
    const pricing = PRICING[model];
    return (estimatedTokens.prompt * pricing.input) + (estimatedTokens.completion * pricing.output);
  }

  /**
   * Check if budget allows for next call
   */
  canAfford(model: 'gpt-4o' | 'gpt-4o-mini', estimatedTokens: { prompt: number; completion: number }): boolean {
    const projectedCost = this.projectCost(model, estimatedTokens);
    return (this.currentCost + projectedCost) <= this.budgetLimit;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return Math.max(0, this.budgetLimit - this.currentCost);
  }

  /**
   * Record actual API call cost
   */
  recordCall(model: 'gpt-4o' | 'gpt-4o-mini', usage: TokenUsage): number {
    const cost = this.calculateCost(model, usage);
    this.currentCost += cost;
    this.metrics.totalCost = this.currentCost;

    if (model === 'gpt-4o-mini') {
      this.metrics.miniCost += cost;
      this.metrics.tokenBreakdown.miniPromptTokens += usage.promptTokens;
      this.metrics.tokenBreakdown.miniCachedTokens += usage.cachedTokens;
      this.metrics.tokenBreakdown.miniCompletionTokens += usage.completionTokens;
    } else {
      this.metrics.gpt4oCost += cost;
      this.metrics.tokenBreakdown.gpt4oPromptTokens += usage.promptTokens;
      this.metrics.tokenBreakdown.gpt4oCachedTokens += usage.cachedTokens;
      this.metrics.tokenBreakdown.gpt4oCompletionTokens += usage.completionTokens;
    }

    return cost;
  }

  /**
   * Check if budget exceeded
   */
  isBudgetExceeded(): boolean {
    return this.currentCost > this.budgetLimit;
  }

  /**
   * Get current cost
   */
  getCurrentCost(): number {
    return this.currentCost;
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }

  /**
   * Get budget utilization percentage
   */
  getUtilization(): number {
    return (this.currentCost / this.budgetLimit) * 100;
  }

  /**
   * Format cost report for logging
   */
  getReport(): string {
    const remaining = this.getRemainingBudget();
    const utilization = this.getUtilization();
    
    return `
💰 BUDGET TRACKER REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━
Budget Limit: $${this.budgetLimit.toFixed(2)}
Current Cost: $${this.currentCost.toFixed(4)}
Remaining:    $${remaining.toFixed(4)}
Utilization:  ${utilization.toFixed(1)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━
Mini Cost:    $${this.metrics.miniCost.toFixed(4)}
GPT-4o Cost:  $${this.metrics.gpt4oCost.toFixed(4)}
━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${this.isBudgetExceeded() ? '❌ BUDGET EXCEEDED' : '✅ WITHIN BUDGET'}
    `.trim();
  }
}
