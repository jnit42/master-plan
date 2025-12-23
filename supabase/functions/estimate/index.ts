import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GC_SYSTEM_PROMPT = `You are a Senior GC estimator with 25+ years experience. You provide accurate, competitive material takeoffs and labor estimates.

CRITICAL RULES:
1. ONLY estimate what the user explicitly asks for. NO scope creep - no paint unless asked, no electrical unless asked, no doors/windows unless asked.
2. Use REALISTIC subcontractor rates - these are what GCs PAY subs in competitive markets:
   - Framing: $5-7/LF for walls (studs, plates, blocking)
   - Insulation: $0.55-0.70/SF (batts in framed walls)
   - Drywall hang+finish L4: $1.40-1.80/SF
   - LVP install: $1.75-2.50/SF
   - Baseboard: $1.25-2.00/LF
3. Use CURRENT material pricing from search data when provided. If search data is provided, cite those prices.
4. Standard waste factors: 10% drywall, 7% flooring, 10% framing lumber.
5. When user specifies a state/region, apply correct sales tax to materials only (not labor).

MATERIAL KNOWLEDGE (use if no search data provided):
- Flooret Nakan Base LVP = $2.95/SF (20mil wear layer)
- R-13 kraft-faced batts = $0.60-0.70/SF
- 1/2" drywall 4x8 = $14-18/sheet (~$0.44-0.56/SF)
- 2x4x8 SPF studs = $3.00-4.50/ea (lumber fluctuates)

OUTPUT FORMAT - Use clean markdown tables:

**ASSUMPTIONS**
[List dimensions, ceiling height, scope included/excluded in bullets]

**MATERIALS**
| Item | Qty | Unit | $/Unit | Subtotal |
|------|-----|------|--------|----------|

**LABOR (Sub Rates)**
| Trade | Units | Rate | Total |
|-------|-------|------|-------|

**SUMMARY**
| Category | Amount |
|----------|--------|
| Materials Subtotal | $X |
| Sales Tax (X%) | $X |
| **Materials Total** | $X |
| Labor Total | $X |
| **TOTAL HARD COST** | $X |

Be CONCISE. No fluff. Just numbers and brief notes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, searchPricing } = await req.json();
    console.log("Received request with searchPricing:", JSON.stringify(searchPricing));
    
    // If live pricing is enabled and we have a query, use Perplexity
    let pricingContext = "";
    if (searchPricing && searchPricing.query) {
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
      console.log("Perplexity API key exists:", !!PERPLEXITY_API_KEY);
      
      if (PERPLEXITY_API_KEY) {
        try {
          console.log("Calling Perplexity with query:", searchPricing.query);
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
                  content: "You are a construction materials pricing researcher. Return ONLY current retail prices from Home Depot, Lowe's, or manufacturer sites. Be specific with product names, SKUs if available, and current prices per unit. Format as a simple list." 
                },
                { role: "user", content: searchPricing.query }
              ],
              search_recency_filter: "week",
            }),
          });
          
          console.log("Perplexity response status:", searchResponse.status);
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const content = searchData.choices?.[0]?.message?.content || "";
            const citations = searchData.citations?.join(", ") || "N/A";
            console.log("Perplexity returned content length:", content.length);
            
            if (content) {
              pricingContext = `\n\n[REAL-TIME PRICING DATA - Use these prices]\n${content}\nSources: ${citations}\n\nIMPORTANT: Use the prices from this search data in your estimate.\n`;
            }
          } else {
            const errorText = await searchResponse.text();
            console.error("Perplexity error response:", errorText);
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
    const enhancedMessages = messages.map((msg: { role: string; content: string }, idx: number) => {
      if (idx === messages.length - 1 && msg.role === "user" && pricingContext) {
        return { ...msg, content: msg.content + pricingContext };
      }
      return msg;
    });

    console.log("Calling Lovable AI with", enhancedMessages.length, "messages");

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
