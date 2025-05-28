
"use client";

import type { Campaign } from "@/types";
import { CampaignCard } from "./CampaignCard";
import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"; // Added missing import
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
  
  // notifiedCampaignIds will store IDs of campaigns for which a notification has already been shown.
  const [notifiedCampaignIds, setNotifiedCampaignIds] = useState<Set<string>>(new Set());
  // initialLoadComplete flags whether the first snapshot has been processed for the current user session.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    console.log(`[CampaignList Effect] Running. User: ${user?.uid}, InitialLoad: ${initialLoadComplete}, Notified Count: ${notifiedCampaignIds.size}`);

    if (!db) {
      setError("Firestore is not initialized. Cannot fetch campaigns.");
      setIsLoading(false);
      return;
    }
    if (!user) {
      // User not loaded yet, or logged out. Clear campaigns and reset notification state.
      setCampaigns([]);
      setIsLoading(false); 
      setInitialLoadComplete(false); // Reset for next login
      setNotifiedCampaignIds(new Set()); // Reset notified IDs
      return;
    }

    setIsLoading(true);
    setError(null);

    const campaignsQuery = query(collection(db, CAMPAIGNS_COLLECTION), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(campaignsQuery, 
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        console.log(`[CampaignList Snapshot] Received ${querySnapshot.docs.length} docs. User: ${user?.uid}, InitialLoad: ${initialLoadComplete}`);
        const currentCampaignsData: Campaign[] = [];
        querySnapshot.forEach((doc) => {
          currentCampaignsData.push({ id: doc.id, ...doc.data() } as Campaign);
        });

        if (!initialLoadComplete) {
          // This is the first snapshot after component mounts or user changes.
          // Populate campaigns and mark all current campaign IDs as "notified" to prevent toasting for existing items.
          setCampaigns(currentCampaignsData);
          const idsFromFirstLoad = new Set(currentCampaignsData.map(c => c.id));
          setNotifiedCampaignIds(idsFromFirstLoad);
          setInitialLoadComplete(true); // Mark initial load as complete for this user session
          console.log(`[CampaignList Snapshot] Initial load processed. ${idsFromFirstLoad.size} campaigns marked as notified initially for user ${user.uid}.`);
        } else {
          // Initial load is complete for this user session, now check for new campaigns to notify about.
          const newNotificationsToShow: Campaign[] = [];
          currentCampaignsData.forEach(campaign => {
            if (
              campaign.createdByUserId &&
              user && // Redundant check, as effect depends on user, but good for clarity
              campaign.createdByUserId !== user.uid && // Campaign created by another user
              !notifiedCampaignIds.has(campaign.id)     // We haven't notified for this campaign ID yet
            ) {
              newNotificationsToShow.push(campaign);
              console.log(`[CampaignList Snapshot] Queued for notification: ${campaign.name} (ID: ${campaign.id}) by ${campaign.createdByUserId} (current user: ${user.uid})`);
            }
          });

          if (newNotificationsToShow.length > 0) {
            const updatedNotifiedIds = new Set(notifiedCampaignIds); 
            newNotificationsToShow.forEach(camp => {
              console.log(`[CampaignList Snapshot] Toasting for: ${camp.name}`);
              toast({
                title: "New Campaign Alert",
                description: `Campaign "${camp.name}" was launched by another user.`,
                variant: "default",
              });
              updatedNotifiedIds.add(camp.id); 
            });
            setNotifiedCampaignIds(updatedNotifiedIds); 
          }
          setCampaigns(currentCampaignsData); // Always update the displayed campaigns
        }
        setIsLoading(false);
      }, 
      (err) => {
        console.error("[CampaignList Snapshot ERROR] Failed to subscribe to campaign updates:", err);
        setError("Failed to load campaigns in real-time. Please try again.");
        setIsLoading(false);
      }
    );

    // Cleanup listener on component unmount or when dependencies change
    return () => {
      console.log("[CampaignList Effect Cleanup] Unsubscribing listener.");
      unsubscribe();
      // When the user changes (e.g., logs out), initialLoadComplete should be reset.
      // This happens because the effect re-runs, and if `user` is null, it hits the early return.
      // When `user` becomes non-null again, `initialLoadComplete` is still false, triggering the initial load logic.
    };
  }, [user, toast, notifiedCampaignIds, initialLoadComplete]); // Ensure all state/props used in effect are dependencies

  if (isLoading && !initialLoadComplete) { // Show detailed skeleton only on very first load
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
  
  if (!user && !isLoading) { 
    return <p className="text-center text-muted-foreground py-10">Please sign in to view campaigns.</p>;
  }

  if (campaigns.length === 0 && initialLoadComplete) { 
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
