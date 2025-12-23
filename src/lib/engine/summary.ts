// =============================================
// MasterContractorOS Project Summary Engine
// Safety Constitution Embedded
// =============================================

import { 
  Quote, 
  Gap, 
  Decision,
  ProjectSummary,
  ConfidenceLevel 
} from '@/types/mastercontractor';

/**
 * Calculate verified cost from quotes
 * Safety Constitution: Wrapper Truth Rule
 * - If is_wrapper=true and reconciliation_rule=AUTHORITATIVE, use wrapper.total
 * - Child quotes are for audit only, never additive
 */
export function calculateVerifiedCost(quotes: Quote[]): number {
  let total = 0;
  const processedWrapperChildren = new Set<string>();
  
  // First, identify authoritative wrappers
  const authoritativeWrappers = quotes.filter(
    q => q.is_wrapper && q.reconciliation_rule === 'AUTHORITATIVE' && q.status === 'VERIFIED'
  );
  
  // Add wrapper totals and mark their children as processed
  for (const wrapper of authoritativeWrappers) {
    total += wrapper.total || 0;
    
    // Find child quotes (quotes with parent_quote_id = wrapper.id)
    const children = quotes.filter(q => q.parent_quote_id === wrapper.id);
    children.forEach(child => processedWrapperChildren.add(child.id));
  }
  
  // Add non-wrapper verified quotes that aren't children of authoritative wrappers
  for (const quote of quotes) {
    if (quote.status !== 'VERIFIED') continue;
    if (quote.is_wrapper) continue; // Already processed above if authoritative
    if (processedWrapperChildren.has(quote.id)) continue; // Skip wrapper children
    
    // Only add if reconciliation_rule is ADDITIVE
    if (quote.reconciliation_rule === 'ADDITIVE') {
      total += quote.total || 0;
    }
  }
  
  return total;
}

/**
 * Calculate pending cost (quotes not yet verified)
 */
export function calculatePendingCost(quotes: Quote[]): number {
  return quotes
    .filter(q => q.status === 'PENDING' || q.status === 'DECISION_REQUIRED')
    .reduce((sum, q) => sum + (q.total || 0), 0);
}

/**
 * Calculate estimated cost from gaps
 * Safety Constitution: Zero-Quote Mode - show ranges
 */
export function calculateEstimatedCost(gaps: Gap[]): {
  low: number;
  mid: number;
  high: number;
} {
  const unresolvedGaps = gaps.filter(g => !g.resolved);
  
  return {
    low: unresolvedGaps.reduce((sum, g) => sum + (g.estimated_low || 0), 0),
    mid: unresolvedGaps.reduce((sum, g) => sum + (g.estimated_mid || 0), 0),
    high: unresolvedGaps.reduce((sum, g) => sum + (g.estimated_high || 0), 0)
  };
}

/**
 * Determine overall project confidence
 * Based on: verified %, gaps, pending decisions
 */
export function determineConfidence(
  verifiedCost: number,
  pendingCost: number,
  estimatedMid: number,
  gapCount: number,
  decisionCount: number
): ConfidenceLevel {
  const totalEstimate = verifiedCost + pendingCost + estimatedMid;
  
  if (totalEstimate === 0) return 'LOW';
  
  const verifiedPercent = (verifiedCost / totalEstimate) * 100;
  
  // HIGH: >80% verified, <2 gaps, <2 decisions pending
  if (verifiedPercent > 80 && gapCount < 2 && decisionCount < 2) {
    return 'HIGH';
  }
  
  // MEDIUM: >50% verified, <5 gaps, <5 decisions pending
  if (verifiedPercent > 50 && gapCount < 5 && decisionCount < 5) {
    return 'MEDIUM';
  }
  
  // LOW: Everything else
  return 'LOW';
}

/**
 * Generate full project summary
 */
export function generateProjectSummary(
  quotes: Quote[],
  gaps: Gap[],
  decisions: Decision[]
): ProjectSummary {
  const verifiedCost = calculateVerifiedCost(quotes);
  const pendingCost = calculatePendingCost(quotes);
  const estimatedCost = calculateEstimatedCost(gaps);
  const gapCount = gaps.filter(g => !g.resolved).length;
  const decisionCount = decisions.filter(d => !d.resolved).length;
  
  const confidence = determineConfidence(
    verifiedCost,
    pendingCost,
    estimatedCost.mid,
    gapCount,
    decisionCount
  );
  
  return {
    verifiedCost,
    pendingCost,
    estimatedCost,
    gapCount,
    decisionCount,
    confidence
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format cost range for display
 */
export function formatCostRange(low: number, mid: number, high: number): string {
  if (low === 0 && high === 0) return 'No estimate';
  return `${formatCurrency(low)} - ${formatCurrency(high)}`;
}
