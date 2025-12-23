// =============================================
// MasterContractorOS Physics Engine
// Site Context & Logistics Calculations
// =============================================

import { 
  SiteContext, 
  AccessDifficulty,
  CostRange,
  LineType,
  LABOR_MULTIPLIERS,
  OCCUPANCY_MULTIPLIER
} from '@/types/mastercontractor';
import { LOGISTICS_DEFAULTS, DURATION_RULES } from '@/lib/data/ratebook';

// =============================================
// LABOR PHYSICS
// =============================================

/**
 * Calculate labor multiplier based on site context
 * Factors: Access difficulty, occupancy, parking distance
 */
export function getLaborMultiplier(context: SiteContext): number {
  let multiplier = LABOR_MULTIPLIERS[context.access] || 1.0;
  
  // Occupancy penalty (dust protection, restricted hours, cleanup)
  if (context.isOccupied) {
    multiplier *= OCCUPANCY_MULTIPLIER;
  }
  
  // Distance penalty (>100ft from parking adds handling time)
  if (context.distanceToParking > 100) {
    const distancePenalty = Math.min(0.15, (context.distanceToParking - 100) / 500 * 0.15);
    multiplier += distancePenalty;
  }
  
  // Multi-floor penalty (no elevator)
  if (!context.hasElevator && context.floorNumber > 1) {
    const floorPenalty = (context.floorNumber - 1) * 0.08;
    multiplier += Math.min(0.25, floorPenalty);
  }
  
  return parseFloat(multiplier.toFixed(3));
}

/**
 * Apply labor multiplier to a cost
 */
export function applyLaborMultiplier(
  baseCost: number, 
  context: SiteContext
): { adjusted: number; multiplier: number; breakdown: string } {
  const multiplier = getLaborMultiplier(context);
  const adjusted = Math.round(baseCost * multiplier);
  
  const breakdownParts: string[] = [];
  if (context.access !== 'EASY') {
    breakdownParts.push(`Access: ${context.access}`);
  }
  if (context.isOccupied) {
    breakdownParts.push('Occupied site');
  }
  if (context.distanceToParking > 100) {
    breakdownParts.push(`Parking ${context.distanceToParking}ft`);
  }
  if (!context.hasElevator && context.floorNumber > 1) {
    breakdownParts.push(`Floor ${context.floorNumber}, no elevator`);
  }
  
  return {
    adjusted,
    multiplier,
    breakdown: breakdownParts.length > 0 
      ? `${multiplier}x (${breakdownParts.join(', ')})` 
      : '1.0x (easy access)'
  };
}

// =============================================
// DURATION CALCULATION
// =============================================

/**
 * Calculate job duration in weeks based on hard costs
 */
export function calculateDurationWeeks(hardCosts: number): number {
  const additionalWeeks = Math.ceil(hardCosts / DURATION_RULES.COST_PER_WEEK);
  return Math.min(
    DURATION_RULES.BASE_WEEKS + additionalWeeks,
    DURATION_RULES.MAX_WEEKS
  );
}

/**
 * Determine job complexity based on scope and cost
 */
export function getJobComplexity(
  hardCosts: number, 
  scopeTags: string[]
): 'SIMPLE' | 'MODERATE' | 'COMPLEX' {
  const hasMEP = scopeTags.some(tag => 
    ['PLUMBING', 'ELECTRICAL', 'HVAC'].includes(tag.toUpperCase())
  );
  const hasStructural = scopeTags.some(tag => 
    ['FOUNDATION', 'FRAMING', 'ROOFING'].includes(tag.toUpperCase())
  );
  
  if (hardCosts > 100000 || (hasMEP && hasStructural)) {
    return 'COMPLEX';
  }
  if (hardCosts > 30000 || hasMEP || hasStructural) {
    return 'MODERATE';
  }
  return 'SIMPLE';
}

// =============================================
// LOGISTICS PROFILE GENERATION
// =============================================

export interface LogisticsLineItem {
  id: string;
  description: string;
  category: string;
  qty: number;
  unit: string;
  unitPrice: CostRange;
  totalLikely: number;
  type: LineType;
  sourceRef: string;
}

/**
 * Generate logistics profile (General Conditions)
 * Calculates: Dumpsters, Toilets, PM time, Permits
 */
