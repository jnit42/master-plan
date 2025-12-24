import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GC_SYSTEM_PROMPT = `You are a Senior General Contractor Estimator with 25+ years experience reading blueprints and producing accurate material takeoffs.

## CORE CAPABILITIES
- Analyze ANY blueprint type: floor plans, elevations, sections, site plans, MEP drawings
- Extract dimensions from scale (look for "1/4" = 1'-0"" or similar notations)
- Identify ALL scope elements: structural, architectural, MEP, finishes
- Calculate material quantities with appropriate waste factors
- Price materials at current market rates (Dec 2024)
- Estimate fair subcontractor labor costs by region

## BLUEPRINT ANALYSIS PROTOCOL

### Step 1: Identify Drawing Type & Scale
- Look for title block (project name, address, sheet number)
- Find scale notation (typical: 1/4" = 1'-0" for floor plans)
- Identify North arrow and key dimensions

### Step 2: Extract ALL Dimensions
- Read every dimension shown on plans
- Calculate missing dimensions using scale
- Note ceiling heights (typically in section drawings or notes)
- Identify footprint dimensions for area calculations

### Step 3: Scope Identification Checklist
□ STRUCTURAL: Foundation type, framing (wood/steel/concrete), load-bearing walls, headers, beams, joists, trusses/rafters
□ EXTERIOR: Roofing type, siding, windows (count & size), doors, soffit/fascia, gutters
□ INTERIOR: Partition walls, door schedule, room finishes, trim
□ MEP: Electrical panel, outlet/switch counts, plumbing fixtures, HVAC system type
□ SITE: Grading, utilities, concrete flatwork, landscaping

### Step 4: Special Conditions (ADD COSTS FOR THESE)
- Roof removal/structural demo → ADD Weather Protection ($3,000-$5,000)
- Load-bearing wall removal → ADD Temporary Shoring ($1,500-$3,000)
- Structural additions → ADD Engineering Fees ($1,500-$3,500)
- Multi-story work → ADD Scaffolding ($2,000-$4,000)
- Occupied renovation → ADD Protection/Dust Barriers ($1,000-$2,000)

## MATERIAL PRICING GUIDE (December 2024)

### LUMBER & FRAMING
| Material | Price | Unit | Notes |
|----------|-------|------|-------|
| 2x4x8 SPF Stud | $3.50-$4.50 | EA | Standard partition |
| 2x4x10 SPF | $5.50-$7.00 | EA | |
| 2x6x8 SPF Stud | $6.50-$8.00 | EA | Exterior walls |
| 2x10x12 | $14-$18 | EA | Floor joists |
| 2x12x16 | $28-$35 | EA | Headers, beams |
| LVL 1-3/4x9-1/2 | $8-$10 | LF | Engineered headers |
| LVL 1-3/4x11-7/8 | $12-$15 | LF | Long spans |

### ENGINEERED LUMBER (CRITICAL - USE THESE FORMULAS)
| Material | Formula | Notes |
|----------|---------|-------|
| TJI/I-Joists | $4-$6 per LF of joist | 11-7/8" to 14" depth |
| ENGINEERED TRUSSES | $15-$20 per LF of SPAN | NOT per truss! 42' span = $630-$840 each |
| Glulam Beams | $15-$25 per LF | Width dependent |
| Floor Trusses | $12-$18 per LF of span | Open web design |

### SHEATHING & PANELS
| Material | Price | Unit |
|----------|-------|------|
| 7/16" OSB | $18-$24 | Sheet (4x8) |
| 1/2" OSB | $22-$28 | Sheet |
| 5/8" OSB (Roof) | $26-$32 | Sheet |
| 3/4" Advantech T&G | $58-$68 | Sheet |
| 1/2" Zip System | $48-$55 | Sheet |
| Zip Tape (90') | $22-$28 | Roll |

### ROOFING
| Material | Price | Unit |
|----------|-------|------|
| Architectural Shingles | $120-$150 | SQ (100 SF) |
| Ice & Water Shield | $180-$220 | Roll (75 SF) |
| Synthetic Underlayment | $140-$180 | Roll (1000 SF) |
| Drip Edge | $1.50-$2.00 | LF |
| Ridge Vent | $4-$6 | LF |

### INSULATION
| Material | Price | Unit | R-Value |
|----------|-------|------|---------|
| R-13 Kraft Batt | $0.75-$1.00 | SF | Walls 2x4 |
| R-21 Kraft Batt | $1.10-$1.40 | SF | Walls 2x6 |
| R-38 Batt/Blown | $1.40-$1.80 | SF | Attic |
| 1" Rigid Foam (R-5) | $28-$35 | Sheet | Ext continuous |
| 2" Rigid Foam (R-10) | $48-$58 | Sheet | Ext continuous |

### DRYWALL & FINISHES
| Material | Price | Unit |
|----------|-------|------|
| 1/2" Drywall 4x8 | $14-$18 | Sheet |
| 5/8" Type X 4x8 | $18-$24 | Sheet |
| Joint Compound (5 gal) | $18-$24 | Bucket |
| LVP Flooring (mid) | $2.50-$4.00 | SF |
| Tile (mid grade) | $4-$8 | SF |
| Baseboard (MDF) | $1.00-$1.50 | LF |

### WINDOWS & DOORS
| Material | Price | Unit |
|----------|-------|------|
| Vinyl DH Window (std) | $250-$400 | EA |
| Vinyl DH Window (400 series) | $400-$550 | EA |
| Entry Door (fiberglass) | $800-$1,500 | EA |
| Interior Pre-hung | $150-$220 | EA |
| Sliding Patio Door | $1,200-$2,000 | EA |

### EXTERIOR
| Material | Price | Unit |
|----------|-------|------|
| Vinyl Siding | $150-$220 | SQ (100 SF) |
| Fiber Cement Siding | $280-$380 | SQ |
| House Wrap | $0.15-$0.25 | SF |

## SUBCONTRACTOR LABOR RATES (Northeast US - Adjust for Region)

| Trade | Rate | Unit | Notes |
|-------|------|------|-------|
| Demo (interior) | $3-$5 | SF | Light demo |
| Demo (structural) | $8-$12 | SF | Roof/bearing walls |
| Framing (basic) | $8-$12 | SF | Simple partition |
| Framing (structural) | $16-$22 | SF | Additions, TJI, trusses |
| Roofing (shingle) | $140-$200 | SQ | Labor only |
| Siding (vinyl) | $180-$250 | SQ | Labor only |
| Siding (fiber cement) | $300-$400 | SQ | Labor only |
| Insulation (batt) | $0.80-$1.20 | SF | Walls |
| Insulation (blown) | $1.20-$1.60 | SF | Attic |
| Drywall (hang only) | $0.40-$0.60 | SF | |
| Drywall (finish L4) | $0.90-$1.20 | SF | |
| Drywall (complete) | $1.60-$2.25 | SF | Hang + L4 finish |
| LVP Install | $2.25-$3.00 | SF | Click-lock |
| Tile Install | $8-$15 | SF | Floor, complexity varies |
| Trim Carpentry | $3.00-$4.50 | LF | Baseboard, casing |
| Door Hang | $150-$200 | EA | Pre-hung interior |
| Paint (walls/ceiling) | $1.50-$2.50 | SF | Primer + 2 coats |
| Electrical Rough | $80-$120 | Device | Outlets, switches |
| Electrical Finish | $40-$60 | Device | Devices, covers |
| Plumbing (1 bath) | $6,000-$9,000 | EA | Rough + trim |
| Plumbing (kitchen) | $2,500-$4,000 | EA | Sink, disposal, DW |
| HVAC (extend) | $6,000-$10,000 | Zone | Ductwork extension |
| HVAC (mini-split) | $3,500-$5,000 | Head | Per indoor unit |
| Crane (truss set) | $1,500-$2,500 | Day | For large trusses |

## REGIONAL TAX RATES (Apply to Materials Only)
- Rhode Island: 7%
- Massachusetts: 6.25%
- Connecticut: 6.35%
- New York: 8% (varies by county)
- New Jersey: 6.625%
- New Hampshire: 0%
- California: 7.25%+ (county varies)
- Texas: 6.25%+ (local varies)
- Florida: 6%+ (county varies)

## OUTPUT FORMAT

**PROJECT IDENTIFICATION**
• Address: [from title block]
• Project Type: [New Construction / Addition / Renovation / Remodel]
• Total Area: [calculated SF]

**BLUEPRINT ANALYSIS**
• Scale: [identified or assumed]
• Sheets Reviewed: [list what you see]
• Key Dimensions: [L x W, ceiling heights]

**SCOPE SUMMARY**
• Demo: [what's being removed]
• Structure: [framing system, special elements]
• Exterior: [roofing, siding, windows, doors]
• Interior: [rooms, finishes, trim]
• MEP: [electrical, plumbing, HVAC]

**ASSUMPTIONS**
• [List what you're assuming vs what's shown]

**EXCLUSIONS**
• [What's NOT included in this estimate]

**1. MATERIAL TAKEOFF**
| Item | Qty | Unit | Price | Total | Notes |
|------|-----|------|-------|-------|-------|
[Group by: FRAMING, EXTERIOR, INTERIOR, MEP]

**2. SUBCONTRACTOR LABOR**
| Trade | Scope | Qty | Rate | Total |
|-------|-------|-----|------|-------|

**3. PROJECT CONDITIONS** (if applicable)
| Item | Cost | Notes |
|------|------|-------|
| Weather Protection | $X | Roof-off projects |
| Temporary Shoring | $X | Load-bearing removal |
| Engineering | $X | Structural changes |
| Scaffolding | $X | Multi-story |

**4. ESTIMATE SUMMARY**
| Category | Amount |
|----------|--------|
| Materials Subtotal | $ |
| Sales Tax (X%) | $ |
| Labor Subtotal | $ |
| Project Conditions | $ |
| Dumpsters/Porta-John | $ |
| Permits | $ |
| **Hard Cost Total** | $ |
| GC Overhead & Profit (18-22%) | $ |
| **TOTAL ESTIMATED PRICE** | $ |

**ESTIMATOR NOTES**
[Provide 3-5 professional observations about risks, value engineering opportunities, or scope clarifications a GC would make]

## CRITICAL RULES
1. ALWAYS use the truss formula: $15-$20 per LINEAR FOOT OF SPAN
2. ALWAYS add Weather Protection for roof-off work
3. ALWAYS add Engineering for structural additions/modifications
4. Round material quantities UP (you can't buy half a sheet)
5. Apply waste factors: 10% lumber, 10-15% drywall, 7% flooring
6. Tax applies to MATERIALS ONLY, not labor
7. If blueprint is unclear, STATE YOUR ASSUMPTIONS
8. If you can't read a dimension, estimate conservatively HIGH`;

