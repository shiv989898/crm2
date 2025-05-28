
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
import { MOCK_CAMPAIGNS } from "@/lib/mockData";
import { startCampaignProcessingAction, generateCampaignMessagesAction } from "@/app/(authenticated)/campaigns/actions";
import { Loader2, Wand2, Sparkles, Copy } from "lucide-react";
import type { GenerateCampaignMessagesOutput } from "@/ai/flows/generate-campaign-messages-flow";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation"; // Added import


interface CreateCampaignDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  audience: Audience;
  onCampaignCreated: (campaignName: string) => void;
}

export function CreateCampaignDialog({ isOpen, onOpenChange, audience, onCampaignCreated }: CreateCampaignDialogProps) {
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("");
  const [companyName, setCompanyName] = useState("Nexus CRM"); // Default or fetch from settings
  const [productOrService, setProductOrService] = useState("our services"); // Default
  const [finalMessageTemplate, setFinalMessageTemplate] = useState("");
  
  const [messageSuggestions, setMessageSuggestions] = useState<GenerateCampaignMessagesOutput>([]);
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const { toast } = useToast();
  const router = useRouter(); // Initialize router

  useEffect(() => {
    if (isOpen) {
      setCampaignName(`Campaign for ${audience.name}`);
      // Reset other fields when dialog opens for a new audience
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
        toast({ title: "No Suggestions", description: "The AI couldn't generate message suggestions based on your input. Try rephrasing your objective.", variant: "default" });
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
    toast({ title: "Template Applied!", description: "Message template has been copied to the final message field." });
  };
  
  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast({ title: "Campaign Name Required", description: "Please enter a name.", variant: "destructive" });
      return;
    }
    if (!finalMessageTemplate.trim()) {
      toast({ title: "Message Template Required", description: "Please provide a message template for the campaign.", variant: "destructive" });
      return;
    }
     if (!finalMessageTemplate.toLowerCase().includes("{{customername}}")) {
      toast({ title: "Missing Placeholder", description: `The final message template must include {{customerName}} for personalization.`, variant: "destructive" });
      return;
    }

    setIsLaunching(true);

    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: campaignName,
      audienceId: audience.id,
      audienceName: audience.name,
      audienceSize: Math.floor(Math.random() * (100 - 10 + 1)) + 10, // Mock audience size (10-100)
      createdAt: new Date().toISOString(),
      status: "Pending",
      sentCount: 0,
      failedCount: 0,
      processedCount: 0,
      objective: campaignObjective,
      messageTemplate: finalMessageTemplate,
    };
    
    try {
      // Pass the entire campaign object to the server action
      await startCampaignProcessingAction(newCampaign); 
      toast({
        title: "Campaign Processing Started",
        description: `"${newCampaign.name}" is now being processed. Check dashboard for updates.`,
      });
      onCampaignCreated(newCampaign.name); // Call the callback passed from AudienceBuilderForm
      onOpenChange(false); // Close dialog
      router.push('/dashboard'); // Navigate to dashboard
    } catch (error) {
      console.error("Error starting campaign processing:", error);
      toast({
        title: "Processing Error",
        description: `Could not start campaign processing for "${newCampaign.name}". Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
      // Update the MOCK_CAMPAIGNS on the client-side if the server action fails,
      // so the UI reflects the failure state.
      // Note: This is tricky with server-side mock data. The action already tries to add/update server-side.
      // For robust error handling, a real DB would be better.
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isLaunching) onOpenChange(open); // Prevent closing if launching
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign for: <span className="text-primary">{audience.name}</span></DialogTitle>
          <DialogDescription>
            Define your campaign details, use AI to generate message ideas, and set your final message.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                disabled={isLaunching || isGeneratingMessages}
              />
            </div>
            <div>
              <Label htmlFor="companyName">Your Company Name (for AI)</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isLaunching || isGeneratingMessages}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="campaignObjective">Campaign Objective</Label>
            <Textarea
              id="campaignObjective"
              placeholder="e.g., Re-engage customers inactive for 3 months, Announce new summer collection"
              value={campaignObjective}
              onChange={(e) => setCampaignObjective(e.target.value)}
              rows={2}
              disabled={isLaunching || isGeneratingMessages}
            />
          </div>
          
          <div>
            <Label htmlFor="productOrService">Product/Service to Promote (for AI)</Label>
            <Input
              id="productOrService"
              placeholder="e.g., our new loyalty program, exclusive T-shirts"
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
                <Card key={index} className="bg-secondary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Suggestion {index + 1}</CardTitle>
                    <CardDescription>Tone: {suggestion.tone}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-2">{suggestion.messageText}</p>
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
            <Label htmlFor="finalMessageTemplate">Final Message Template (must include <code className="bg-muted px-1 rounded text-xs">{`{{customerName}}`}</code>)</Label>
            <Textarea
              id="finalMessageTemplate"
              placeholder="e.g., Hi {{customerName}}, don't miss our special event!"
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
          <Button onClick={handleCreateCampaign} disabled={isLaunching || !finalMessageTemplate.trim() || !campaignName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground w-[160px]">
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

