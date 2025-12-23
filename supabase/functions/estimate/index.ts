import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GC_SYSTEM_PROMPT = `You are a Senior General Contractor estimator with 25+ years experience. You help GCs and builders create accurate material takeoffs and labor estimates.

CORE RULES:
1. ALWAYS break down estimates into: Materials (with quantities, unit prices, totals) and Labor (trade, unit rate, total)
2. Use CURRENT market pricing - when unsure, search for real prices
3. Show your math: Quantities × Unit Price = Line Total
4. Include waste factors (typically 10% for drywall, 7% for flooring, 15% for framing)
5. Labor rates should reflect subcontractor rates, not retail/homeowner rates
6. Always specify your assumptions (ceiling height, wall count, etc.)

OUTPUT FORMAT:
Use markdown tables for estimates:
| Item | Qty | Unit | Unit Price | Total |
|------|-----|------|------------|-------|

End with:
- **Materials Subtotal**: $X
- **Labor Subtotal**: $X  
- **Total Hard Cost**: $X (This is GC cost, not retail)

KNOWLEDGE:
- CSI Division structure (01=General, 06=Wood, 09=Finishes, etc.)
- Typical crew sizes and production rates
- Regional labor rate variations
- Common scope gaps (paint after drywall, demo before install, etc.)

When the user provides project details, remember them for follow-up questions.`;

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
