
"use client";

import { useState } from "react";
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
import { MOCK_CAMPAIGNS } from "@/lib/mockData"; // For demo: adding to mock data

interface CreateCampaignDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  audience: Audience;
  onCampaignCreated: (campaignName: string) => void; // Callback after campaign creation
}

export function CreateCampaignDialog({ isOpen, onOpenChange, audience, onCampaignCreated }: CreateCampaignDialogProps) {
  const [campaignName, setCampaignName] = useState(`Campaign for ${audience.name}`);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleCreateCampaign = () => {
    if (!campaignName.trim()) {
      toast({ title: "Campaign Name Required", description: "Please enter a name for your campaign.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);

    // Simulate campaign creation and logging
    // In a real app, this would involve backend calls
    setTimeout(() => {
      const newCampaign: Campaign = {
        id: `camp-${Date.now()}`,
        name: campaignName,
        audienceId: audience.id,
        audienceName: audience.name,
        audienceSize: Math.floor(Math.random() * 1000) + 50, // Mock audience size
        createdAt: new Date().toISOString(),
        status: "Pending", // Initial status
        sentCount: 0,
        failedCount: 0,
      };

      // For demo: add to mock campaigns (this won't persist or update lists in other components without state management)
      MOCK_CAMPAIGNS.unshift(newCampaign); 
      console.log("New campaign created (mock):", newCampaign);
      
      onCampaignCreated(campaignName); // Call the callback
      setIsProcessing(false);
      onOpenChange(false); // Close dialog
      setCampaignName(`Campaign for ${audience.name}`); // Reset for next time
    }, 1500); // Simulate delay
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
          <Button type="submit" onClick={handleCreateCampaign} disabled={isProcessing} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isProcessing ? "Processing..." : "Launch Campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
