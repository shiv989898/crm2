
"use server";

import { MOCK_CAMPAIGNS, MOCK_COMMUNICATION_LOGS } from '@/lib/mockData';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';
import { generateCampaignMessages, type GenerateCampaignMessagesInput, type GenerateCampaignMessagesOutput } from '@/ai/flows/generate-campaign-messages-flow';

export async function getCampaignsAction(): Promise<Campaign[]> {
  console.log(`[getCampaignsAction] ENTERED. Timestamp: ${new Date().toISOString()}`);
  console.log(`[getCampaignsAction] MOCK_CAMPAIGNS current length: ${MOCK_CAMPAIGNS.length}`);
  console.log(`[getCampaignsAction] Campaigns (names) before returning:`, MOCK_CAMPAIGNS.map(c => c.name));
  // Return a new sorted array to prevent accidental mutation and ensure consistent order
  const sortedCampaigns = [...MOCK_CAMPAIGNS].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return sortedCampaigns;
}

// This function is called by the "dummy vendor API" simulation
export async function deliveryReceiptAction(logId: string, deliveryStatus: 'Sent' | 'Failed') {
  const logEntry = MOCK_COMMUNICATION_LOGS.find(log => log.logId === logId);
  if (!logEntry) {
    console.error(`[deliveryReceiptAction] Log entry ${logId} not found.`);
    return;
  }
  logEntry.status = deliveryStatus;
  logEntry.timestamp = new Date().toISOString(); // Update timestamp on final status

  const campaign = MOCK_CAMPAIGNS.find(c => c.id === logEntry.campaignId);
  if (!campaign) {
    console.error(`[deliveryReceiptAction] Campaign ${logEntry.campaignId} for log ${logId} not found.`);
    return;
  }

  // Ensure counts are initialized if undefined
  campaign.sentCount = campaign.sentCount || 0;
  campaign.failedCount = campaign.failedCount || 0;
  campaign.processedCount = campaign.processedCount || 0;

  if (deliveryStatus === 'Sent') {
    campaign.sentCount++;
  } else {
    campaign.failedCount++;
  }
  campaign.processedCount++;

  // Check if all messages for the campaign have been processed
  if (campaign.processedCount === campaign.audienceSize) {
    if (campaign.failedCount === 0 && campaign.sentCount === campaign.audienceSize) {
      campaign.status = 'Sent';
    } else if (campaign.sentCount === 0 && campaign.failedCount === campaign.audienceSize) {
      campaign.status = 'Failed';
    } else {
      campaign.status = 'CompletedWithFailures';
    }
    console.log(`[deliveryReceiptAction] Campaign ${campaign.id} final status updated: ${campaign.status}`);
  } else if (campaign.status !== 'Processing') {
    campaign.status = 'Processing';
  }
}

