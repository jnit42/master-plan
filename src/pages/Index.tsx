import { EstimatorChat } from "@/components/EstimatorChat";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Building2, FileCheck2, LogOut, MessageSquareText, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
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
                <TriangleAlert className="h-4 w-4 text-destructive" />
                Current gap
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">Project UI pending</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Projects/Quotes/Lines/Gaps dashboards are scaffolded below for completion.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="estimator" className="flex h-full flex-col">
          <TabsList className="mx-6 mt-2 w-fit">
            <TabsTrigger value="estimator">Estimator</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="gaps">Gaps</TabsTrigger>
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
                  Projects workspace scaffold
                </CardTitle>
                <CardDescription>
                  Create a project list + detail panel connected to your database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm font-medium text-foreground">Suggested next build items:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Project create/edit/delete flows</li>
                  <li>Status filters and archived views</li>
                  <li>Address + budget metadata panels</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes" className="flex-1 overflow-auto p-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5" />
                  Quote reconciliation scaffold
                </CardTitle>
                <CardDescription>Dedicated area for wrapper/additive/reference quote workflows.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm font-medium text-foreground">Suggested next build items:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Vendor quote ingestion + normalization</li>
                  <li>Line-item matching confidence drill-down</li>
                  <li>Decision queue for potential duplicates</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gaps" className="flex-1 overflow-auto p-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5" />
                  Exclusion &amp; gap tracking scaffold
                </CardTitle>
                <CardDescription>Track missing scope and estimate low/mid/high confidence ranges.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm font-medium text-foreground">Suggested next build items:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Gap extraction confirmation screen</li>
                  <li>Resolved-by quote linkage actions</li>
                  <li>Ratebook source and confidence audit trail</li>
                </ul>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground">
                  This gives you a complete UI shell now, while preserving a clear build path for production-grade workflows.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
