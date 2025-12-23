import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Wifi, WifiOff, Trash2, Calculator } from "lucide-react";
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

  const shouldUseLivePricing = (userMessage: string): boolean => {
    const msg = userMessage.toLowerCase();
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
        toast.info("Fetching live pricing...", { duration: 2000 });
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
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* Header - Clean and minimal */}
      <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">GC Estimator</h1>
            <p className="text-xs text-muted-foreground">Material takeoffs & labor costs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUseLivePricing(!useLivePricing)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              useLivePricing 
                ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                : "bg-muted text-muted-foreground"
            }`}
          >
            {useLivePricing ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {useLivePricing ? "Live" : "Off"}
          </button>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center max-w-md">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Calculator className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Ready to estimate</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Describe your project and get a detailed material takeoff with competitive sub rates.
              </p>
              <div className="bg-muted/50 rounded-xl p-4 text-left">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Example</p>
                <p className="text-sm text-foreground">
                  "20x30 basement, 8ft ceilings. Frame, insulate, drywall, Flooret Nakan flooring. RI sales tax."
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-w-4xl mx-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground max-w-[80%]"
                      : "bg-card border border-border/50 shadow-sm w-full"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-table:my-2 prose-p:my-1.5 prose-ul:my-1.5 prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sm prose-h3:mt-3">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-3 rounded-lg border border-border bg-muted/30">
                              <table className="min-w-full text-xs">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-muted/50">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="px-3 py-2 font-semibold text-left text-foreground text-[11px] uppercase tracking-wider">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3 py-2 border-t border-border/30 text-foreground text-xs">
                              {children}
                            </td>
                          ),
                          tr: ({ children }) => (
                            <tr className="hover:bg-muted/20">{children}</tr>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-sm font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border/50">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-xs font-semibold text-foreground mt-3 mb-1">{children}</h3>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc list-outside ml-4 my-1.5 space-y-0.5 text-xs">{children}</ul>
                          ),
                          li: ({ children }) => (
                            <li className="text-foreground text-xs">{children}</li>
                          ),
                          p: ({ children }) => (
                            <p className="my-1.5 text-foreground text-sm leading-relaxed">{children}</p>
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
                <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Calculating...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input - Clean bottom bar */}
      <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project..."
            className="min-h-[48px] max-h-[120px] resize-none text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 rounded-xl shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
