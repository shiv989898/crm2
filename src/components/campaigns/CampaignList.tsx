
"use client";

import type { Campaign } from "@/types";
import { CampaignCard } from "./CampaignCard";
import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { db } from "@/config/firebase";
import { collection, query, orderBy, onSnapshot, type DocumentData, type QuerySnapshot } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const CAMPAIGNS_COLLECTION = 'campaigns';

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifiedCampaignIds, setNotifiedCampaignIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!db) {
      setError("Firestore is not initialized. Cannot fetch campaigns.");
      setIsLoading(false);
      return;
    }
    if (!user) {
      // Don't try to fetch if user is not yet loaded or logged out
      setIsLoading(false); // Or true if you want a loader until user is available
      return;
    }

    setIsLoading(true);
    setError(null);

    const campaignsQuery = query(collection(db, CAMPAIGNS_COLLECTION), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(campaignsQuery, 
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        const fetchedCampaigns: Campaign[] = [];
        let newCampaignsForNotification: Campaign[] = [];

        querySnapshot.forEach((doc) => {
          const campaignData = { id: doc.id, ...doc.data() } as Campaign;
          fetchedCampaigns.push(campaignData);

          // Check for notification: new campaign not created by current user
          if (
            campaignData.createdByUserId &&
            campaignData.createdByUserId !== user.uid &&
            !notifiedCampaignIds.has(campaignData.id)
          ) {
            // Heuristic: consider "new" if created in the last few minutes, or simply if ID is new to this session
            // This simple check only notifies once per campaign ID per session/load
            newCampaignsForNotification.push(campaignData);
          }
        });

        setCampaigns(fetchedCampaigns);
        setIsLoading(false);

        if (newCampaignsForNotification.length > 0) {
          const updatedNotifiedIds = new Set(notifiedCampaignIds);
          newCampaignsForNotification.forEach(camp => {
            toast({
              title: "New Campaign Launched",
              description: `Campaign "${camp.name}" was just launched by another user.`,
              variant: "default", // Or a custom 'info' variant if you have one
            });
            updatedNotifiedIds.add(camp.id);
          });
          setNotifiedCampaignIds(updatedNotifiedIds);
        }
      }, 
      (err) => {
        console.error("Failed to subscribe to campaign updates:", err);
        setError("Failed to load campaigns in real-time. Please try again.");
        setIsLoading(false);
      }
    );

    // Cleanup listener on component unmount
    return () => unsubscribe();

  }, [user, toast, notifiedCampaignIds]); // Add dependencies

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="shadow-lg rounded-lg overflow-hidden">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-1/2 mt-2 animate-pulse"></div>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
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
    return <p className="text-center text-destructive py-10">{error}</p>;
  }
  
  if (campaigns.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No campaigns found. Why not create one?</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}
