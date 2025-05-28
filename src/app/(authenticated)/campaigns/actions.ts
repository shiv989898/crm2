
"use server";

import { MOCK_CAMPAIGNS, MOCK_COMMUNICATION_LOGS } from '@/lib/mockData';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';
import { generateCampaignMessages, type GenerateCampaignMessagesInput, type GenerateCampaignMessagesOutput } from '@/ai/flows/generate-campaign-messages-flow';

export async function getCampaignsAction(): Promise<Campaign[]> {
  console.log(`[getCampaignsAction] Called. Current MOCK_CAMPAIGNS length: ${MOCK_CAMPAIGNS.length}`);
  console.log(`[getCampaignsAction] Campaigns (names):`, MOCK_CAMPAIGNS.map(c => c.name));
  // Return a copy and sort to avoid unintended mutations and ensure consistent order
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

  if (deliveryStatus === 'Sent') {
    campaign.sentCount = (campaign.sentCount || 0) + 1;
  } else {
    campaign.failedCount = (campaign.failedCount || 0) + 1;
  }
  campaign.processedCount = (campaign.processedCount || 0) + 1;

  // Check if all messages for the campaign have been processed
  if (campaign.processedCount === campaign.audienceSize) {
    if (campaign.failedCount === 0 && campaign.sentCount === campaign.audienceSize) {
      campaign.status = 'Sent';
    } else if (campaign.sentCount === 0) { // Simplified: if nothing sent, it's failed or completed with only failures
      campaign.status = 'Failed';
    } else {
      campaign.status = 'CompletedWithFailures';
    }
    console.log(`[deliveryReceiptAction] Campaign ${campaign.id} final status updated: ${campaign.status}`);
  } else if (campaign.status !== 'Processing') {
    // If processing has started but not finished, ensure status is Processing
    // This might be redundant if startCampaignProcessingAction sets it correctly
    campaign.status = 'Processing';
  }
}

export async function startCampaignProcessingAction(campaignToProcess: Campaign) {
  console.log(`[startCampaignProcessingAction] Received campaign: { id: ${campaignToProcess.id}, name: "${campaignToProcess.name}", status: "${campaignToProcess.status}" }`);

  let campaignRef = MOCK_CAMPAIGNS.find(c => c.id === campaignToProcess.id);

  if (!campaignRef) {
    // Add the new campaign object to the MOCK_CAMPAIGNS array.
    // Ensure all properties from campaignToProcess are copied.
    // The campaignToProcess should already have status: "Pending".
    MOCK_CAMPAIGNS.unshift({ ...campaignToProcess });
    campaignRef = MOCK_CAMPAIGNS.find(c => c.id === campaignToProcess.id); // Get the reference from the array
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" ADDED to MOCK_CAMPAIGNS. New length: ${MOCK_CAMPAIGNS.length}`);
  } else {
    // If campaign exists, update it with details from campaignToProcess
    // This might be for re-processing or if an ID collision occurred (unlikely with Date.now() in ID)
    Object.assign(campaignRef, campaignToProcess);
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" UPDATED in MOCK_CAMPAIGNS.`);
  }
  
  // Log the current state of MOCK_CAMPAIGNS after add/update
  console.log(`[startCampaignProcessingAction] MOCK_CAMPAIGNS (names) after add/update:`, MOCK_CAMPAIGNS.map(c => c.name));

  if (!campaignRef) {
    // This state should be very unlikely if the above logic is correct
    console.error(`[startCampaignProcessingAction] CRITICAL ERROR: Campaign "${campaignToProcess.name}" not found in MOCK_CAMPAIGNS after attempt to add/update.`);
    throw new Error(`Campaign ${campaignToProcess.id} could not be prepared for processing.`);
  }
  
  // Work with campaignRef which is guaranteed to be the object from the MOCK_CAMPAIGNS array
  // Initialize/reset counts for processing
  campaignRef.status = "Pending"; // Ensure status is Pending before short delay
  campaignRef.processedCount = 0;
  campaignRef.sentCount = 0;
  campaignRef.failedCount = 0;
  console.log(`[startCampaignProcessingAction] Campaign "${campaignRef.name}" (${campaignRef.id}) initialized. Target audience size: ${campaignRef.audienceSize}. Status: ${campaignRef.status}`);

  // Short delay to allow UI to potentially show "Pending" before "Processing"
  await new Promise(r => setTimeout(r, 100)); // Increased delay slightly for observation

  campaignRef.status = 'Processing';
  console.log(`[startCampaignProcessingAction] Campaign "${campaignRef.name}" (${campaignRef.id}) status changed to Processing.`);

  // Clear previous logs for this campaign if re-processing
  const existingLogIndexes = MOCK_COMMUNICATION_LOGS.reduce((acc, log, index) => {
    if (log.campaignId === campaignRef!.id) { // Use campaignRef
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
        await deliveryReceiptAction(logId, deliveryStatus);
      } catch (error) {
        console.error(`[startCampaignProcessingAction] Error processing message for logId ${logId}:`, error);
        await deliveryReceiptAction(logId, 'Failed');
      }
    })();
    processingPromises.push(promise);
  }

  // No need to update campaign status here, deliveryReceiptAction handles final status
  Promise.allSettled(processingPromises).then(() => {
    console.log(`[startCampaignProcessingAction] All simulated messages for campaign "${campaignRef.name}" (${campaignRef.id}) dispatched for processing.`);
  }).catch(error => {
    console.error(`[startCampaignProcessingAction] Unexpected error in Promise.allSettled for campaign "${campaignRef.name}" (${campaignRef.id}):`, error);
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

