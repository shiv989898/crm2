
"use server";

import { MOCK_CAMPAIGNS, MOCK_COMMUNICATION_LOGS } from '@/lib/mockData';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';
import { generateCampaignMessages, type GenerateCampaignMessagesInput, type GenerateCampaignMessagesOutput } from '@/ai/flows/generate-campaign-messages-flow';

export async function getCampaignsAction(): Promise<Campaign[]> {
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
    console.error(`Log entry ${logId} not found.`);
    return;
  }
  logEntry.status = deliveryStatus;
  logEntry.timestamp = new Date().toISOString(); // Update timestamp on final status

  const campaign = MOCK_CAMPAIGNS.find(c => c.id === logEntry.campaignId);
  if (!campaign) {
    console.error(`Campaign ${logEntry.campaignId} for log ${logId} not found.`);
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
    } else if (campaign.failedCount === campaign.audienceSize && campaign.sentCount === 0) {
      campaign.status = 'Failed';
    } else {
      campaign.status = 'CompletedWithFailures';
    }
    console.log(`Campaign ${campaign.id} final status updated by deliveryReceiptAction: ${campaign.status}`);
  } else if (campaign.status !== 'Processing') {
    // If processing has started but not finished, ensure status is Processing
    // This can happen if it was Pending before
    campaign.status = 'Processing';
  }
  // If not all processed and status is already 'Processing', it remains 'Processing'
}

export async function startCampaignProcessingAction(campaignToProcess: Campaign) {
  // Ensure the campaign is in the server-side MOCK_CAMPAIGNS array.
  let campaign = MOCK_CAMPAIGNS.find(c => c.id === campaignToProcess.id);

  if (!campaign) {
    MOCK_CAMPAIGNS.unshift({...campaignToProcess}); // Add a copy of the received campaign object
    campaign = MOCK_CAMPAIGNS.find(c => c.id === campaignToProcess.id)!; // Work with the object we just added
  } else {
    // Update existing campaign with potentially new details from campaignToProcess (e.g., if re-processing)
    Object.assign(campaign, campaignToProcess);
  }

  // Initialize/reset counts for processing
  campaign.status = "Pending"; // Set initial status
  campaign.processedCount = 0;
  campaign.sentCount = 0;
  campaign.failedCount = 0;

  // Short delay to allow UI to potentially show "Pending" before "Processing"
  await new Promise(r => setTimeout(r, 50)); 

  campaign.status = 'Processing';
  console.log(`Campaign ${campaign.id} status set to Processing.`);

  // Clear previous logs for this campaign if re-processing (optional, depends on desired behavior)
  const existingLogIndexes = MOCK_COMMUNICATION_LOGS.reduce((acc, log, index) => {
    if (log.campaignId === campaign!.id) {
      acc.push(index);
    }
    return acc;
  }, [] as number[]);
  for (let i = existingLogIndexes.length - 1; i >= 0; i--) {
    MOCK_COMMUNICATION_LOGS.splice(existingLogIndexes[i], 1);
  }

  const processingPromises: Promise<void>[] = [];

  for (let i = 0; i < campaign.audienceSize; i++) {
    const customerId = `cust-${campaign.id}-${Date.now()}-${i}`;
    const firstNames = ["Alex", "Jamie", "Chris", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Drew", "Skyler"];
    const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const customerName = `${firstNames[i % firstNames.length]} ${lastInitials[i % lastInitials.length]}.`;

    let message = campaign.messageTemplate ? campaign.messageTemplate.replace(/\{\{customerName\}\}/gi, customerName) : `Hi ${customerName}, here's a special offer for you!`;
    
    const logId = `log-${campaign.id}-${Date.now()}-${i}`;

    const logEntry: CommunicationLogEntry = {
      logId,
      campaignId: campaign.id,
      customerId,
      customerName,
      message,
      status: 'Pending', // Initial log status
      timestamp: new Date().toISOString(),
    };
    MOCK_COMMUNICATION_LOGS.push(logEntry);

    const promise = (async () => {
      try {
        // Simulate vendor API call delay
        await new Promise(r => setTimeout(r, Math.random() * 150 + 50)); 
        const isSuccess = Math.random() < 0.9; // 90% success rate
        const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
        // Simulate vendor hitting our delivery receipt API
        await deliveryReceiptAction(logId, deliveryStatus);
      } catch (error) {
        console.error(`Error processing message for logId ${logId}:`, error);
        // Ensure delivery receipt is called even on unexpected error during simulation
        await deliveryReceiptAction(logId, 'Failed');
      }
    })();
    processingPromises.push(promise);
  }

  // The actual status update to "Sent", "Failed", or "CompletedWithFailures"
  // is solely handled by deliveryReceiptAction as each message is processed.
  Promise.allSettled(processingPromises).then(results => {
    console.log(`All simulated messages for campaign ${campaign!.id} have been dispatched for processing and their simulated vendor calls initiated.`);
  }).catch(error => {
    console.error(`Unexpected error in Promise.allSettled for campaign ${campaign!.id}:`, error);
  });

  console.log(`Campaign ${campaign.id} processing initiated. ${campaign.audienceSize} messages queued.`);
}


export async function generateCampaignMessagesAction(
  input: GenerateCampaignMessagesInput
): Promise<GenerateCampaignMessagesOutput> {
  try {
    const result = await generateCampaignMessages(input);
    return result;
  } catch (error) {
    console.error("Error in generateCampaignMessagesAction:", error);
    return []; // Return empty array on error
  }
}