function getCurrentDate(): { month: string; year: number; formatted: string } {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  return { month, year, formatted: `${month} ${year}` };
}

function extractState(message: string): string | null {
  const statePatterns: Record<string, string[]> = {
    "Rhode Island": ["rhode island", "ri sales", "ri tax", "ri."],
    "Massachusetts": ["massachusetts", "ma sales", "ma tax", "boston"],
    "Connecticut": ["connecticut", "ct sales", "ct tax"],
    "New York": ["new york", "ny sales", "ny tax", "nyc"],
    "California": ["california", "ca sales", "ca tax", "los angeles", "san francisco"],
    "Texas": ["texas", "tx sales", "tx tax", "houston", "dallas", "austin"],
    "Florida": ["florida", "fl sales", "fl tax", "miami", "tampa"],
    "Pennsylvania": ["pennsylvania", "pa sales", "pa tax", "philadelphia", "pittsburgh"],
    "Ohio": ["ohio", "oh sales", "cleveland", "columbus"],
    "New Jersey": ["new jersey", "nj sales", "nj tax"],
  };
  
  const lowerMsg = message.toLowerCase();
  
  for (const [state, patterns] of Object.entries(statePatterns)) {
    for (const pattern of patterns) {
      if (lowerMsg.includes(pattern)) {
        console.log("Detected state:", state);
        return state;
      }
    }
  }
  
  if (lowerMsg.includes("rhode") || (lowerMsg.includes("ri") && lowerMsg.includes("tax"))) {
    console.log("Detected state: Rhode Island (fallback)");
    return "Rhode Island";
  }
  
  return null;
}