export async function startCampaignProcessingAction(campaignToProcess: Campaign) {
  console.log(`[startCampaignProcessingAction] Received campaign: { id: ${campaignToProcess.id}, name: "${campaignToProcess.name}", status: "${campaignToProcess.status}" }`);
  console.log(`[startCampaignProcessingAction] MOCK_CAMPAIGNS length BEFORE add/update: ${MOCK_CAMPAIGNS.length}`);

  let campaignRef: Campaign | undefined = MOCK_CAMPAIGNS.find(c => c.id === campaignToProcess.id);

  if (!campaignRef) {
    // This is a new campaign. Add it to the MOCK_CAMPAIGNS array.
    // The campaignToProcess object already has its initial status set to "Pending" by the client.
    // We create a new object to ensure we're adding exactly what's needed.
    const newCampaignEntry: Campaign = {
      ...campaignToProcess, // Spread all properties from the input
      status: "Pending",    // Explicitly set/ensure status
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
    };
    MOCK_CAMPAIGNS.unshift(newCampaignEntry); // Add to the beginning of the array
    campaignRef = newCampaignEntry; // campaignRef is now the object *in* the MOCK_CAMPAIGNS array
    console.log(`[startCampaignProcessingAction] Campaign "${campaignRef.name}" (ID: ${campaignRef.id}) ADDED to MOCK_CAMPAIGNS.`);
  } else {
    // Campaign exists, update it. campaignRef is already the object from MOCK_CAMPAIGNS.
    Object.assign(campaignRef, {
      ...campaignToProcess, // Update with incoming details
      status: "Pending",    // Reset status for reprocessing
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
    });
    console.log(`[startCampaignProcessingAction] Campaign "${campaignRef.name}" (ID: ${campaignRef.id}) UPDATED in MOCK_CAMPAIGNS.`);
  }
  
  console.log(`[startCampaignProcessingAction] MOCK_CAMPAIGNS length AFTER add/update: ${MOCK_CAMPAIGNS.length}`);
  console.log(`[startCampaignProcessingAction] MOCK_CAMPAIGNS (names) after add/update:`, MOCK_CAMPAIGNS.map(c => c.name));
  
  // At this point, campaignRef *must* be defined if the logic above is correct
  if (!campaignRef) {
    console.error(`[startCampaignProcessingAction] CRITICAL ERROR: Campaign "${campaignToProcess.name}" not found in MOCK_CAMPAIGNS after attempt to add/update.`);
    throw new Error(`Campaign ${campaignToProcess.id} could not be prepared for processing.`);
  }
  
  // Now work with campaignRef, which is guaranteed to be the object from the MOCK_CAMPAIGNS array
  console.log(`[startCampaignProcessingAction] Initializing campaign "${campaignRef.name}" (ID: ${campaignRef.id}). Target audience size: ${campaignRef.audienceSize}. Current status: ${campaignRef.status}`);

  // Short delay to allow UI to potentially show "Pending" before "Processing"
  await new Promise(r => setTimeout(r, 200)); // Slightly increased delay

  campaignRef.status = 'Processing'; // This mutates the object in MOCK_CAMPAIGNS
  console.log(`[startCampaignProcessingAction] Campaign "${campaignRef.name}" (ID: ${campaignRef.id}) status changed to Processing.`);

  // Clear previous logs for this campaign if re-processing
  const existingLogIndexes = MOCK_COMMUNICATION_LOGS.reduce((acc, log, index) => {
    if (log.campaignId === campaignRef!.id) { 
      acc.push(index);
    }
    return acc;
  }, [] as number[]);
  for (let i = existingLogIndexes.length - 1; i >= 0; i--) {
    MOCK_COMMUNICATION_LOGS.splice(existingLogIndexes[i], 1);
  }

  const processingPromises: Promise<void>[] = [];

  for (let i = 0; i < campaignRef.audienceSize; i++) {
    const customerId = `cust-${campaignRef.id}-${Date.now()}-${i}`;
    const firstNames = ["Alex", "Jamie", "Chris", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Drew", "Skyler"];
    const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const customerName = `${firstNames[i % firstNames.length]} ${lastInitials[i % lastInitials.length]}.`;

    let message = campaignRef.messageTemplate ? campaignRef.messageTemplate.replace(/\{\{customerName\}\}/gi, customerName) : `Hi ${customerName}, here's a special offer for you!`;
    
    const logId = `log-${campaignRef.id}-${Date.now()}-${i}`;

    const logEntry: CommunicationLogEntry = {
      logId,
      campaignId: campaignRef.id,
      customerId,
      customerName,
      message,
      status: 'Pending', 
      timestamp: new Date().toISOString(),
    };
    MOCK_COMMUNICATION_LOGS.push(logEntry);

    const promise = (async () => {
      try {
        await new Promise(r => setTimeout(r, Math.random() * 150 + 50)); 
        const isSuccess = Math.random() < 0.9; 
        const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
        // Call deliveryReceiptAction which updates the campaignRef (from MOCK_CAMPAIGNS)
        await deliveryReceiptAction(logId, deliveryStatus); 
      } catch (error) {
        console.error(`[startCampaignProcessingAction] Error processing message for logId ${logId}:`, error);
        await deliveryReceiptAction(logId, 'Failed');
      }
    })();
    processingPromises.push(promise);
  }

  Promise.allSettled(processingPromises).then(() => {
    // The final status is set by deliveryReceiptAction when all messages are processed.
    console.log(`[startCampaignProcessingAction] All simulated messages for campaign "${campaignRef!.name}" (ID: ${campaignRef!.id}) dispatched for processing.`);
  }).catch(error => {
    console.error(`[startCampaignProcessingAction] Unexpected error in Promise.allSettled for campaign "${campaignRef!.name}" (ID: ${campaignRef!.id}):`, error);
  });

  console.log(`[startCampaignProcessingAction] Campaign "${campaignRef.name}" processing initiated. ${campaignRef.audienceSize} messages queued.`);
}


export async function generateCampaignMessagesAction(
  input: GenerateCampaignMessagesInput
): Promise<GenerateCampaignMessagesOutput> {
  try {
    const result = await generateCampaignMessages(input);
    return result;
  } catch (error) {
    console.error("Error in generateCampaignMessagesAction:", error);
    return []; 
  }
}
