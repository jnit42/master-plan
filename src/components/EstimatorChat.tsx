import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Wifi, WifiOff, Trash2, Calculator, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MessageContent = 
  | string 
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type Message = {
  role: "user" | "assistant";
  content: MessageContent;
};

type ImagePreview = {
  file: File;
  dataUrl: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate`;

export function EstimatorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useLivePricing, setUseLivePricing] = useState(true);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
           msg.includes("insul") ||
           msg.includes("blueprint") ||
           msg.includes("plan") ||
           msg.includes("drawing");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: ImagePreview[] = [];
    const maxSize = 10 * 1024 * 1024; // 10MB limit

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImages(prev => [...prev, { file, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!input.trim() && images.length === 0) || isLoading) return;

    // Build message content
    let userContent: MessageContent;
    
    if (images.length > 0) {
      const contentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
      
      // Add images first
      images.forEach(img => {
        contentParts.push({
          type: "image_url",
          image_url: { url: img.dataUrl }
        });
      });
      
      // Add text prompt
      if (input.trim()) {
        contentParts.push({ type: "text", text: input.trim() });
      } else {
        // Default prompt if only image uploaded
        contentParts.push({ 
          type: "text", 
          text: "Analyze this blueprint/plan. Extract all dimensions, identify the scope of work, and create a complete material takeoff and labor estimate." 
        });
      }
      
      userContent = contentParts;
    } else {
      userContent = input.trim();
    }

    const userMessage: Message = { role: "user", content: userContent };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setImages([]);
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
      const enableLivePricing = useLivePricing && shouldUseLivePricing(typeof userContent === 'string' ? userContent : input);
      
      if (images.length > 0) {
        toast.info("Analyzing blueprint...", { duration: 3000 });
      } else if (enableLivePricing) {
        toast.info("Fetching live pricing...", { duration: 2000 });
      }
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
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
    setImages([]);
  };

  const getDisplayContent = (content: MessageContent): string => {
    if (typeof content === 'string') return content;
    const textPart = content.find(p => p.type === 'text');
    return textPart?.type === 'text' ? textPart.text : '';
  };

  const getImageUrls = (content: MessageContent): string[] => {
    if (typeof content === 'string') return [];
    return content
      .filter(p => p.type === 'image_url')
      .map(p => p.type === 'image_url' ? p.image_url.url : '');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">GC Estimator</h1>
            <p className="text-xs text-muted-foreground">Blueprints, takeoffs & labor costs</p>
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
                Upload a blueprint or describe your project for a detailed material takeoff with competitive sub rates.
              </p>
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-xl p-4 text-left">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Text Prompt</p>
                  <p className="text-sm text-foreground">
                    "20x30 basement, 8ft ceilings. Frame, insulate, drywall, LVP flooring. RI sales tax."
                  </p>
                </div>
                <div className="bg-blue-500/10 rounded-xl p-4 text-left border border-blue-500/20">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide font-medium flex items-center gap-1.5">
                    <ImagePlus className="h-3 w-3" />
                    Blueprint Upload
                  </p>
                  <p className="text-sm text-foreground">
                    Upload floor plans or architectural drawings for full scope analysis and takeoffs.
                  </p>
                </div>
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
                  {msg.role === "user" && (
                    <div>
                      {/* Show images in user message */}
                      {getImageUrls(msg.content).length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {getImageUrls(msg.content).map((url, idx) => (
                            <img 
                              key={idx}
                              src={url} 
                              alt="Uploaded blueprint" 
                              className="max-h-32 rounded-lg border border-primary-foreground/20"
                            />
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-sm">{getDisplayContent(msg.content)}</p>
                    </div>
                  )}
                  {msg.role === "assistant" && (
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
                        {typeof msg.content === 'string' ? msg.content : ''}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">{images.length > 0 ? "Analyzing blueprint..." : "Calculating..."}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="border-t border-border/50 px-4 py-3 bg-muted/30">
          <div className="flex gap-2 max-w-3xl mx-auto flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img 
                  src={img.dataUrl} 
                  alt={`Upload ${idx + 1}`}
                  className="h-16 w-auto rounded-lg border border-border"
                />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="h-12 w-12 rounded-xl shrink-0"
            title="Upload blueprint or floor plan"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={images.length > 0 ? "Add instructions for this blueprint..." : "Describe your project or upload a blueprint..."}
            className="min-h-[48px] max-h-[120px] resize-none text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={(!input.trim() && images.length === 0) || isLoading}
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