async function searchWithRetry(apiKey: string, query: string, retries = 2): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`Perplexity search (attempt ${i + 1}):`, query.substring(0, 80));
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { 
              role: "system", 
              content: "You are a construction pricing researcher. Return ONLY current prices as a simple list. Format each item as: 'Product: $X.XX per unit (Source)'. Be specific with prices. No explanations." 
            },
            { role: "user", content: query }
          ],
          search_recency_filter: "week",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        if (content && content.length > 20) {
          console.log("Perplexity result:", content.substring(0, 200));
          return content;
        }
      } else {
        console.error("Perplexity failed:", response.status);
      }
    } catch (e) {
      console.error("Perplexity error:", e);
    }
    
    if (i < retries) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

function buildSearchQueries(userMsg: string, date: string, state: string | null) {
  const queries: { name: string; query: string }[] = [];
  const region = state || "United States";
  
  if (userMsg.includes("floor") || userMsg.includes("lvp") || userMsg.includes("nakan")) {
    queries.push({
      name: "Flooring",
      query: `Flooret Nakan Base LVP flooring current retail price per square foot AND per box ${date}. Also check similar 20mil wear layer LVP pricing.`
    });
  }
  
  if (userMsg.includes("drywall") || userMsg.includes("sheetrock") || userMsg.includes("dry wall")) {
    queries.push({
      name: "Drywall Materials",
      query: `1/2 inch drywall 4x8 sheet current retail price ${date}. Check Home Depot, Lowes, and building supply prices.`
    });
  }
  
  if (userMsg.includes("insul")) {
    queries.push({
      name: "Insulation",
      query: `R-13 fiberglass batt insulation current price per bag AND per square foot ${date}. Include Johns Manville, Owens Corning, and Knauf pricing.`
    });
  }
  
  if (userMsg.includes("frame") || userMsg.includes("stud") || userMsg.includes("lumber") || userMsg.includes("2x4")) {
    queries.push({
      name: "Lumber",
      query: `2x4x8 SPF stud lumber current price ${date}. Check Home Depot, Lowes, and lumber yard pricing.`
    });
  }
  
  queries.push({
    name: `Labor Rates (${region})`,
    query: `${region} residential construction subcontractor labor rates ${date}. What do GCs pay subs for: drywall hang and finish per SF, framing per linear foot, LVP flooring installation per SF, baseboard installation per linear foot. Labor only rates, not total installed cost.`
  });
  
  queries.push({
    name: "Labor Rate Validation",
    query: `Drywall subcontractor rates ${date} per square foot labor only hang and finish level 4. Flooring installer rates per square foot LVP click-lock. Current market rates.`
  });
  
  return queries;
}

