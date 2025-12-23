// =============================================
// MasterContractorOS Dedupe Engine
// Safety Constitution Embedded
// =============================================

import { 
  MatchResult, 
  DedupeResult, 
  Line, 
  Quote,
  SAFETY_RULES 
} from '@/types/mastercontractor';

/**
 * Check if two amounts match exactly (within rounding tolerance)
 */
export function isExactMatch(amount1: number, amount2: number): boolean {
  return Math.abs(amount1 - amount2) < 0.01;
}

/**
 * Check if amounts are within soft match threshold
 * Safety Constitution: SOFT_MATCH_VARIANCE_PERCENT = 8%
 */
export function isSoftMatch(amount1: number, amount2: number): boolean {
  if (amount1 === 0 || amount2 === 0) return false;
  const variance = Math.abs(amount1 - amount2) / Math.max(amount1, amount2) * 100;
  return variance <= SAFETY_RULES.SOFT_MATCH_VARIANCE_PERCENT && variance > 0;
}

/**
 * Calculate variance percentage between two amounts
 */
export function getVariancePercent(amount1: number, amount2: number): number {
  if (amount1 === 0 && amount2 === 0) return 0;
  if (amount1 === 0 || amount2 === 0) return 100;
  return Math.abs(amount1 - amount2) / Math.max(amount1, amount2) * 100;
}

/**
 * Check for text evidence linking two quotes/lines
 * Safety Constitution: Only use extracted strings, never internal UUIDs
 */
export function hasTextEvidence(
  parentQuote: Quote,
  childQuote: Quote
): { hasEvidence: boolean; details: string } {
  const parentText = (parentQuote.raw_text || '').toLowerCase();
  const parentNotes = (parentQuote.notes || '').toLowerCase();
  const combinedParent = `${parentText} ${parentNotes}`;
  
  const childVendor = childQuote.vendor_name.toLowerCase();
  const childQuoteNum = (childQuote.quote_number || '').toLowerCase();
  
  const evidenceFound: string[] = [];
  
  // Check if parent mentions child vendor name
  if (childVendor && combinedParent.includes(childVendor)) {
    evidenceFound.push(`Vendor "${childQuote.vendor_name}" found in parent`);
  }
  
  // Check if parent mentions child quote number
  if (childQuoteNum && combinedParent.includes(childQuoteNum)) {
    evidenceFound.push(`Quote# "${childQuote.quote_number}" found in parent`);
  }
  
  return {
    hasEvidence: evidenceFound.length > 0,
    details: evidenceFound.join('; ')
  };
}

/**
 * Check for Tax Trap: Parent line matches child SUBTOTAL while child has different TOTAL
 * Safety Constitution: Match parent line to child TOTAL or SUBTOTAL exactly
 */
export function checkTaxTrap(
  parentLineAmount: number,
  childQuote: Quote
): { isTaxTrap: boolean; matchesSubtotal: boolean; matchesTotal: boolean } {
  const subtotal = childQuote.subtotal || 0;
  const total = childQuote.total || 0;
  
  const matchesSubtotal = isExactMatch(parentLineAmount, subtotal);
  const matchesTotal = isExactMatch(parentLineAmount, total);
  
  // Tax trap: matches subtotal but NOT total (tax/freight variance)
  const isTaxTrap = matchesSubtotal && !matchesTotal && total > subtotal;
  
  return { isTaxTrap, matchesSubtotal, matchesTotal };
}

/**
 * Compare a parent line to a child quote for deduplication
 * Safety Constitution: Strict dedupe rules
 */
export function compareLineToQuote(
  parentLine: Line,
  parentQuote: Quote,
  childQuote: Quote
): MatchResult {
  const lineAmount = parentLine.amount || 0;
  const childTotal = childQuote.total || 0;
  const childSubtotal = childQuote.subtotal || 0;
  
  // Check for text evidence
  const evidence = hasTextEvidence(parentQuote, childQuote);
  
  // Check tax trap
  const taxTrap = checkTaxTrap(lineAmount, childQuote);
  
  // EXACT MATCH: Line matches child total or subtotal exactly
  if (taxTrap.matchesTotal || taxTrap.matchesSubtotal) {
    return {
      type: 'EXACT',
      confidence: evidence.hasEvidence ? 95 : 50,
      hasTextEvidence: evidence.hasEvidence,
      evidenceDetails: taxTrap.isTaxTrap 
        ? `TAX TRAP: Line matches subtotal ($${childSubtotal}), child total is $${childTotal}. ${evidence.details}`
        : evidence.details,
      variancePercent: 0
    };
  }
  
  // SOFT MATCH: Within 8% variance
  const varianceFromTotal = getVariancePercent(lineAmount, childTotal);
  const varianceFromSubtotal = getVariancePercent(lineAmount, childSubtotal);
  const minVariance = Math.min(varianceFromTotal, varianceFromSubtotal);
  
  if (minVariance <= SAFETY_RULES.SOFT_MATCH_VARIANCE_PERCENT) {
    return {
      type: 'SOFT',
      confidence: evidence.hasEvidence ? 75 : 25,
      hasTextEvidence: evidence.hasEvidence,
      evidenceDetails: evidence.details,
      variancePercent: minVariance
    };
  }
  
  // NO MATCH
  return {
    type: 'NO_MATCH',
    confidence: 0,
    hasTextEvidence: false,
    variancePercent: minVariance
  };
}

/**
 * Run deduplication check and return result
 * Safety Constitution: 
 * - Auto-link ONLY with text evidence
 * - Otherwise → POTENTIAL_DUPLICATE queue
 */
export function runDedupeCheck(
  parentLine: Line,
  parentQuote: Quote,
  childQuote: Quote
): DedupeResult {
  const match = compareLineToQuote(parentLine, parentQuote, childQuote);
  
  // NO MATCH → No action needed
  if (match.type === 'NO_MATCH') {
    return {
      status: 'NO_MATCH',
      match,
      sourceLineId: parentLine.id
    };
  }
  
  // EXACT or SOFT match WITH evidence → Auto-link
  if (match.hasTextEvidence) {
    return {
      status: 'AUTO_LINKED',
      match,
      sourceLineId: parentLine.id,
      targetLineId: childQuote.id
    };
  }
  
  // EXACT or SOFT match WITHOUT evidence → Decision Queue
  // Safety Constitution: "Exact match without evidence becomes POTENTIAL_DUPLICATE"
  return {
    status: 'POTENTIAL_DUPLICATE',
    match,
    sourceLineId: parentLine.id,
    decision: {
      decision_type: match.type === 'EXACT' ? 'POTENTIAL_DUPLICATE' : 'SOFT_MATCH',
      title: `Possible duplicate: ${parentLine.description}`,
      description: match.type === 'EXACT'
        ? `Exact amount match ($${parentLine.amount}) but no vendor/quote# evidence found.`
        : `Soft match (${match.variancePercent?.toFixed(1)}% variance) without text evidence.`,
      line_id_a: parentLine.id,
      quote_id_b: childQuote.id,
      evidence: {
        matchType: match.type,
        variance: match.variancePercent,
        parentAmount: parentLine.amount,
        childTotal: childQuote.total,
        childSubtotal: childQuote.subtotal
      }
    }
  };
}
