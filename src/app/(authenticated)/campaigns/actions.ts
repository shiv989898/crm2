
"use server";

import { MOCK_CAMPAIGNS, MOCK_COMMUNICATION_LOGS } from '@/lib/mockData';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';
import { generateCampaignMessages, type GenerateCampaignMessagesInput, type GenerateCampaignMessagesOutput } from '@/ai/flows/generate-campaign-messages-flow';

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
    if (campaign.failedCount === 0) {
      campaign.status = 'Sent';
    } else if (campaign.failedCount === campaign.audienceSize) {
      campaign.status = 'Failed';
    } else {
      campaign.status = 'CompletedWithFailures';
    }
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
    MOCK_CAMPAIGNS.unshift(campaignToProcess); // Add the received campaign object
    campaign = campaignToProcess; // Work with the object we just added
  } else {
    Object.assign(campaign, campaignToProcess);
  }

  campaign.status = "Pending";
  campaign.processedCount = 0;
  campaign.sentCount = 0;
  campaign.failedCount = 0;

  if (campaign.status === 'Processing' || campaign.status === 'Sent' || campaign.status === 'Failed' || campaign.status === 'CompletedWithFailures') {
    console.warn(`Campaign ${campaign.id} was already processing or has completed. Current status: ${campaign.status}. Re-initializing processing.`);
  }

  campaign.status = 'Processing';

  // Clear previous logs for this campaign if re-processing
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
    // A more robust templating engine would be used in a real app for more placeholders

    const logId = `log-${campaign.id}-${Date.now()}-${i}`;

    const logEntry: CommunicationLogEntry = {
      logId,
      campaignId: campaign.id,
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
        console.error(`Error processing message for logId ${logId}:`, error);
        await deliveryReceiptAction(logId, 'Failed');
      }
    })();
    processingPromises.push(promise);
  }

  Promise.allSettled(processingPromises).then(results => {
    console.log(`All simulated messages for campaign ${campaign!.id} have been dispatched for processing.`);
    const finalCampaignState = MOCK_CAMPAIGNS.find(c => c.id === campaign!.id);
    if (finalCampaignState && finalCampaignState.processedCount === finalCampaignState.audienceSize && finalCampaignState.status === 'Processing') {
        if (finalCampaignState.failedCount === 0) {
            finalCampaignState.status = 'Sent';
        } else if (finalCampaignState.failedCount === finalCampaignState.audienceSize) {
            finalCampaignState.status = 'Failed';
        } else {
            finalCampaignState.status = 'CompletedWithFailures';
        }
        console.log(`Campaign ${campaign!.id} final status updated after allSettled: ${finalCampaignState.status}`);
    }
  }).catch(error => {
    console.error(`Unexpected error in Promise.allSettled for campaign ${campaign!.id}:`, error);
  });

  console.log(`Campaign ${campaign.id} processing started. ${campaign.audienceSize} messages queued.`);
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
