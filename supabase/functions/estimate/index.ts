import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GC_SYSTEM_PROMPT = `You are a Senior GC estimator. Provide accurate, competitive material takeoffs and labor estimates.

CRITICAL RULES:
1. ONLY estimate what the user asks for. DO NOT add scope (no paint unless asked, no electrical unless asked).
2. Use REALISTIC sub rates - these are what GCs PAY subs, not retail:
   - Framing: $5-8/LF for walls
   - Insulation: $0.60-0.80/SF  
   - Drywall hang+finish: $1.50-2.25/SF (Level 4)
   - LVP install: $2-3/SF
   - Baseboard: $1.50-2.50/LF
3. Use CURRENT material pricing from provided search data when available.
4. Waste factors: 10% drywall, 7% flooring, 10% framing.

SPECIFIC PRODUCT KNOWLEDGE:
- Flooret Nakan Base = $2.95/SF (20mil wear layer LVP)
- Flooret Nakan Signature = $4.95/SF (40mil wear layer)
- R-13 batts = ~$0.65/SF
- 1/2" drywall = ~$0.50/SF ($16-18/sheet)
- 2x4x8 studs = $3.50-4.50/ea

OUTPUT FORMAT:
Use clean markdown tables:

**MATERIALS**
| Item | Qty | Unit | $/Unit | Total |
|------|-----|------|--------|-------|

**LABOR (Sub Rates)**
| Trade | Units | Rate | Total |
|-------|-------|------|-------|

**SUMMARY**
- Materials: $X
- Labor: $X
- **TOTAL HARD COST**: $X

STATE YOUR ASSUMPTIONS upfront (dimensions, ceiling height, wall count). Be concise.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, searchPricing } = await req.json();
    
    // If we need real-time pricing, use Perplexity first
    let pricingContext = "";
    if (searchPricing && searchPricing.query) {
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
      if (PERPLEXITY_API_KEY) {
        try {
          const searchResponse = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [
                { 
                  role: "system", 
                  content: "You are a construction materials pricing researcher. Return current prices from Home Depot, Lowe's, or manufacturer websites. Be specific with SKUs and current prices." 
                },
                { role: "user", content: searchPricing.query }
              ],
              search_recency_filter: "month",
            }),
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            pricingContext = `\n\n[REAL-TIME PRICING DATA]\n${searchData.choices?.[0]?.message?.content || ""}\nSources: ${searchData.citations?.join(", ") || "N/A"}\n`;
          }
        } catch (e) {
          console.error("Perplexity search failed:", e);
        }
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Inject pricing context into the last user message if we have it
    const enhancedMessages = [...messages];
    if (pricingContext && enhancedMessages.length > 0) {
      const lastMsg = enhancedMessages[enhancedMessages.length - 1];
      if (lastMsg.role === "user") {
        lastMsg.content = lastMsg.content + pricingContext;
      }
    }

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