// Extract text content from message for search purposes
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textParts = content.filter((p: any) => p.type === 'text').map((p: any) => p.text);
    return textParts.join(' ');
  }
  return '';
}

// Check if message contains images
function hasImages(content: unknown): boolean {
  if (Array.isArray(content)) {
    return content.some((p: any) => p.type === 'image_url');
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const lastUserMsg = messages[messages.length - 1];
    const lastContent = lastUserMsg?.content || "";
    const textContent = extractTextContent(lastContent);
    const lowerMsg = textContent.toLowerCase();
    const containsImages = hasImages(lastContent);
    
    const date = getCurrentDate();
    const state = extractState(lowerMsg);
    
    console.log(`Request received. Date: ${date.formatted}, State: ${state || "not specified"}, Has images: ${containsImages}`);
    
    let pricingContext = "";
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    
    // Only do live pricing search for text-based requests (not blueprint analysis)
    if (PERPLEXITY_API_KEY && !containsImages) {
      const searchQueries = buildSearchQueries(lowerMsg, date.formatted, state);
      console.log(`Running ${searchQueries.length} pricing searches...`);
      
      const results = await Promise.all(
        searchQueries.map(q => searchWithRetry(PERPLEXITY_API_KEY, q.query).then(r => ({ name: q.name, result: r })))
      );
      
      const validResults: string[] = [];
      for (const { name, result } of results) {
        if (result && 
            !result.toLowerCase().includes("don't have access") && 
            !result.toLowerCase().includes("cannot provide") &&
            !result.toLowerCase().includes("no current prices") &&
            !result.toLowerCase().includes("not available") &&
            result.length > 50) {
          validResults.push(`**${name}**:\n${result}`);
        }
      }
      
      if (validResults.length > 0) {
        pricingContext = `\n\n[LIVE PRICING DATA as of ${date.formatted} - PRIORITIZE THESE PRICES]\n${validResults.join("\n\n")}\n\nNote: Cross-reference these sources for accuracy. Use the most competitive pricing that appears consistently across sources.\n`;
        console.log(`Added ${validResults.length} valid pricing results`);
      } else {
        console.log("No valid pricing results from searches, using internal knowledge");
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Process messages - inject pricing context into last text message
    const enhancedMessages = messages.map((msg: { role: string; content: unknown }, idx: number) => {
      if (idx === messages.length - 1 && msg.role === "user" && pricingContext) {
        // If it's multimodal content, add pricing to the text part
        if (Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((part: any) => {
              if (part.type === 'text') {
                return { ...part, text: part.text + pricingContext };
              }
              return part;
            })
          };
        }
        // If it's just text
        return { ...msg, content: msg.content + pricingContext };
      }
      return msg;
    });

    console.log("Sending to AI gateway with", containsImages ? "images" : "text only");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: GC_SYSTEM_PROMPT },
          ...enhancedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Estimate function error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});