-- =============================================
-- MasterContractorOS Schema v1.0
-- Safety Constitution Embedded
-- =============================================

-- ENUM: Quote reconciliation status
CREATE TYPE quote_status AS ENUM (
  'VERIFIED',
  'PENDING',
  'POTENTIAL_DUPLICATE',
  'DECISION_REQUIRED',
  'ESTIMATE',
  'GAP'
);

-- ENUM: Line item type
CREATE TYPE line_type AS ENUM (
  'MATERIAL',
  'LABOR',
  'MATERIAL_AND_LABOR',
  'OTHER'
);

-- ENUM: Confidence level
CREATE TYPE confidence_level AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW'
);

-- ENUM: Reconciliation rule for wrapper quotes
CREATE TYPE reconciliation_rule AS ENUM (
  'AUTHORITATIVE',
  'ADDITIVE',
  'REFERENCE_ONLY'
);

-- =============================================
-- PROJECTS TABLE
-- =============================================
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own projects" 
ON public.projects FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- QUOTES TABLE
-- =============================================
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  quote_number TEXT,
  quote_date DATE,
  subtotal DECIMAL(12,2),
  tax DECIMAL(12,2),
  freight DECIMAL(12,2),
  total DECIMAL(12,2),
  
  -- Safety Constitution: Wrapper Truth Rule
  is_wrapper BOOLEAN DEFAULT false,
  reconciliation_rule reconciliation_rule DEFAULT 'ADDITIVE',
  parent_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  
  -- Linking evidence (for dedupe safety)
  linked_vendor_evidence TEXT,
  linked_quote_evidence TEXT,
  
  status quote_status DEFAULT 'PENDING',
  confidence confidence_level DEFAULT 'MEDIUM',
  notes TEXT,
  raw_text TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (via project ownership)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotes for their projects"
ON public.quotes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = quotes.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create quotes for their projects"
ON public.quotes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = quotes.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update quotes for their projects"
ON public.quotes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = quotes.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete quotes for their projects"
ON public.quotes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = quotes.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- =============================================
-- LINES TABLE (Quote Line Items)
-- =============================================
CREATE TABLE public.lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  
  -- Core line data
  description TEXT NOT NULL,
  scope_tag TEXT,
  quantity DECIMAL(10,2),
  unit TEXT,
  unit_price DECIMAL(12,2),
  amount DECIMAL(12,2),
  
  -- Safety Constitution: Labor Trap
  line_type line_type DEFAULT 'MATERIAL_AND_LABOR',
  
  -- Matching & linking
  matched_line_id UUID REFERENCES public.lines(id) ON DELETE SET NULL,
  match_confidence DECIMAL(5,2),
  match_evidence TEXT,
  
  status quote_status DEFAULT 'PENDING',
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (via quote -> project ownership)
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lines for their quotes"
ON public.lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes
    JOIN public.projects ON projects.id = quotes.project_id
    WHERE quotes.id = lines.quote_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create lines for their quotes"
ON public.lines FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes
    JOIN public.projects ON projects.id = quotes.project_id
    WHERE quotes.id = lines.quote_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update lines for their quotes"
ON public.lines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.quotes
    JOIN public.projects ON projects.id = quotes.project_id
    WHERE quotes.id = lines.quote_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete lines for their quotes"
ON public.lines FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.quotes
    JOIN public.projects ON projects.id = quotes.project_id
    WHERE quotes.id = lines.quote_id
    AND projects.user_id = auth.uid()
  )
);

-- =============================================
-- GAPS TABLE (Missing scope items)
-- Safety Constitution: Exclusion Gap Rule
-- =============================================
CREATE TABLE public.gaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  scope_tag TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT, -- e.g., "Extracted from: SIDING NOT IN ESTIMATE"
  
  -- Estimate data (Zero-Quote Mode)
  estimated_low DECIMAL(12,2),
  estimated_mid DECIMAL(12,2),
  estimated_high DECIMAL(12,2),
  rate_source TEXT, -- e.g., "RSMeans 2024 - Boston Metro"
  confidence confidence_level DEFAULT 'LOW',
  
  resolved BOOLEAN DEFAULT false,
  resolved_by_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gaps for their projects"
ON public.gaps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = gaps.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create gaps for their projects"
ON public.gaps FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = gaps.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update gaps for their projects"
ON public.gaps FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = gaps.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete gaps for their projects"
ON public.gaps FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = gaps.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- =============================================
-- DECISION QUEUE TABLE
-- Safety Constitution: Conflict & Soft Match Gate
-- =============================================
CREATE TABLE public.decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  decision_type TEXT NOT NULL, -- 'POTENTIAL_DUPLICATE', 'SPEC_CONFLICT', 'SOFT_MATCH', 'AMBIGUOUS_SCOPE'
  title TEXT NOT NULL,
  description TEXT,
  
  -- References
  quote_id_a UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_id_b UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  line_id_a UUID REFERENCES public.lines(id) ON DELETE CASCADE,
  line_id_b UUID REFERENCES public.lines(id) ON DELETE SET NULL,
  
  -- Evidence
  evidence JSONB,
  
  resolved BOOLEAN DEFAULT false,
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions for their projects"
ON public.decisions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = decisions.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create decisions for their projects"
ON public.decisions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = decisions.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update decisions for their projects"
ON public.decisions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = decisions.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete decisions for their projects"
ON public.decisions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = decisions.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- =============================================
-- RATEBOOK TABLE (For Zero-Quote Mode)
-- =============================================
CREATE TABLE public.ratebook (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  scope_tag TEXT NOT NULL,
  description TEXT,
  region TEXT DEFAULT 'Boston Metro',
  
  unit TEXT,
  rate_low DECIMAL(12,2),
  rate_mid DECIMAL(12,2),
  rate_high DECIMAL(12,2),
  
  source TEXT, -- e.g., "RSMeans 2024", "Historical Project X"
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ratebook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ratebook"
ON public.ratebook FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create ratebook entries"
ON public.ratebook FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratebook"
ON public.ratebook FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratebook entries"
ON public.ratebook FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lines_updated_at
  BEFORE UPDATE ON public.lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gaps_updated_at
  BEFORE UPDATE ON public.gaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();