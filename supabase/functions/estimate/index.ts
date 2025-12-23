import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GC_SYSTEM_PROMPT = `You are a Senior GC estimator with 25+ years experience. You provide accurate, competitive material takeoffs and labor estimates.

CRITICAL RULES:
1. ONLY estimate what the user explicitly asks for. NO scope creep - no paint unless asked, no electrical unless asked.
2. OUTPUT IN ORDERABLE UNITS - not just SF. Calculate:
   - Flooring: Total SF needed → divide by SF/box → round UP to whole boxes
   - Drywall: Total SF → divide by 32 SF/sheet (4x8) → round UP to whole sheets  
   - Insulation: Total SF → divide by SF/bag or roll → round UP
   - Lumber: Calculate exact count, round UP for waste
   - Show: "X SF needed → Y boxes @ Z SF/box"

3. Use REALISTIC subcontractor rates - what GCs PAY subs:
   - Framing: $5-7/LF for walls
   - Insulation: $0.55-0.70/SF
   - Drywall hang+finish L4: $1.40-1.80/SF
   - LVP install: $1.75-2.50/SF
   - Baseboard: $1.25-2.00/LF

4. Use pricing from search data when provided - PRIORITIZE live data over internal knowledge.
5. Standard waste factors: 10% drywall, 7% flooring, 10% framing.
6. Apply sales tax to materials only when state specified.

PRODUCT KNOWLEDGE (fallback if no search data):
- Flooret Nakan Base LVP = $2.95/SF, 23.64 SF/box = ~$69.74/box
- R-13 kraft batts 15" = ~88 SF/bag, $0.65/SF = ~$57/bag
- 1/2" drywall 4x8 = 32 SF/sheet, $14-18/sheet
- 2x4x8 SPF studs = $3.00-4.50/ea

OUTPUT FORMAT - Clean markdown tables:

**ASSUMPTIONS**
[List dimensions, ceiling height, scope included/excluded]

**MATERIALS**
| Item | Calculation | Order Qty | Unit | $/Unit | Total |
|------|-------------|-----------|------|--------|-------|

**LABOR (Sub Rates)**  
| Trade | Calculation | Rate | Total |
|-------|-------------|------|-------|

**SUMMARY**
| Category | Amount |
|----------|--------|

Be CONCISE. Show your math in the Calculation column.`;

function getCurrentDate(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  return `${month} ${year}`;
}

function extractState(message: string): string | null {
  const statePatterns: Record<string, string[]> = {
    "Rhode Island": ["rhode island", "ri ", " ri", "ri."],
    "Massachusetts": ["massachusetts", "ma ", " ma", "ma.", "boston"],
    "Connecticut": ["connecticut", "ct ", " ct", "ct."],
    "New York": ["new york", "ny ", " ny", "ny.", "nyc"],
    "California": ["california", "ca ", " ca", "ca.", "los angeles", "san francisco"],
    "Texas": ["texas", "tx ", " tx", "tx.", "houston", "dallas", "austin"],
    "Florida": ["florida", "fl ", " fl", "fl.", "miami", "tampa"],
  };
  
  const lowerMsg = message.toLowerCase();
  for (const [state, patterns] of Object.entries(statePatterns)) {
    for (const pattern of patterns) {
      if (lowerMsg.includes(pattern)) {
        return state;
      }
    }
  }
  return null;
}

async function searchPricing(apiKey: string, query: string): Promise<string | null> {
  try {
    console.log("Perplexity search:", query);
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
            content: "Return ONLY current prices as a simple list. Format: 'Product: $X.XX per unit'. Include source if available. No explanations needed." 
          },
          { role: "user", content: query }
        ],
        search_recency_filter: "week",
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      console.log("Perplexity result:", content.substring(0, 300));
      return content;
    }
    console.error("Perplexity failed:", response.status);
    return null;
  } catch (e) {
    console.error("Perplexity error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, searchPricing: searchRequest } = await req.json();
    console.log("Request received, live pricing:", !!searchRequest?.query);
    
    let pricingContext = "";
    const currentDate = getCurrentDate();
    
    if (searchRequest?.query) {
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
      
      if (PERPLEXITY_API_KEY) {
        const userMsg = searchRequest.query.toLowerCase();
        const state = extractState(userMsg);
        const searches: Promise<string | null>[] = [];
        const searchNames: string[] = [];
        
        // Build focused, current searches
        if (userMsg.includes("floor") || userMsg.includes("lvp") || userMsg.includes("nakan")) {
          searches.push(searchPricing(PERPLEXITY_API_KEY, 
            `Flooret Nakan Base LVP flooring current retail price per square foot or per box ${currentDate}`));
          searchNames.push("Flooring");
        }
        if (userMsg.includes("drywall") || userMsg.includes("sheetrock")) {
          searches.push(searchPricing(PERPLEXITY_API_KEY, 
            `1/2 inch drywall 4x8 sheet current price retail ${currentDate}`));
          searchNames.push("Drywall");
        }
        if (userMsg.includes("insul")) {
          searches.push(searchPricing(PERPLEXITY_API_KEY, 
            `R-13 fiberglass batt insulation current retail price per bag or square foot ${currentDate}`));
          searchNames.push("Insulation");
        }
        if (userMsg.includes("frame") || userMsg.includes("stud") || userMsg.includes("lumber")) {
          searches.push(searchPricing(PERPLEXITY_API_KEY, 
            `2x4x8 lumber stud current price ${currentDate}`));
          searchNames.push("Lumber");
        }
        
        // Regional labor rate search
        const region = state || "United States";
        searches.push(searchPricing(PERPLEXITY_API_KEY, 
          `${region} residential subcontractor labor rates drywall framing flooring installation per square foot ${currentDate}`));
        searchNames.push(`Labor Rates (${region})`);
        
        const results = await Promise.all(searches);
        
        const validResults: string[] = [];
        results.forEach((result, i) => {
          if (result && 
              !result.toLowerCase().includes("don't have access") && 
              !result.toLowerCase().includes("cannot provide") &&
              !result.toLowerCase().includes("no current") &&
              !result.toLowerCase().includes("not listed")) {
            validResults.push(`**${searchNames[i]}**: ${result}`);
          }
        });
        
        if (validResults.length > 0) {
          pricingContext = `\n\n[LIVE PRICING DATA as of ${currentDate} - USE THESE PRICES]\n${validResults.join("\n\n")}\n`;
          console.log("Added pricing context with", validResults.length, "results");
        } else {
          console.log("No valid pricing results, using internal knowledge");
        }
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
        model: "google/gemini-2.5-flash",
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
