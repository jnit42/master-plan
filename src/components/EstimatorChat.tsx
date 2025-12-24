import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Wifi, WifiOff, Trash2, Calculator, ImagePlus, X, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as pdfjsLib from "pdfjs-dist";
import html2pdf from "html2pdf.js";

// Set PDF.js worker - use CDN with exact version match
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type MessageContent = 
  | string 
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type Message = {
  role: "user" | "assistant";
  content: MessageContent;
};

type FilePreview = {
  file: File;
  dataUrl: string;
  type: 'image' | 'pdf';
  pageCount?: number;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate`;

async function convertPdfToImages(file: File): Promise<string[]> {
  console.log("Starting PDF conversion for:", file.name, "size:", file.size);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log("ArrayBuffer created, size:", arrayBuffer.byteLength);
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log("PDF loaded, pages:", pdf.numPages);
    
    const images: string[] = [];
    
    // Convert each page (up to 10 pages to avoid huge payloads)
    const maxPages = Math.min(pdf.numPages, 10);
    
    for (let i = 1; i <= maxPages; i++) {
      console.log(`Rendering page ${i}/${maxPages}`);
      const page = await pdf.getPage(i);
      
      // Use scale of 1.5 for balance between quality and size
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        console.error("Failed to get canvas context for page", i);
        continue;
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      // Convert to JPEG with moderate quality
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      console.log(`Page ${i} converted, size: ${Math.round(dataUrl.length / 1024)}KB`);
      images.push(dataUrl);
    }
    
    console.log("PDF conversion complete, total images:", images.length);
    return images;
  } catch (error) {
    console.error("PDF conversion failed:", error);
    throw error;
  }
}

export function EstimatorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useLivePricing, setUseLivePricing] = useState(true);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const estimateContentRef = useRef<HTMLDivElement>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const maxSize = 20 * 1024 * 1024; // 20MB limit
    setIsProcessingFile(true);

    try {
      for (const file of Array.from(selectedFiles)) {
        if (file.size > maxSize) {
          toast.error(`${file.name} is too large (max 20MB)`);
          continue;
        }

        if (file.type === 'application/pdf') {
          // Convert PDF to images
          toast.info(`Processing ${file.name}...`);
          try {
            const pdfImages = await convertPdfToImages(file);
            
            if (pdfImages.length > 0) {
              // Store first page as preview, but we'll send all pages
              setFiles(prev => [...prev, { 
                file, 
                dataUrl: pdfImages[0], 
                type: 'pdf',
                pageCount: pdfImages.length 
              }]);
              toast.success(`${file.name}: ${pdfImages.length} page(s) ready`);
            } else {
              toast.error(`${file.name}: No pages could be converted`);
            }
          } catch (pdfError) {
            console.error("PDF processing error:", pdfError);
            toast.error(`${file.name}: Failed to process PDF - ${pdfError instanceof Error ? pdfError.message : 'unknown error'}`);
          }
        } else if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setFiles(prev => [...prev, { file, dataUrl, type: 'image' }]);
          };
          reader.readAsDataURL(file);
        } else {
          toast.error(`${file.name}: Unsupported format. Use PDF or images.`);
        }
      }
    } catch (error) {
      console.error("File processing error:", error);
      toast.error("Failed to process file");
    } finally {
      setIsProcessingFile(false);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!input.trim() && files.length === 0) || isLoading || isProcessingFile || isSubmitting) return;
    
    // Prevent double submission
    setIsSubmitting(true);

    // Build message content
    let userContent: MessageContent;
    const imageUrls: string[] = [];
    
    // Process all files - convert PDFs to multiple images
    for (const f of files) {
      if (f.type === 'pdf') {
        // Re-convert PDF to get all pages
        const pdfImages = await convertPdfToImages(f.file);
        imageUrls.push(...pdfImages);
      } else {
        imageUrls.push(f.dataUrl);
      }
    }
    
    if (imageUrls.length > 0) {
      const contentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
      
      // Add all images
      imageUrls.forEach(url => {
        contentParts.push({
          type: "image_url",
          image_url: { url }
        });
      });
      
      // Add text prompt
      if (input.trim()) {
        contentParts.push({ type: "text", text: input.trim() });
      } else {
        contentParts.push({ 
          type: "text", 
          text: "Analyze this blueprint/plan. Extract all dimensions, identify the full scope of work, and create a complete material takeoff down to every item needed. Also provide the full labor scope with fair subcontractor pricing." 
        });
      }
      
      userContent = contentParts;
    } else {
      userContent = input.trim();
    }

    const userMessage: Message = { role: "user", content: userContent };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setFiles([]);
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
      
      if (imageUrls.length > 0) {
        toast.info(`Analyzing ${imageUrls.length} page(s)...`, { duration: 3000 });
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
      setIsSubmitting(false);
    }
  };

  const exportToPdf = async () => {
    // Find the last assistant message
    const lastAssistant = messages.filter(m => m.role === "assistant").pop();
    if (!lastAssistant) {
      toast.error("No estimate to export");
      return;
    }

    toast.info("Generating PDF...");

    // Create a temporary div with the estimate content
    const tempDiv = document.createElement("div");
    tempDiv.style.padding = "40px";
    tempDiv.style.fontFamily = "Arial, sans-serif";
    tempDiv.style.maxWidth = "800px";
    tempDiv.style.background = "white";
    tempDiv.style.color = "black";
    
    const content = typeof lastAssistant.content === "string" 
      ? lastAssistant.content 
      : lastAssistant.content.find(p => p.type === "text")?.type === "text" 
        ? (lastAssistant.content.find(p => p.type === "text") as { type: "text"; text: string }).text 
        : "";

    // Convert markdown to HTML (basic conversion)
    const htmlContent = content
      .replace(/^### (.*$)/gm, "<h3 style='margin-top: 16px; margin-bottom: 8px; font-size: 14px; font-weight: bold;'>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2 style='margin-top: 20px; margin-bottom: 10px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px;'>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1 style='margin-top: 24px; margin-bottom: 12px; font-size: 20px; font-weight: bold;'>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^\| (.*) \|$/gm, (match, content) => {
        const cells = content.split("|").map((c: string) => c.trim());
        return "<tr>" + cells.map((c: string) => `<td style="border: 1px solid #ddd; padding: 8px; font-size: 11px;">${c}</td>`).join("") + "</tr>";
      })
      .replace(/^\|[-|]+\|$/gm, "")
      .replace(/^• (.*$)/gm, "<li style='margin-left: 20px; font-size: 12px;'>$1</li>")
      .replace(/^- (.*$)/gm, "<li style='margin-left: 20px; font-size: 12px;'>$1</li>")
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");

    tempDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; color: #333;">Construction Estimate</h1>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 12px;">Generated ${new Date().toLocaleDateString()}</p>
      </div>
      <div style="font-size: 12px; line-height: 1.6;">
        ${htmlContent}
      </div>
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center;">
        Generated by GC Estimator
      </div>
    `;

    document.body.appendChild(tempDiv);

    try {
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `estimate-${new Date().toISOString().split("T")[0]}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(tempDiv)
        .save();
      
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      document.body.removeChild(tempDiv);
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
    setFiles([]);
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
          {messages.some(m => m.role === "assistant") && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={exportToPdf} 
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Export PDF</span>
            </Button>
          )}
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
                Upload blueprints (PDF or images) or describe your project for a detailed material takeoff.
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
                    <FileText className="h-3 w-3" />
                    PDF & Image Upload
                  </p>
                  <p className="text-sm text-foreground">
                    Upload floor plans, blueprints, or architectural drawings (PDF or images) for full scope analysis.
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
                          {getImageUrls(msg.content).slice(0, 4).map((url, idx) => (
                            <img 
                              key={idx}
                              src={url} 
                              alt={`Page ${idx + 1}`} 
                              className="max-h-24 rounded-lg border border-primary-foreground/20"
                            />
                          ))}
                          {getImageUrls(msg.content).length > 4 && (
                            <div className="flex items-center justify-center h-24 px-3 rounded-lg bg-primary-foreground/10 text-xs">
                              +{getImageUrls(msg.content).length - 4} more
                            </div>
                          )}
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
                    <span className="text-xs">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* File Previews */}
      {files.length > 0 && (
        <div className="border-t border-border/50 px-4 py-3 bg-muted/30">
          <div className="flex gap-2 max-w-3xl mx-auto flex-wrap">
            {files.map((f, idx) => (
              <div key={idx} className="relative group">
                {f.type === 'pdf' ? (
                  <div className="h-16 w-20 rounded-lg border border-border bg-card flex flex-col items-center justify-center gap-1">
                    <FileText className="h-6 w-6 text-red-500" />
                    <span className="text-[10px] text-muted-foreground">{f.pageCount} pg</span>
                  </div>
                ) : (
                  <img 
                    src={f.dataUrl} 
                    alt={`Upload ${idx + 1}`}
                    className="h-16 w-auto rounded-lg border border-border"
                  />
                )}
                <button
                  onClick={() => removeFile(idx)}
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
            accept="image/*,.pdf,application/pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isProcessingFile}
            className="h-12 w-12 rounded-xl shrink-0"
            title="Upload blueprint (PDF or image)"
          >
            {isProcessingFile ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={files.length > 0 ? "Add instructions for this blueprint..." : "Describe your project or upload a blueprint..."}
            className="min-h-[48px] max-h-[120px] resize-none text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={(!input.trim() && files.length === 0) || isLoading || isProcessingFile}
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