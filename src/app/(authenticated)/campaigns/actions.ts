
"use server";

import { MOCK_CAMPAIGNS, MOCK_COMMUNICATION_LOGS } from '@/lib/mockData';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';

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

export async function startCampaignProcessingAction(campaignId: string) {
  const campaign = MOCK_CAMPAIGNS.find(c => c.id === campaignId);
  if (!campaign) {
    console.error(`Campaign ${campaignId} not found for processing.`);
    throw new Error(`Campaign ${campaignId} not found.`);
  }

  if (campaign.status === 'Processing' || campaign.status === 'Sent' || campaign.status === 'Failed' || campaign.status === 'CompletedWithFailures') {
    console.warn(`Campaign ${campaignId} is already processing or has completed. Current status: ${campaign.status}`);
    // Potentially return early or re-evaluate if re-processing is allowed/meaningful
    // For now, let's allow it to reset and re-process for demo purposes if it was e.g. Draft/Pending
  }
  
  campaign.status = 'Processing';
  campaign.processedCount = 0;
  campaign.sentCount = 0;
  campaign.failedCount = 0;

  // Clear previous logs for this campaign if re-processing
  const existingLogIndexes = MOCK_COMMUNICATION_LOGS.reduce((acc, log, index) => {
    if (log.campaignId === campaignId) {
      acc.push(index);
    }
    return acc;
  }, [] as number[]);
  for (let i = existingLogIndexes.length - 1; i >= 0; i--) {
    MOCK_COMMUNICATION_LOGS.splice(existingLogIndexes[i], 1);
  }


  const processingPromises: Promise<void>[] = [];

  for (let i = 0; i < campaign.audienceSize; i++) {
    const customerId = `cust-${campaign.id}-${Date.now()}-${i}`; // Ensure unique customer ID
    // Generate diverse mock names
    const firstNames = ["Alex", "Jamie", "Chris", "Jordan", "Taylor", "Morgan", "Casey", "Riley"];
    const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const customerName = `${firstNames[i % firstNames.length]} ${lastInitials[i % lastInitials.length]}.`;
    
    const message = `Hi ${customerName}, here's 10% off on your next order.`;
    const logId = `log-${campaign.id}-${Date.now()}-${i}`; // Ensure unique log ID

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

    // Simulate vendor processing and callback
    const promise = (async () => { // IIFE to make it async immediately
      try {
        await new Promise(r => setTimeout(r, Math.random() * 150 + 50)); // Simulate 50-200ms delay for vendor
        
        const isSuccess = Math.random() < 0.9; // 90% success
        const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
        
        // This is the "vendor hitting our delivery receipt API"
        await deliveryReceiptAction(logId, deliveryStatus); 
      } catch (error) {
        console.error(`Error processing message for logId ${logId}:`, error);
        // Fallback to ensure the log entry is marked as failed
        await deliveryReceiptAction(logId, 'Failed');
      }
    })();
    processingPromises.push(promise);
  }

  // Await all individual message processing simulations to complete
  // This ensures that by the time startCampaignProcessingAction resolves (if awaited by client),
  // all deliveryReceiptAction calls have been made.
  // However, the UI will show "Processing" immediately.
  Promise.allSettled(processingPromises).then(results => {
    console.log(`All simulated messages for campaign ${campaignId} have been dispatched for processing.`);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Processing for message index ${index} in campaign ${campaignId} failed:`, result.reason);
      }
    });
    // Final status check for the campaign, in case some deliveryReceiptActions didn't run or failed.
    // This is a safety net, primary logic is in deliveryReceiptAction.
    const finalCampaignState = MOCK_CAMPAIGNS.find(c => c.id === campaignId);
    if (finalCampaignState && finalCampaignState.processedCount === finalCampaignState.audienceSize && finalCampaignState.status === 'Processing') {
        if (finalCampaignState.failedCount === 0) {
            finalCampaignState.status = 'Sent';
        } else if (finalCampaignState.failedCount === finalCampaignState.audienceSize) {
            finalCampaignState.status = 'Failed';
        } else {
            finalCampaignState.status = 'CompletedWithFailures';
        }
        console.log(`Campaign ${campaignId} final status updated after allSettled: ${finalCampaignState.status}`);
    }
  }).catch(error => {
    // This catch is for Promise.allSettled itself, which shouldn't happen.
    console.error(`Unexpected error in Promise.allSettled for campaign ${campaignId}:`, error);
  });

  // Returns quickly, letting the processing happen in the "background"
  console.log(`Campaign ${campaignId} processing started. ${campaign.audienceSize} messages queued.`);
}
