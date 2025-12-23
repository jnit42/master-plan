// =============================================
// MasterContractorOS Safety Engine
// Tax Trap & Wrapper Audit Logic
// =============================================

import { Quote, Line, Decision, ConfidenceLevel } from '@/types/mastercontractor';

// =============================================
// TAX TRAP DETECTION
// =============================================

export interface TaxAuditResult {
  status: 'OK' | 'TAX_TRAP_DETECTED' | 'VARIANCE_WARNING';
  variance: number;
  variancePercent: number;
  details: string;
  recommendation: string;
}

/**
 * TAX TRAP DETECTOR
 * Compares the sum of line items vs the Document Total.
 * Tax/Freight typically adds 5-12% to subtotal.
 */
export function auditWrapperForTaxTrap(
  wrapperTotal: number,
  childrenSum: number
): TaxAuditResult {
  const variance = wrapperTotal - childrenSum;
  const variancePercent = wrapperTotal > 0 
    ? (variance / wrapperTotal) * 100 
    : 0;
  
  // Perfect match
  if (Math.abs(variancePercent) < 0.5) {
    return {
      status: 'OK',
      variance,
      variancePercent,
      details: 'Wrapper total matches child sum exactly.',
      recommendation: 'No action needed.'
    };
  }
  
  // Tax Trap Zone: 4-12% variance (typical tax + freight)
  if (variancePercent >= 4 && variancePercent <= 12) {
    return {
      status: 'TAX_TRAP_DETECTED',
      variance,
      variancePercent,
      details: `Wrapper total is ${variancePercent.toFixed(1)}% higher than child sum. This matches typical Tax + Freight range.`,
      recommendation: `Verify children are linked to SUBTOTAL ($${childrenSum.toFixed(0)}), not TOTAL ($${wrapperTotal.toFixed(0)}). The $${variance.toFixed(0)} difference is likely Tax/Freight.`
    };
  }
  
  // Suspicious variance (too high or negative)
  if (variancePercent > 12 || variancePercent < -1) {
    return {
      status: 'VARIANCE_WARNING',
      variance,
      variancePercent,
      details: `Unusual variance: ${variancePercent.toFixed(1)}% ($${variance.toFixed(0)}).`,
      recommendation: 'Review line items for missing entries or double-counting.'
    };
  }
  
  return {
    status: 'OK',
    variance,
    variancePercent,
    details: `Minor variance of ${variancePercent.toFixed(1)}% is within tolerance.`,
    recommendation: 'No action needed.'
  };
}

// =============================================
// WRAPPER TRUTH VALIDATION
// =============================================

export interface WrapperValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  verifiedCost: number;
}

/**
 * Validate wrapper quote against Safety Constitution rules:
 * 1. Wrapper with AUTHORITATIVE rule = total is the verified cost
 * 2. Child quotes are visibility only, never additive
 * 3. Tax trap check
 */
export function validateWrapperTruth(
  wrapper: Quote,
  childQuotes: Quote[],
  wrapperLines: Line[]
): WrapperValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Must be marked as wrapper
  if (!wrapper.is_wrapper) {
    issues.push('Quote is not marked as wrapper but has child quotes.');
  }
  
  // Must have reconciliation rule
  if (!wrapper.reconciliation_rule) {
    issues.push('Wrapper missing reconciliation_rule. Cannot determine cost treatment.');
  }
  
  // Calculate child sum
  const childSum = childQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
  
  // If AUTHORITATIVE, wrapper.total is THE number
  if (wrapper.reconciliation_rule === 'AUTHORITATIVE') {
    const wrapperTotal = wrapper.total || 0;
    
    // Run tax trap audit
    const taxAudit = auditWrapperForTaxTrap(wrapperTotal, childSum);
    
    if (taxAudit.status === 'TAX_TRAP_DETECTED') {
      warnings.push(taxAudit.details);
      warnings.push(taxAudit.recommendation);
    } else if (taxAudit.status === 'VARIANCE_WARNING') {
      issues.push(taxAudit.details);
      issues.push(taxAudit.recommendation);
    }
    
    // Verify line items match children
    const lineSum = wrapperLines.reduce((sum, l) => sum + (l.amount || 0), 0);
    if (Math.abs(lineSum - wrapperTotal) > 1) {
      warnings.push(`Wrapper line items sum ($${lineSum}) differs from total ($${wrapperTotal}).`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      verifiedCost: wrapperTotal
    };
  }
  
  // ADDITIVE: Sum all children
  if (wrapper.reconciliation_rule === 'ADDITIVE') {
    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      verifiedCost: childSum
    };
  }
  
  // REFERENCE_ONLY: No cost contribution
  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    verifiedCost: 0
  };
}

// =============================================
// SOFT MATCH SAFETY GATE
// =============================================

export interface SoftMatchGate {
  allowed: boolean;
  reason: string;
  requiresDecision: boolean;
  decision?: Partial<Decision>;
}

/**
 * Safety gate for soft matches
 * Safety Constitution: Soft match (≤8% variance) REJECTED unless text evidence exists
 */
export function evaluateSoftMatchSafety(
  variancePercent: number,
  hasTextEvidence: boolean,
  sourceDesc: string,
  targetDesc: string
): SoftMatchGate {
  // Reject all soft matches without evidence
  if (!hasTextEvidence) {
    return {
      allowed: false,
      reason: `Soft match (${variancePercent.toFixed(1)}% variance) rejected: No text evidence linking "${sourceDesc}" to "${targetDesc}".`,
      requiresDecision: true,
      decision: {
        decision_type: 'SOFT_MATCH',
        title: `Review: ${sourceDesc}`,
        description: `${variancePercent.toFixed(1)}% variance match without vendor/quote evidence.`
      }
    };
  }
  
  // Allow with evidence
  return {
    allowed: true,
    reason: `Soft match (${variancePercent.toFixed(1)}% variance) approved with text evidence.`,
    requiresDecision: false
  };
}

// =============================================
// CONFIDENCE CALCULATOR
// =============================================

/**
 * Calculate confidence level based on data quality
 */
export function calculateConfidence(params: {
  hasTextEvidence: boolean;
  variancePercent: number;
  sourceType: 'QUOTE' | 'ESTIMATE' | 'RATEBOOK';
  hasRanges: boolean;
}): ConfidenceLevel {
  const { hasTextEvidence, variancePercent, sourceType, hasRanges } = params;
  
  // HIGH: Quote-backed with evidence and low variance
  if (sourceType === 'QUOTE' && hasTextEvidence && variancePercent < 1) {
    return 'HIGH';
  }
  
  // HIGH: Quote-backed with small variance
  if (sourceType === 'QUOTE' && variancePercent < 5) {
    return 'HIGH';
  }
  
  // MEDIUM: Quote-backed or ratebook with ranges
  if (sourceType === 'QUOTE' || (sourceType === 'RATEBOOK' && hasRanges)) {
    return 'MEDIUM';
  }
  
  // LOW: Everything else (estimates, no ranges, high variance)
  return 'LOW';
}
