import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GC_SYSTEM_PROMPT = `You are a Senior GC Estimator. You must calculate material takeoffs and labor costs accurately.

STEP 1 - EXTRACT DIMENSIONS FROM USER'S REQUEST:
- Room length (L) and width (W) in feet
- Ceiling height (H) in feet (default 8 if not specified)

STEP 2 - CALCULATE BASE AREAS:
- Perimeter = 2*(L+W)
- Wall SF = Perimeter × H
- Floor SF = L × W
- Ceiling SF = L × W

STEP 3 - MATERIAL FORMULAS (apply waste factors, round UP):
| Material | Formula | Unit |
|----------|---------|------|
| 2x4x8 Studs | (Perimeter × 0.75) × 1.10 | ea |
| R-13 Insulation | Wall SF ÷ 88 | bags |
| 1/2" Drywall 4x8 | (Wall SF + Ceiling SF) × 1.10 ÷ 32 | sheets |
| Flooret Nakan Base LVP | Floor SF × 1.07 ÷ 23.64 | boxes |
| Baseboard | Perimeter × 1.10 | LF |

STEP 4 - UNIT PRICES (use unless live data says otherwise):
- 2x4x8 stud: $3.50/ea
- R-13 batt bag (88 SF): $57
- 1/2" drywall 4x8: $16/sheet
- Flooret Nakan Base LVP: $69.74/box (23.64 SF/box)
- Baseboard trim: $1.25/LF

STEP 5 - LABOR RATES (subcontractor pricing):
| Trade | Rate | Quantity Base |
|-------|------|---------------|
| Framing | $7.00/LF | Perimeter |
| Insulation | $0.70/SF | Wall SF |
| Drywall (hang+finish) | $1.25/SF | Wall SF + Ceiling SF |
| LVP Installation | $2.50/SF | Floor SF |
| Baseboard | $2.00/LF | Perimeter |

RULES:
- Only estimate what user requests. No scope creep.
- Show your math in the Notes column briefly.
- Always round material quantities UP to whole numbers.
- Apply sales tax only to materials, not labor.

OUTPUT FORMAT:
**ASSUMPTIONS**
• Room: [L]×[W] ft, [H] ft ceiling
• Scope: [list what's included]
• Excluded: [list what's NOT included]

**MATERIALS**
| Item | Qty | Unit | Price | Total | Notes |
|------|-----|------|-------|-------|-------|

**LABOR**
| Trade | Qty | Rate | Total |
|-------|-----|------|-------|

**TOTALS**
| Category | Amount |
|----------|--------|
| Materials | $ |
| Tax | $ |
| Labor | $ |
| **Hard Cost** | $ |`;

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

// Multi-angle search queries for cross-validation
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
  
  // Always search for labor rates with regional focus
  queries.push({
    name: `Labor Rates (${region})`,
    query: `${region} residential construction subcontractor labor rates ${date}. What do GCs pay subs for: drywall hang and finish per SF, framing per linear foot, LVP flooring installation per SF, baseboard installation per linear foot. Labor only rates, not total installed cost.`
  });
  
  // Add a second labor query for cross-validation
  queries.push({
    name: "Labor Rate Validation",
    query: `Drywall subcontractor rates ${date} per square foot labor only hang and finish level 4. Flooring installer rates per square foot LVP click-lock. Current market rates.`
  });
  
  return queries;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const lowerMsg = lastUserMsg.toLowerCase();
    
    const date = getCurrentDate();
    const state = extractState(lowerMsg);
    
    console.log(`Request received. Date: ${date.formatted}, State: ${state || "not specified"}`);
    
    let pricingContext = "";
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    
    if (PERPLEXITY_API_KEY) {
      const searchQueries = buildSearchQueries(lowerMsg, date.formatted, state);
      console.log(`Running ${searchQueries.length} pricing searches...`);
      
      // Run all searches in parallel
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

    // Inject pricing context into the last user message
    const enhancedMessages = messages.map((msg: { role: string; content: string }, idx: number) => {
      if (idx === messages.length - 1 && msg.role === "user" && pricingContext) {
        return { ...msg, content: msg.content + pricingContext };
      }
      return msg;
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
