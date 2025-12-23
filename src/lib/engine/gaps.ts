// =============================================
// MasterContractorOS Gap Detection Engine
// Safety Constitution Embedded
// =============================================

import { 
  Quote, 
  Line, 
  Gap, 
  GapDetectionResult,
  SAFETY_RULES 
} from '@/types/mastercontractor';

/**
 * Check if text contains exclusion keywords
 * Safety Constitution: "SIDING NOT IN ESTIMATE" auto-creates gap
 */
export function containsExclusionKeyword(text: string): { 
  found: boolean; 
  keyword: string;
  extractedScope: string;
} {
  const upperText = text.toUpperCase();
  
  for (const keyword of SAFETY_RULES.EXCLUSION_KEYWORDS) {
    if (upperText.includes(keyword)) {
      // Try to extract the scope from before the keyword
      const parts = upperText.split(keyword);
      const scopePart = parts[0].trim();
      
      // Get last meaningful word/phrase as scope
      const words = scopePart.split(/\s+/).filter(w => w.length > 2);
      const extractedScope = words.slice(-2).join(' ') || 'UNSPECIFIED';
      
      return {
        found: true,
        keyword,
        extractedScope
      };
    }
  }
  
  return { found: false, keyword: '', extractedScope: '' };
}

/**
 * Check if line indicates labor-only work
 * Safety Constitution: Labor-only quote must create materials gap
 */
export function isLaborOnly(text: string): { 
  isLabor: boolean; 
  keyword: string;
} {
  const upperText = text.toUpperCase();
  
  for (const keyword of SAFETY_RULES.LABOR_ONLY_KEYWORDS) {
    if (upperText.includes(keyword)) {
      return { isLabor: true, keyword };
    }
  }
  
  return { isLabor: false, keyword: '' };
}

/**
 * Scan a quote for exclusions and labor-only items
 */
export function scanQuoteForGaps(
  quote: Quote,
  lines: Line[],
  projectId: string
): GapDetectionResult {
  const gaps: Partial<Gap>[] = [];
  const laborOnlyFlags: GapDetectionResult['laborOnlyFlags'] = [];
  
  // Scan quote-level notes and raw text
  const quoteText = `${quote.notes || ''} ${quote.raw_text || ''}`;
  const exclusion = containsExclusionKeyword(quoteText);
  
  if (exclusion.found) {
    gaps.push({
      project_id: projectId,
      scope_tag: exclusion.extractedScope,
      description: `Excluded from ${quote.vendor_name} quote`,
      source: `Extracted from: "${exclusion.keyword}" in quote ${quote.quote_number || quote.id}`,
      confidence: 'LOW'
    });
  }
  
  // Scan each line
  for (const line of lines) {
    const lineText = `${line.description || ''} ${line.notes || ''}`;
    
    // Check for exclusions
    const lineExclusion = containsExclusionKeyword(lineText);
    if (lineExclusion.found) {
      gaps.push({
        project_id: projectId,
        scope_tag: lineExclusion.extractedScope || line.scope_tag || 'UNSPECIFIED',
        description: `Excluded: ${line.description}`,
        source: `Extracted from line: "${lineExclusion.keyword}"`,
        confidence: 'LOW'
      });
    }
    
    // Check for labor-only
    const laborCheck = isLaborOnly(lineText);
    if (laborCheck.isLabor || line.line_type === 'LABOR') {
      laborOnlyFlags.push({
        quoteId: quote.id,
        lineId: line.id,
        description: line.description
      });
      
      // Create materials gap
      gaps.push({
        project_id: projectId,
        scope_tag: line.scope_tag || 'MATERIALS',
        description: `Materials needed for: ${line.description}`,
        source: `Labor-only detected: "${laborCheck.keyword || 'line_type=LABOR'}"`,
        confidence: 'LOW'
      });
    }
  }
  
  return { gaps, laborOnlyFlags };
}

/**
 * Merge and deduplicate gaps by scope tag
 */
export function consolidateGaps(gaps: Partial<Gap>[]): Partial<Gap>[] {
  const gapMap = new Map<string, Partial<Gap>>();
  
  for (const gap of gaps) {
    const key = (gap.scope_tag || '').toUpperCase();
    
    if (gapMap.has(key)) {
      // Merge sources
      const existing = gapMap.get(key)!;
      existing.source = `${existing.source}; ${gap.source}`;
    } else {
      gapMap.set(key, { ...gap });
    }
  }
  
  return Array.from(gapMap.values());
}

/**
 * Standard scope tags for construction projects
 */
export const STANDARD_SCOPE_TAGS = [
  'DEMO',
  'FOUNDATION',
  'FRAMING',
  'ROOFING',
  'SIDING',
  'WINDOWS',
  'DOORS',
  'INSULATION',
  'DRYWALL',
  'PAINT',
  'FLOORING',
  'TILE',
  'CABINETS',
  'COUNTERTOPS',
  'PLUMBING',
  'ELECTRICAL',
  'HVAC',
  'APPLIANCES',
  'FIXTURES',
  'LANDSCAPING',
  'PERMITS',
  'DUMPSTER',
  'CLEANUP'
] as const;

export type StandardScopeTag = typeof STANDARD_SCOPE_TAGS[number];
