import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Wifi, WifiOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  // The edge function now handles all search logic with dynamic dates
  // Frontend just signals that live pricing should be used
  const shouldUseLivePricing = (userMessage: string): boolean => {
    const msg = userMessage.toLowerCase();
    // Enable live pricing for any estimate-related request
    return msg.includes("estimate") || 
           msg.includes("cost") || 
           msg.includes("price") || 
           msg.includes("quote") ||
           msg.includes("take") ||
           msg.includes("material") ||
           msg.includes("labor") ||
           msg.includes("floor") ||
           msg.includes("drywall") ||
           msg.includes("frame") ||
           msg.includes("insul");
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
      const enableLivePricing = useLivePricing && shouldUseLivePricing(input);
      
      if (enableLivePricing) {
        toast.info("Fetching live pricing data...", { duration: 2000 });
      }
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
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
      <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">GC Estimator</h1>
          <p className="text-sm text-muted-foreground">Fast, accurate takeoffs with live pricing</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
            <Switch
              id="live-pricing"
              checked={useLivePricing}
              onCheckedChange={setUseLivePricing}
              className="scale-90"
            />
            <Label htmlFor="live-pricing" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
              {useLivePricing ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              Live Prices
            </Label>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="bg-muted/30 rounded-2xl p-8 max-w-lg">
              <h2 className="text-lg font-semibold text-foreground mb-2">Ready to estimate</h2>
              <p className="text-muted-foreground mb-4">
                Describe your project scope and I'll generate a detailed material takeoff with labor costs.
              </p>
              <div className="text-left bg-background/50 rounded-lg p-4 text-sm text-muted-foreground font-mono">
                <p className="mb-1">Try:</p>
                <p>"20x30 basement, 8ft ceilings, frame + insulate + drywall + Flooret Nakan flooring. RI sales tax. Give me tight sub rates."</p>
              </div>
            </div>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border shadow-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4 rounded-lg border border-border bg-background">
                          <table className="min-w-full text-sm">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-muted/70 border-b border-border">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="px-4 py-2.5 font-semibold text-left text-foreground whitespace-nowrap text-xs uppercase tracking-wide">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-4 py-2 border-b border-border/30 text-foreground">
                          {children}
                        </td>
                      ),
                      tr: ({ children }) => (
                        <tr className="hover:bg-muted/20 transition-colors">{children}</tr>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-bold text-foreground">{children}</strong>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-base font-bold text-foreground mt-4 mb-2 border-b border-border pb-1">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-outside ml-4 my-2 space-y-0.5 text-foreground">{children}</ul>
                      ),
                      li: ({ children }) => (
                        <li className="text-foreground">{children}</li>
                      ),
                      p: ({ children }) => (
                        <p className="my-2 text-foreground leading-relaxed">{children}</p>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Calculating estimate...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project scope..."
            className="min-h-[56px] resize-none text-sm bg-background"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-14 w-14 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        {useLivePricing && (
          <p className="text-xs text-center text-green-600 dark:text-green-400 mt-2 flex items-center justify-center gap-1">
            <Wifi className="h-3 w-3" />
            Live pricing via Perplexity web search
          </p>
        )}
      </div>
    </div>
  );
}
