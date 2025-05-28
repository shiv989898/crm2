
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
import { useToast } from "@/hooks/use-toast";
import { MOCK_CAMPAIGNS } from "@/lib/mockData"; 
import { startCampaignProcessingAction } from "@/app/(authenticated)/campaigns/actions";
import { Loader2 } from "lucide-react";

interface CreateCampaignDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  audience: Audience;
  onCampaignCreated: (campaignName: string) => void; 
}

export function CreateCampaignDialog({ isOpen, onOpenChange, audience, onCampaignCreated }: CreateCampaignDialogProps) {
  const [campaignName, setCampaignName] = useState(`Campaign for ${audience.name}`);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast({ title: "Campaign Name Required", description: "Please enter a name for your campaign.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);

    const newCampaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: campaignName,
      audienceId: audience.id,
      audienceName: audience.name,
      audienceSize: Math.floor(Math.random() * 91) + 10, // Mock audience size (10-100)
      createdAt: new Date().toISOString(),
      status: "Pending", 
      sentCount: 0,
      failedCount: 0,
      processedCount: 0,
    };

    MOCK_CAMPAIGNS.unshift(newCampaign); 
    
    toast({
      title: "Campaign Initiated!",
      description: `Campaign "${newCampaign.name}" has been created and is queued for processing.`,
    });
    
    onOpenChange(false); // Close dialog

    try {
      // This action updates the campaign status to 'Processing' and simulates message sending
      await startCampaignProcessingAction(newCampaign.id);
      
      // Toast after action is called, actual processing is "background"
      toast({
        title: "Campaign Processing Started",
        description: `"${newCampaign.name}" is now being processed. Check the dashboard for updates.`,
        variant: "default",
      });
      onCampaignCreated(newCampaign.name); // Callback
    } catch (error) {
      console.error("Error starting campaign processing:", error);
      toast({
        title: "Processing Error",
        description: "Could not start campaign processing. The campaign may be marked as Failed.",
        variant: "destructive",
      });
      // Update status in MOCK_CAMPAIGNS if starting failed
      const campaignInMock = MOCK_CAMPAIGNS.find(c => c.id === newCampaign.id);
      if (campaignInMock) {
        campaignInMock.status = "Failed";
      }
    } finally {
      setIsProcessing(false); 
      // Reset name for next time dialog opens, if dialog is reused for different audiences.
      // If audience prop changes, this component might re-render and reset state naturally.
      // setCampaignName(`Campaign for ${audience.name}`); // Or handle in useEffect if audience changes
    }
  };
  
  // Reset campaign name if audience changes while dialog is mounted (though unlikely for this pattern)
  // Or more simply, when dialog re-opens for a new audience. This is handled by onOpenChange.
  useEffect(() => {
    if (isOpen) {
      setCampaignName(`Campaign for ${audience.name}`);
    }
  }, [isOpen, audience.name]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsProcessing(false); // Reset processing state if dialog is closed externally
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Launch a new campaign for the audience: <strong className="text-primary">{audience.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="campaignName" className="text-right">
              Campaign Name
            </Label>
            <Input
              id="campaignName"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="col-span-3"
              disabled={isProcessing}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
             <Label className="text-right">Audience</Label>
             <p className="col-span-3 text-sm text-muted-foreground">{audience.name}</p>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
             <Label className="text-right">Rules</Label>
             <p className="col-span-3 text-sm text-muted-foreground">{audience.rules.length} rule(s) defined.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleCreateCampaign} disabled={isProcessing} className="bg-primary hover:bg-primary/90 text-primary-foreground w-[160px]">
            {isProcessing ? (
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
