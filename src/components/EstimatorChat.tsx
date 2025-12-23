import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate`;

export function EstimatorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useLivePricing, setUseLivePricing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const extractPricingQuery = (userMessage: string): string | null => {
    // Extract potential pricing searches from the message
    const keywords = ["price", "cost", "flooring", "drywall", "lumber", "insulation", "flooret", "nakan", "home depot", "lowes"];
    const hasKeyword = keywords.some(k => userMessage.toLowerCase().includes(k));
    
    if (hasKeyword) {
      // Create a focused pricing query
      const materials = userMessage.match(/\b(flooret|nakan|lvp|drywall|lumber|2x4|insulation|r-13|r-15|baseboard|joint compound|screws)\b/gi);
      if (materials?.length) {
        return `Current ${materials.join(", ")} prices at Home Depot Lowe's 2024 2025`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const pricingQuery = useLivePricing ? extractPricingQuery(input) : null;
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          searchPricing: pricingQuery ? { query: pricingQuery } : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get response");
      // Remove the empty assistant message if we failed
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">GC Estimator</h1>
          <p className="text-sm text-muted-foreground">Construction cost estimating with real-time pricing</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="live-pricing"
              checked={useLivePricing}
              onCheckedChange={setUseLivePricing}
            />
            <Label htmlFor="live-pricing" className="text-sm flex items-center gap-1">
              <Search className="h-3 w-3" />
              Live Pricing
            </Label>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg mb-2">Ask me to estimate any construction project</p>
            <p className="text-sm">Example: "Estimate a 20x30 basement finish with framing, insulation, drywall, and Flooret Nakan flooring"</p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-2">
                          <table className="min-w-full text-sm border-collapse">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-border px-2 py-1 bg-muted font-medium text-left">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-border px-2 py-1">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project (e.g., 20x30 basement, 8ft ceilings, framing + drywall + flooring)"
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        {useLivePricing && (
          <p className="text-xs text-muted-foreground mt-2">
            🔍 Live pricing enabled - will search current material prices when relevant
          </p>
        )}
      </div>
    </div>
  );
}
