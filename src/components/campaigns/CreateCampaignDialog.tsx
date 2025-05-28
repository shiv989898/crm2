
"use client";

import { useState, useEffect } from "react";
import type { Audience, Campaign } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { startCampaignProcessingAction, generateCampaignMessagesAction } from "@/app/(authenticated)/campaigns/actions";
import { Loader2, Sparkles, Copy } from "lucide-react";
import type { GenerateCampaignMessagesOutput } from "@/ai/flows/generate-campaign-messages-flow";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth"; // Import useAuth

interface CreateCampaignDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  audience: Audience;
  onCampaignCreated: (campaignName: string) => void;
}

export function CreateCampaignDialog({ isOpen, onOpenChange, audience, onCampaignCreated }: CreateCampaignDialogProps) {
  const { user } = useAuth(); // Get the current user
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("");
  const [companyName, setCompanyName] = useState("Nexus CRM"); 
  const [productOrService, setProductOrService] = useState("our services"); 
  const [finalMessageTemplate, setFinalMessageTemplate] = useState("");
  
  const [messageSuggestions, setMessageSuggestions] = useState<GenerateCampaignMessagesOutput>([]);
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setCampaignName(`Campaign for ${audience.name}`);
      setCampaignObjective("");
      setFinalMessageTemplate("");
      setMessageSuggestions([]);
    }
  }, [isOpen, audience.name]);

  const handleGenerateMessages = async () => {
    if (!campaignObjective.trim()) {
      toast({ title: "Objective Required", description: "Please enter a campaign objective to generate messages.", variant: "destructive" });
      return;
    }
    setIsGeneratingMessages(true);
    setMessageSuggestions([]);
    try {
      const suggestions = await generateCampaignMessagesAction({
        campaignObjective,
        audienceDescription: audience.description || audience.name,
        companyName,
        productOrService,
        numSuggestions: 3,
      });
      setMessageSuggestions(suggestions);
      if (suggestions.length === 0) {
        toast({ title: "No Suggestions", description: "The AI couldn't generate message suggestions. Try rephrasing.", variant: "default" });
      } else {
        toast({ title: "AI Suggestions Generated!", description: "Review the message ideas below.", variant: "default" });
      }
    } catch (error) {
      console.error("Error generating messages:", error);
      toast({ title: "AI Error", description: "Could not generate message suggestions.", variant: "destructive" });
    } finally {
      setIsGeneratingMessages(false);
    }
  };

  const handleUseTemplate = (template: string) => {
    setFinalMessageTemplate(template);
    toast({ title: "Template Applied!", description: "Message template has been copied." });
  };
  
  const handleCreateCampaign = async () => {
    if (!user) {
      toast({ title: "Authentication Error", description: "User not found. Please sign in again.", variant: "destructive" });
      return;
    }
    if (!campaignName.trim()) {
      toast({ title: "Campaign Name Required", variant: "destructive" });
      return;
    }
    if (!finalMessageTemplate.trim()) {
      toast({ title: "Message Template Required", variant: "destructive" });
      return;
    }
     if (!finalMessageTemplate.toLowerCase().includes("{{customername}}")) {
      toast({ title: "Missing Placeholder", description: `Template must include ${"{{"}customerName${"}}"}.`, variant: "destructive" });
      return;
    }

    setIsLaunching(true);

    const campaignDataForAction = { // This satisfies the Omit type and includes createdByUserId
      name: campaignName,
      audienceId: audience.id, 
      audienceName: audience.name,
      audienceSize: Math.floor(Math.random() * (100 - 10 + 1)) + 10, 
      objective: campaignObjective,
      messageTemplate: finalMessageTemplate,
      createdByUserId: user.uid, // Add createdByUserId
    };
    
    try {
      console.log("[CreateCampaignDialog] Attempting to start campaign processing with data:", JSON.stringify(campaignDataForAction));
      const newCampaignId = await startCampaignProcessingAction(campaignDataForAction); 
      console.log("[CreateCampaignDialog] Received campaign ID from action:", newCampaignId);

      if (newCampaignId) {
        toast({
          title: "Campaign Processing Started!",
          description: `"${campaignDataForAction.name}" is now being processed. Check dashboard.`,
          variant: "default",
        });
        onCampaignCreated(campaignDataForAction.name); 
        onOpenChange(false); 
        router.push('/dashboard'); 
      } else {
        toast({
          title: "Campaign Creation Failed",
          description: "Could not start campaign. IMPORTANT: Please check the Next.js server terminal logs for detailed Firestore error messages.",
          variant: "destructive",
          duration: 10000, 
        });
      }
    } catch (error) {
      console.error("[CreateCampaignDialog] Error calling startCampaignProcessingAction:", error);
      toast({
        title: "Client-Side Error",
        description: `Could not initiate campaign processing for "${campaignDataForAction.name}". Error: ${error instanceof Error ? error.message : String(error)}. Check server logs as well.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isLaunching) onOpenChange(open); 
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Campaign for: <span className="text-primary">{audience.name}</span></DialogTitle>
          <DialogDescription>
            Define details, get AI message ideas, and set your final message. Target: ~{Math.floor(Math.random() * 100 + 50)} recipients (simulated).
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="campaignNameDialog">Campaign Name</Label>
              <Input
                id="campaignNameDialog"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                disabled={isLaunching || isGeneratingMessages}
              />
            </div>
            <div>
              <Label htmlFor="companyNameDialog">Your Company Name (for AI)</Label>
              <Input
                id="companyNameDialog"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isLaunching || isGeneratingMessages}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="campaignObjectiveDialog">Campaign Objective</Label>
            <Textarea
              id="campaignObjectiveDialog"
              placeholder="e.g., Re-engage inactive users, Promote new product X"
              value={campaignObjective}
              onChange={(e) => setCampaignObjective(e.target.value)}
              rows={2}
              disabled={isLaunching || isGeneratingMessages}
            />
          </div>
          
          <div>
            <Label htmlFor="productOrServiceDialog">Product/Service to Promote (for AI)</Label>
            <Input
              id="productOrServiceDialog"
              placeholder="e.g., our new loyalty program, summer collection"
              value={productOrService}
              onChange={(e) => setProductOrService(e.target.value)}
              disabled={isLaunching || isGeneratingMessages}
            />
          </div>

          <Button onClick={handleGenerateMessages} disabled={isLaunching || isGeneratingMessages || !campaignObjective.trim()} className="w-full">
            {isGeneratingMessages ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Suggest Messages with AI
          </Button>

          {messageSuggestions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">AI Message Suggestions:</h3>
              {messageSuggestions.map((suggestion, index) => (
                <Card key={index} className="bg-card border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-card-foreground">Suggestion {index + 1}</CardTitle>
                    <CardDescription>Tone: {suggestion.tone}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-2 text-foreground">{suggestion.messageText}</p>
                    <p className="text-xs text-muted-foreground mb-2">Image Keywords: {suggestion.suggestedImageKeywords}</p>
                    <Button onClick={() => handleUseTemplate(suggestion.messageText)} size="sm" variant="outline">
                      <Copy className="mr-2 h-3 w-3" /> Use this template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div>
            <Label htmlFor="finalMessageTemplateDialog">Final Message Template (must include {`{{customerName}}`})</Label>
            <Textarea
              id="finalMessageTemplateDialog"
              placeholder="e.g., Hi {{customerName}}, don't miss out!"
              value={finalMessageTemplate}
              onChange={(e) => setFinalMessageTemplate(e.target.value)}
              rows={3}
              disabled={isLaunching}
              className={!finalMessageTemplate.toLowerCase().includes("{{customername}}") && finalMessageTemplate ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {!finalMessageTemplate.toLowerCase().includes("{{customername}}") && finalMessageTemplate && (
                 <p className="text-xs text-destructive mt-1">Template must include {`{{customerName}}`}.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLaunching}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCampaign} 
            disabled={isLaunching || !finalMessageTemplate.trim() || !campaignName.trim() || !user} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground w-[160px]"
          >
            {isLaunching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Launching...
              </>
            ) : (
              "Launch Campaign"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
