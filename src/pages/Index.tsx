import { useMemo, useState } from "react";
import { EstimatorChat } from "@/components/EstimatorChat";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, FileCheck2, LogOut, MessageSquareText, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { benchmarkSubBid, recommendRetailPrice } from "@/lib/engine/pricingIntelligence";

interface QuickProject {
  id: string;
  name: string;
  city: string;
  status: "active" | "planning";
}

const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const Index = () => {
  const { user, signOut } = useAuth();

  const [projectName, setProjectName] = useState("");
  const [projectCity, setProjectCity] = useState("");
  const [projects, setProjects] = useState<QuickProject[]>([]);

  const [marketLow, setMarketLow] = useState("8500");
  const [marketLikely, setMarketLikely] = useState("10000");
  const [marketHigh, setMarketHigh] = useState("12000");
  const [subBid, setSubBid] = useState("13500");

  const [hardCost, setHardCost] = useState("100000");
  const [oh, setOh] = useState("10");
  const [profit, setProfit] = useState("15");
  const [cont, setCont] = useState("8");

  const quoteBenchmark = useMemo(() => {
    return benchmarkSubBid(Number(subBid) || 0, {
      low: Number(marketLow) || 0,
      likely: Number(marketLikely) || 0,
      high: Number(marketHigh) || 0,
      confidence: "MEDIUM",
      source: { type: "RATEBOOK_V1", ref: "quick-tool", date: new Date().toISOString() },
    });
  }, [marketHigh, marketLikely, marketLow, subBid]);

  const retail = useMemo(() => {
    return recommendRetailPrice(Number(hardCost) || 0, {
      overheadPercent: Number(oh) || 0,
      profitPercent: Number(profit) || 0,
      contingencyPercent: Number(cont) || 0,
    });
  }, [cont, hardCost, oh, profit]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
  };

  const addProject = () => {
    if (!projectName.trim()) {
      toast.error("Project name is required");
      return;
    }

    setProjects((prev) => [
      {
        id: crypto.randomUUID(),
        name: projectName.trim(),
        city: projectCity.trim() || "Unknown",
        status: "planning",
      },
      ...prev,
    ]);
    setProjectName("");
    setProjectCity("");
    toast.success("Project draft added");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-foreground">MasterContractorOS</h1>
            <p className="text-xs text-muted-foreground">AI-assisted estimating, quote safety, and gap tracking</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="flex gap-3 border-b px-6 py-2">
          <Card className="flex-1 border-0 shadow-none">
            <CardHeader className="p-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquareText className="h-4 w-4 text-primary" />
                Estimator
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Ready</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Upload plans, PDFs, and images for complete takeoffs.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="flex-1 border-0 shadow-none">
            <CardHeader className="p-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Safety checks
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Constitution on</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Wrapper quote, duplicate, and exclusion-gap guardrails enabled in schema/engine.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="flex-1 border-0 shadow-none">
            <CardHeader className="p-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TriangleAlert className="h-4 w-4 text-primary" />
                Tools
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Interactive</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Projects, quote benchmark, and retail targeting tabs now respond with real calculations.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="estimator" className="flex h-full flex-col">
          <TabsList className="mx-6 mt-2 w-fit">
            <TabsTrigger value="estimator">Estimator</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="retail">Retail</TabsTrigger>
          </TabsList>

          <TabsContent value="estimator" className="flex-1 overflow-hidden px-0">
            <div className="h-full">
              <EstimatorChat />
            </div>
          </TabsContent>

          <TabsContent value="projects" className="flex-1 overflow-auto p-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Project drafts
                </CardTitle>
                <CardDescription>Add quick project drafts while testing the app.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex-1">
                    <Label>Name</Label>
                    <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Kitchen remodel" />
                  </div>
                  <div className="flex-1">
                    <Label>City</Label>
                    <Input value={projectCity} onChange={(e) => setProjectCity(e.target.value)} placeholder="Providence" />
                  </div>
                  <div>
                    <Button onClick={addProject}>Add project</Button>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No projects yet. Add one above to verify interactions.</p>
                  ) : (
                    projects.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.city}</p>
                        </div>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">{p.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes" className="flex-1 overflow-auto p-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5" />
                  Sub bid benchmark tool
                </CardTitle>
                <CardDescription>Check if a sub quote is low, fair, high, or extreme versus your market range.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <Input value={marketLow} onChange={(e) => setMarketLow(e.target.value)} placeholder="Market low" type="number" />
                  <Input value={marketLikely} onChange={(e) => setMarketLikely(e.target.value)} placeholder="Market likely" type="number" />
                  <Input value={marketHigh} onChange={(e) => setMarketHigh(e.target.value)} placeholder="Market high" type="number" />
                  <Input value={subBid} onChange={(e) => setSubBid(e.target.value)} placeholder="Sub bid" type="number" />
                </div>
                <div className="rounded-md border p-4 space-y-1">
                  <p className="text-sm font-semibold">Position: {quoteBenchmark.position}</p>
                  <p className="text-sm text-muted-foreground">Variance: {quoteBenchmark.varianceFromLikelyPercent}% vs likely</p>
                  <p className="text-sm text-muted-foreground">{quoteBenchmark.message}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retail" className="flex-1 overflow-auto p-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5" />
                  Retail target calculator
                </CardTitle>
                <CardDescription>Quickly derive client-facing floor/target/stretch price from hard costs.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <Input value={hardCost} onChange={(e) => setHardCost(e.target.value)} placeholder="Hard cost" type="number" />
                  <Input value={oh} onChange={(e) => setOh(e.target.value)} placeholder="OH %" type="number" />
                  <Input value={profit} onChange={(e) => setProfit(e.target.value)} placeholder="Profit %" type="number" />
                  <Input value={cont} onChange={(e) => setCont(e.target.value)} placeholder="Contingency %" type="number" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-xs text-muted-foreground">Floor</p>
                    <p className="text-lg font-semibold">{formatMoney(retail.floor)}</p>
                  </div>
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-xs text-muted-foreground">Target</p>
                    <p className="text-lg font-semibold">{formatMoney(retail.target)}</p>
                  </div>
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-xs text-muted-foreground">Stretch</p>
                    <p className="text-lg font-semibold">{formatMoney(retail.stretch)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
