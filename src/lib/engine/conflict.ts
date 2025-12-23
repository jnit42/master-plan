// =============================================
// MasterContractorOS Conflict Detection Engine
// Brand & Spec Mismatch Detection
// =============================================

import { Decision, Line } from '@/types/mastercontractor';
import { BRAND_CATALOGS } from '@/lib/data/ratebook';

// =============================================
// BRAND CONFLICT DETECTION
// =============================================

export interface BrandConflict {
  category: string;
  planBrand: string;
  quoteBrand: string;
  quoteLineId: string;
  severity: 'CRITICAL' | 'WARNING';
  description: string;
}

/**
 * Scan for brand conflicts between plan specifications and quote items
 * Safety Constitution: If evidence shows spec conflict, output DECISION_REQUIRED
 */
export function scanForBrandConflicts(
  planText: string,
  quoteLines: Line[]
): BrandConflict[] {
  const conflicts: BrandConflict[] = [];
  const planLower = planText.toLowerCase();
  
  // Check each category in brand catalogs
  for (const [category, brands] of Object.entries(BRAND_CATALOGS)) {
    // Find brand mentioned in plan
    const planBrand = brands.find(brand => planLower.includes(brand));
    
    if (planBrand) {
      // Check each quote line for a different brand in same category
      for (const line of quoteLines) {
        const lineLower = (line.description || '').toLowerCase();
        
        // Find brand in this line
        const lineBrand = brands.find(brand => lineLower.includes(brand));
        
        if (lineBrand && lineBrand !== planBrand) {
          conflicts.push({
            category,
            planBrand: planBrand.toUpperCase(),
            quoteBrand: lineBrand.toUpperCase(),
            quoteLineId: line.id,
            severity: 'CRITICAL',
            description: `Plan specifies ${planBrand.toUpperCase()} ${category}, but quote includes ${lineBrand.toUpperCase()}.`
          });
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Convert brand conflicts to Decision items for the queue
 */
export function createBrandConflictDecisions(
  projectId: string,
  conflicts: BrandConflict[]
): Partial<Decision>[] {
  return conflicts.map(conflict => ({
    project_id: projectId,
    decision_type: 'BRAND_CONFLICT' as const,
    title: `${conflict.category.toUpperCase()} Brand Mismatch`,
    description: conflict.description,
    line_id_a: conflict.quoteLineId,
    evidence: {
      category: conflict.category,
      planBrand: conflict.planBrand,
      quoteBrand: conflict.quoteBrand,
      severity: conflict.severity
    },
    resolved: false
  }));
}

// =============================================
// SPEC VARIANCE DETECTION
// =============================================

export interface SpecVariance {
  field: string;
  planValue: string;
  quoteValue: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}

/**
 * Parse dimensions from text (e.g., "36x80", "3'x6'-8\"")
 */
function parseDimensions(text: string): { width?: number; height?: number } {
  // Common patterns: 36x80, 3'x6'8", 36"x80"
  const patterns = [
    /(\d+)\s*[xX]\s*(\d+)/,                    // 36x80
    /(\d+)['"]\s*[xX]\s*(\d+)['"]/,            // 36"x80"
    /(\d+)'(\d+)?['""]?\s*[xX]\s*(\d+)'(\d+)?['""]?/  // 3'x6'8"
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        width: parseInt(match[1]),
        height: parseInt(match[2] || match[3])
      };
    }
  }
  
  return {};
}

/**
 * Scan for specification variances (dimensions, quantities)
 */
export function scanForSpecVariances(
  planText: string,
  quoteText: string
): SpecVariance[] {
  const variances: SpecVariance[] = [];
  
  // Extract dimensions
  const planDims = parseDimensions(planText);
  const quoteDims = parseDimensions(quoteText);
  
  if (planDims.width && quoteDims.width && planDims.width !== quoteDims.width) {
    variances.push({
      field: 'width',
      planValue: `${planDims.width}`,
      quoteValue: `${quoteDims.width}`,
      severity: 'CRITICAL'
    });
  }
  
  if (planDims.height && quoteDims.height && planDims.height !== quoteDims.height) {
    variances.push({
      field: 'height',
      planValue: `${planDims.height}`,
      quoteValue: `${quoteDims.height}`,
      severity: 'CRITICAL'
    });
  }
  
  return variances;
}

// =============================================
// QUANTITY MISMATCH DETECTION
// =============================================

export interface QuantityMismatch {
  scopeTag: string;
  expectedQty: number;
  quotedQty: number;
  variancePercent: number;
  severity: 'CRITICAL' | 'WARNING';
}

/**
 * Compare expected quantities (from takeoff) against quoted quantities
 */
export function detectQuantityMismatches(
  takeoffItems: Array<{ scopeTag: string; qty: number; unit: string }>,
  quoteLines: Line[],
  tolerancePercent: number = 10
): QuantityMismatch[] {
  const mismatches: QuantityMismatch[] = [];
  
  for (const takeoff of takeoffItems) {
    // Find matching quote line by scope tag
    const matchingLine = quoteLines.find(
      l => l.scope_tag?.toUpperCase() === takeoff.scopeTag.toUpperCase()
    );
    
    if (matchingLine && matchingLine.quantity) {
      const variancePercent = Math.abs(
        (matchingLine.quantity - takeoff.qty) / takeoff.qty * 100
      );
      
      if (variancePercent > tolerancePercent) {
        mismatches.push({
          scopeTag: takeoff.scopeTag,
          expectedQty: takeoff.qty,
          quotedQty: matchingLine.quantity,
          variancePercent,
          severity: variancePercent > 25 ? 'CRITICAL' : 'WARNING'
        });
      }
    }
  }
  
  return mismatches;
}

// =============================================
// COMBINED CONFLICT SCANNER
// =============================================

export interface ConflictScanResult {
  brandConflicts: BrandConflict[];
  specVariances: SpecVariance[];
  quantityMismatches: QuantityMismatch[];
  hasBlockingIssues: boolean;
  decisions: Partial<Decision>[];
}

/**
 * Run all conflict scans and return combined results
 */
export function runConflictScan(
  projectId: string,
  planText: string,
  quoteLines: Line[],
  takeoffItems?: Array<{ scopeTag: string; qty: number; unit: string }>
): ConflictScanResult {
  // Brand conflicts
  const brandConflicts = scanForBrandConflicts(planText, quoteLines);
  
  // Spec variances (compare plan to quote descriptions)
  const quoteText = quoteLines.map(l => l.description).join(' ');
  const specVariances = scanForSpecVariances(planText, quoteText);
  
  // Quantity mismatches
  const quantityMismatches = takeoffItems 
    ? detectQuantityMismatches(takeoffItems, quoteLines)
    : [];
  
  // Generate decisions
  const decisions = createBrandConflictDecisions(projectId, brandConflicts);
  
  // Add decisions for critical spec variances
  specVariances
    .filter(v => v.severity === 'CRITICAL')
    .forEach(v => {
      decisions.push({
        project_id: projectId,
        decision_type: 'SPEC_CONFLICT',
        title: `${v.field.toUpperCase()} Dimension Mismatch`,
        description: `Plan shows ${v.planValue}, quote shows ${v.quoteValue}.`,
        resolved: false
      });
    });
  
  return {
    brandConflicts,
    specVariances,
    quantityMismatches,
    hasBlockingIssues: brandConflicts.some(c => c.severity === 'CRITICAL') ||
                       specVariances.some(v => v.severity === 'CRITICAL'),
    decisions
  };
}
