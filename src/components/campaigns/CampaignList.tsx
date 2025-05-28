
"use client";

import type { Campaign } from "@/types";
import { CampaignCard } from "./CampaignCard";
import { getCampaignsAction } from "@/app/(authenticated)/campaigns/actions"; // Import the server action
import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedCampaigns = await getCampaignsAction();
        setCampaigns(fetchedCampaigns);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
        setError("Failed to load campaigns. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="shadow-lg">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-1/2 mt-1 animate-pulse"></div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
            </CardContent>
            <CardFooter>
              <div className="h-3 bg-muted rounded w-1/3 animate-pulse"></div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-destructive">{error}</p>;
  }
  
  if (campaigns.length === 0) {
    return <p className="text-center text-muted-foreground">No campaigns found.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fadeIn">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}

// Add this to your globals.css or a utility CSS file for simple fade-in
/*
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.5s ease-out forwards;
}
*/
