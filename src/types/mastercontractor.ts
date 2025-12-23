// =============================================
// MasterContractorOS Type Definitions
// Safety Constitution v2.0 - Physics Aware
// =============================================

// Database enum types
export type QuoteStatus = 
  | 'VERIFIED'
  | 'PENDING'
  | 'POTENTIAL_DUPLICATE'
  | 'DECISION_REQUIRED'
  | 'ESTIMATE'
  | 'GAP';

export type LineType = 
  | 'MATERIAL'
  | 'LABOR'
  | 'MATERIAL_AND_LABOR'
  | 'LOGISTICS'
  | 'OTHER';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ReconciliationRule = 
  | 'AUTHORITATIVE'  // Wrapper total IS the verified cost
  | 'ADDITIVE'       // Add to other quotes
  | 'REFERENCE_ONLY'; // For audit, not cost calculation

// Decision types for the queue
export type DecisionType = 
  | 'POTENTIAL_DUPLICATE'  // Exact match without text evidence
  | 'SPEC_CONFLICT'        // Brand/spec mismatch
  | 'SOFT_MATCH'           // ≤8% variance, needs review
  | 'AMBIGUOUS_SCOPE'      // Vague input needs clarification
  | 'LABOR_ONLY'           // Materials missing
  | 'BRAND_CONFLICT';      // Plan vs Quote brand mismatch

// =============================================
// PHYSICS LAYER - Site Context & Access
// =============================================

export type AccessDifficulty = 
  | 'EASY'            // Ground floor, good parking
  | 'MODERATE'        // 2nd floor, stairs
  | 'HARD'            // 3rd+ floor walkup, limited access
  | 'CRANE_REQUIRED'; // Heavy equipment needed

export type RateSourceType = 
  | 'QUOTE_EXTRACT'   // Extracted from vendor quote
  | 'RATEBOOK_V1'     // From regional ratebook
  | 'LOGISTICS_RULE'  // Calculated from job parameters
  | 'USER_OVERRIDE';  // Manual entry by user

export interface RateSource {
  type: RateSourceType;
  ref: string;         // "Quote #1042" or "MA-2025-Q1-Ratebook"
  date?: string;       // When the rate was captured
}

export interface CostRange {
  low: number;
  likely: number;
  high: number;
  confidence: ConfidenceLevel;
  source: RateSource;
}

export interface SiteContext {
  access: AccessDifficulty;
  isOccupied: boolean;         // True = dust protection, working hours limits
  distanceToParking: number;   // Feet from parking to work area
  hasElevator: boolean;        // For multi-story buildings
  floorNumber: number;         // 1 = ground floor
}

// Labor multipliers by access difficulty
export const LABOR_MULTIPLIERS: Record<AccessDifficulty, number> = {
  EASY: 1.0,
  MODERATE: 1.15,
  HARD: 1.35,
  CRANE_REQUIRED: 1.60
};

// Occupancy penalty for dust protection, restricted hours
export const OCCUPANCY_MULTIPLIER = 1.15;

// =============================================
// CORE INTERFACES
// =============================================

export interface Project {
  id: string;
  user_id: string;
  name: string;
  address?: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  project_id: string;
  vendor_name: string;
  quote_number?: string;
  quote_date?: string;
  subtotal?: number;
  tax?: number;
  freight?: number;
  total?: number;
  
  // Safety Constitution: Wrapper Truth Rule
  is_wrapper: boolean;
  reconciliation_rule: ReconciliationRule;
  parent_quote_id?: string;
  
  // Linking evidence (for dedupe safety)
  linked_vendor_evidence?: string;
  linked_quote_evidence?: string;
  
  status: QuoteStatus;
  confidence: ConfidenceLevel;
  notes?: string;
  raw_text?: string;
  
  created_at: string;
  updated_at: string;
}

export interface Line {
  id: string;
  quote_id: string;
  description: string;
  scope_tag?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  amount?: number;
  
  // Safety Constitution: Labor Trap
  line_type: LineType;
  
  // Matching & linking
  matched_line_id?: string;
  match_confidence?: number;
  match_evidence?: string;
  
  status: QuoteStatus;
  notes?: string;
  
  created_at: string;
  updated_at: string;
}

export interface Gap {
  id: string;
  project_id: string;
  scope_tag: string;
  description: string;
  source?: string;
  
  // Zero-Quote Mode estimates
  estimated_low?: number;
  estimated_mid?: number;
  estimated_high?: number;
  rate_source?: string;
  confidence: ConfidenceLevel;
  
  resolved: boolean;
  resolved_by_quote_id?: string;
  
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: string;
  project_id: string;
  decision_type: DecisionType;
  title: string;
  description?: string;
  
  quote_id_a?: string;
  quote_id_b?: string;
  line_id_a?: string;
  line_id_b?: string;
  
  evidence?: Record<string, unknown>;
  
  resolved: boolean;
  resolution?: string;
  resolved_at?: string;
  
  created_at: string;
}

export interface RatebookEntry {
  id: string;
  user_id: string;
  scope_tag: string;
  description?: string;
  region: string;
  unit?: string;
  rate_low?: number;
  rate_mid?: number;
  rate_high?: number;
  source?: string;
  last_updated: string;
  created_at: string;
}

// =============================================
// ENGINE TYPES
// =============================================

export interface MatchResult {
  type: 'EXACT' | 'SOFT' | 'NO_MATCH';
  confidence: number;
  hasTextEvidence: boolean;
  evidenceDetails?: string;
  variancePercent?: number;
}

export interface DedupeResult {
  status: 'AUTO_LINKED' | 'POTENTIAL_DUPLICATE' | 'NO_MATCH';
  match: MatchResult;
  sourceLineId: string;
  targetLineId?: string;
  decision?: Partial<Decision>;
}

export interface GapDetectionResult {
  gaps: Partial<Gap>[];
  laborOnlyFlags: {
    quoteId: string;
    lineId: string;
    description: string;
  }[];
}

export interface ProjectSummary {
  verifiedCost: number;
  pendingCost: number;
  estimatedCost: {
    low: number;
    mid: number;
    high: number;
  };
  gapCount: number;
  decisionCount: number;
  confidence: ConfidenceLevel;
}

// =============================================
// SAFETY CONSTITUTION CONSTANTS
// =============================================

export const SAFETY_RULES = {
  // Soft match threshold
  SOFT_MATCH_VARIANCE_PERCENT: 8,
  
  // Tax trap tolerance (for subtotal matching)
  TAX_TRAP_TOLERANCE_PERCENT: 0.5,
  
  // Evidence keywords to look for
  EXCLUSION_KEYWORDS: [
    'NOT IN ESTIMATE',
    'NOT INCLUDED',
    'EXCLUDED',
    'BY OTHERS',
    'NIC',
    'N.I.C.',
    'ALLOWANCE ONLY'
  ],
  
  // Labor-only indicators
  LABOR_ONLY_KEYWORDS: [
    'LABOR ONLY',
    'INSTALL ONLY',
    'INSTALLATION ONLY',
    'LABOR SEPARATE',
    'MATERIALS SEPARATE',
    'MATERIALS BY OWNER',
    'MBO'
  ]
} as const;
