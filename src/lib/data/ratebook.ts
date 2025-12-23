// =============================================
// MasterContractorOS Ratebook Data
// Centralized pricing with provenance
// =============================================

import { CostRange } from '@/types/mastercontractor';

/**
 * Helper to create standardized cost range with source
 */
const range = (
  low: number, 
  likely: number, 
  high: number, 
  ref: string
): CostRange => ({
  low,
  likely,
  high,
  confidence: 'MEDIUM',
  source: { 
    type: 'RATEBOOK_V1', 
    ref,
    date: '2024-Q4'
  }
});

// =============================================
// LOGISTICS DEFAULTS (General Conditions)
// Source: US National Averages 2024
// =============================================

export const LOGISTICS_DEFAULTS = {
  // 30yd Roll-off Dumpster (haul + dump fees)
  DUMPSTER: range(550, 650, 850, 'RULE:US_AVG_2024_WASTE'),
  
  // Portable Sanitation - Monthly Rental + Service
  TOILET: range(150, 185, 225, 'RULE:US_AVG_2024_SANITATION'),
  
  // Project Management - Hourly Burdened Rate
  PM_LABOR: range(85, 110, 135, 'RULE:US_AVG_2024_MGMT'),
  
  // Site Supervision - Daily Rate
  SITE_SUPER: range(450, 550, 700, 'RULE:US_AVG_2024_SUPER'),
  
  // Permit Fees - Percent of job value
  PERMIT_PERCENT: { low: 0.01, likely: 0.015, high: 0.025 },
  
  // Insurance/Liability - Percent of job value
  INSURANCE_PERCENT: { low: 0.015, likely: 0.02, high: 0.03 },
};

// =============================================
// DURATION CALCULATION RULES
// =============================================

export const DURATION_RULES = {
  // Base duration in weeks
  BASE_WEEKS: 2,
  
  // Additional week per $X of hard costs
  COST_PER_WEEK: 15000,
  
  // Maximum reasonable duration (weeks)
  MAX_WEEKS: 52,
  
  // PM hours per week based on job complexity
  PM_HOURS_PER_WEEK: {
    SIMPLE: 4,
    MODERATE: 8,
    COMPLEX: 12
  }
};

// =============================================
// SCOPE DEPENDENCIES (Destructive Dependencies)
// If TRIGGER is present, CHECK must also be present
// =============================================

export const SCOPE_DEPENDENCIES: Array<{
  trigger: string[];    // If any of these are present
  requires: string[];   // Then at least one of these should exist
  gapDescription: string;
  defaultEstimate: CostRange;
}> = [
  {
    trigger: ['drywall', 'sheetrock', 'gypsum'],
    requires: ['paint', 'prime', 'finish'],
    gapDescription: 'Drywall detected but no paint/finish included',
    defaultEstimate: range(1500, 2500, 4000, 'RULE:DRYWALL_REQUIRES_PAINT')
  },
  {
    trigger: ['tile', 'ceramic', 'porcelain'],
    requires: ['thinset', 'mortar', 'grout', 'subfloor'],
    gapDescription: 'Tile detected but prep materials may be missing',
    defaultEstimate: range(500, 800, 1200, 'RULE:TILE_REQUIRES_PREP')
  },
  {
    trigger: ['flooring', 'hardwood', 'lvp', 'laminate'],
    requires: ['demo', 'removal', 'subfloor', 'underlayment'],
    gapDescription: 'Flooring detected but old floor removal not included',
    defaultEstimate: range(800, 1200, 2000, 'RULE:FLOORING_REQUIRES_DEMO')
  },
  {
    trigger: ['cabinets', 'cabinet'],
    requires: ['demo', 'countertop', 'plumbing', 'electrical'],
    gapDescription: 'Cabinets detected - verify counters and connections included',
    defaultEstimate: range(2000, 4000, 8000, 'RULE:CABINETS_REQUIRE_CONNECTIONS')
  },
  {
    trigger: ['window', 'windows'],
    requires: ['trim', 'casing', 'flash', 'caulk'],
    gapDescription: 'Windows detected but interior trim may be missing',
    defaultEstimate: range(150, 250, 400, 'RULE:WINDOWS_REQUIRE_TRIM')
  },
  {
    trigger: ['roofing', 'shingle', 'roof'],
    requires: ['demo', 'tear', 'flash', 'drip', 'ice', 'underlayment'],
    gapDescription: 'Roofing detected but tear-off or underlayment may be missing',
    defaultEstimate: range(2000, 3500, 6000, 'RULE:ROOF_REQUIRES_PREP')
  }
];

// =============================================
// BRAND CATALOGS (for conflict detection)
// =============================================

export const BRAND_CATALOGS: Record<string, string[]> = {
  windows: ['andersen', 'harvey', 'pella', 'marvin', 'milgard', 'renewal'],
  plumbing: ['kohler', 'moen', 'delta', 'american standard', 'grohe', 'hansgrohe'],
  appliances: ['ge', 'whirlpool', 'samsung', 'lg', 'bosch', 'kitchenaid', 'frigidaire'],
  hvac: ['carrier', 'trane', 'lennox', 'rheem', 'goodman', 'daikin'],
  roofing: ['gaf', 'certainteed', 'owens corning', 'iko', 'tamko'],
  paint: ['benjamin moore', 'sherwin williams', 'behr', 'ppg', 'dunn edwards'],
  cabinets: ['kraftmaid', 'merillat', 'thomasville', 'ikea', 'custom']
};

// =============================================
// CSI DIVISION CODES (for categorization)
// =============================================

export const CSI_DIVISIONS: Record<string, string> = {
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, Plastics, Composites',
  '07': 'Thermal & Moisture Protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '26': 'Electrical',
  '27': 'Communications',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities'
};