export function generateLogisticsProfile(
  hardCosts: number,
  scopeTags: string[],
  context: SiteContext
): LogisticsLineItem[] {
  const lines: LogisticsLineItem[] = [];
  const durationWeeks = calculateDurationWeeks(hardCosts);
  const complexity = getJobComplexity(hardCosts, scopeTags);
  
  // 1. WASTE MANAGEMENT (Dumpsters)
  // Rule: 1 dumpster per $15k of work
  const dumpsterCount = Math.max(1, Math.ceil(hardCosts / 15000));
  const dumpsterRate = LOGISTICS_DEFAULTS.DUMPSTER;
  
  lines.push({
    id: `log-dumpster-${Date.now()}`,
    description: `30yd Dumpster Rental (${dumpsterCount} pulls)`,
    category: '01-General Requirements',
    qty: dumpsterCount,
    unit: 'EA',
    unitPrice: dumpsterRate,
    totalLikely: dumpsterRate.likely * dumpsterCount,
    type: 'LOGISTICS',
    sourceRef: dumpsterRate.source.ref
  });
  
  // 2. SANITATION (Portable Toilets)
  // Rule: 1 toilet per month of work
  const months = Math.max(1, Math.ceil(durationWeeks / 4));
  const toiletRate = LOGISTICS_DEFAULTS.TOILET;
  
  lines.push({
    id: `log-toilet-${Date.now()}`,
    description: `Portable Sanitation (${months} month${months > 1 ? 's' : ''})`,
    category: '01-General Requirements',
    qty: months,
    unit: 'MO',
    unitPrice: toiletRate,
    totalLikely: toiletRate.likely * months,
    type: 'LOGISTICS',
    sourceRef: toiletRate.source.ref
  });
  
  // 3. PROJECT MANAGEMENT
  // Hours per week based on complexity, adjusted for site difficulty
  let pmHoursPerWeek = DURATION_RULES.PM_HOURS_PER_WEEK[complexity];
  
  // Hard access sites need more supervision
  if (context.access === 'HARD' || context.access === 'CRANE_REQUIRED') {
    pmHoursPerWeek = Math.round(pmHoursPerWeek * 1.5);
  }
  
  const totalPmHours = pmHoursPerWeek * durationWeeks;
  const pmRate = LOGISTICS_DEFAULTS.PM_LABOR;
  
  lines.push({
    id: `log-pm-${Date.now()}`,
    description: `Project Management (${totalPmHours}hrs over ${durationWeeks}wks)`,
    category: '01-General Requirements',
    qty: totalPmHours,
    unit: 'HR',
    unitPrice: pmRate,
    totalLikely: pmRate.likely * totalPmHours,
    type: 'LABOR',
    sourceRef: pmRate.source.ref
  });
  
  // 4. PERMITS (Percentage of job value)
  const permitPercent = LOGISTICS_DEFAULTS.PERMIT_PERCENT.likely;
  const permitCost = Math.round(hardCosts * permitPercent);
  
  if (permitCost > 0) {
    lines.push({
      id: `log-permit-${Date.now()}`,
      description: `Permit Fees (${(permitPercent * 100).toFixed(1)}% of job)`,
      category: '01-General Requirements',
      qty: 1,
      unit: 'LS',
      unitPrice: {
        low: Math.round(hardCosts * LOGISTICS_DEFAULTS.PERMIT_PERCENT.low),
        likely: permitCost,
        high: Math.round(hardCosts * LOGISTICS_DEFAULTS.PERMIT_PERCENT.high),
        confidence: 'MEDIUM',
        source: { type: 'LOGISTICS_RULE', ref: 'RULE:PERMIT_PERCENT' }
      },
      totalLikely: permitCost,
      type: 'LOGISTICS',
      sourceRef: 'RULE:PERMIT_PERCENT'
    });
  }
  
  return lines;
}

/**
 * Calculate total logistics cost
 */
export function calculateLogisticsCost(
  hardCosts: number,
  scopeTags: string[],
  context: SiteContext
): { low: number; likely: number; high: number; lines: LogisticsLineItem[] } {
  const lines = generateLogisticsProfile(hardCosts, scopeTags, context);
  
  const likely = lines.reduce((sum, l) => sum + l.totalLikely, 0);
  
  // Estimate low/high as percentage of likely
  return {
    low: Math.round(likely * 0.85),
    likely,
    high: Math.round(likely * 1.25),
    lines
  };
}

// =============================================
// DEFAULT SITE CONTEXT
// =============================================

export const DEFAULT_SITE_CONTEXT: SiteContext = {
  access: 'EASY',
  isOccupied: false,
  distanceToParking: 50,
  hasElevator: false,
  floorNumber: 1
};
