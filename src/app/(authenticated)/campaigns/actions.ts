
"use server";

import { db } from '@/config/firebase'; // Import Firestore instance
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  Timestamp, // For potential future use with native Firestore timestamps
  runTransaction,
  getDoc,
  increment
} from 'firebase/firestore';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';
import { generateCampaignMessages, type GenerateCampaignMessagesInput, type GenerateCampaignMessagesOutput } from '@/ai/flows/generate-campaign-messages-flow';

const CAMPAIGNS_COLLECTION = 'campaigns';
const COMMUNICATION_LOGS_COLLECTION = 'communicationLogs';

export async function getCampaignsAction(): Promise<Campaign[]> {
  console.log(`[getCampaignsAction] ENTERED. Fetching from Firestore. Timestamp: ${new Date().toISOString()}`);
  if (!db) {
    console.error("[getCampaignsAction] Firestore not initialized.");
    return [];
  }
  try {
    const campaignsQuery = query(collection(db, CAMPAIGNS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(campaignsQuery);
    const campaigns: Campaign[] = [];
    querySnapshot.forEach((doc) => {
      campaigns.push({ id: doc.id, ...doc.data() } as Campaign);
    });
    console.log(`[getCampaignsAction] Fetched ${campaigns.length} campaigns from Firestore.`);
    return campaigns;
  } catch (error) {
    console.error("[getCampaignsAction] Error fetching campaigns from Firestore:", error);
    return [];
  }
}

export async function deliveryReceiptAction(logId: string, deliveryStatus: 'Sent' | 'Failed') {
  console.log(`[deliveryReceiptAction] Log ID: ${logId}, Status: ${deliveryStatus}`);
  if (!db) {
    console.error("[deliveryReceiptAction] Firestore not initialized.");
    return;
  }

  const logDocRef = doc(db, COMMUNICATION_LOGS_COLLECTION, logId);

  try {
    const logDocSnap = await getDoc(logDocRef);
    if (!logDocSnap.exists()) {
      console.error(`[deliveryReceiptAction] Log entry ${logId} not found in Firestore.`);
      return;
    }

    const logEntryData = logDocSnap.data() as CommunicationLogEntry;
    await updateDoc(logDocRef, {
      status: deliveryStatus,
      timestamp: new Date().toISOString(),
    });

    const campaignId = logEntryData.campaignId;
    if (!campaignId) {
      console.error(`[deliveryReceiptAction] Campaign ID missing in log entry ${logId}.`);
      return;
    }
    const campaignDocRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);

    // Transaction to safely update campaign counts
    await runTransaction(db, async (transaction) => {
      const campaignDocSnap = await transaction.get(campaignDocRef);
      if (!campaignDocSnap.exists()) {
        console.error(`[deliveryReceiptAction] Campaign ${campaignId} for log ${logId} not found in Firestore.`);
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const campaignData = campaignDocSnap.data() as Campaign;
      let newSentCount = campaignData.sentCount || 0;
      let newFailedCount = campaignData.failedCount || 0;
      let newProcessedCount = campaignData.processedCount || 0;

      if (deliveryStatus === 'Sent') {
        newSentCount++;
      } else {
        newFailedCount++;
      }
      newProcessedCount++;

      let newStatus = campaignData.status;
      if (newProcessedCount === campaignData.audienceSize) {
        if (newFailedCount === 0 && newSentCount === campaignData.audienceSize) {
          newStatus = 'Sent';
        } else if (newSentCount === 0 && newFailedCount === campaignData.audienceSize) {
          newStatus = 'Failed';
        } else {
          newStatus = 'CompletedWithFailures';
        }
        console.log(`[deliveryReceiptAction] Campaign ${campaignId} final status updated to: ${newStatus}`);
      } else if (campaignData.status !== 'Processing') {
         // This might be redundant if initial status is set correctly to Processing
         // but can act as a safeguard
        newStatus = 'Processing';
      }
      
      transaction.update(campaignDocRef, {
        sentCount: newSentCount,
        failedCount: newFailedCount,
        processedCount: newProcessedCount,
        status: newStatus,
      });
    });

  } catch (error) {
    console.error(`[deliveryReceiptAction] Error updating Firestore for log ${logId}:`, error);
  }
}

export async function startCampaignProcessingAction(campaignToProcess: Omit<Campaign, 'id'>): Promise<string | null> {
  console.log(`[startCampaignProcessingAction] Received campaign: { name: "${campaignToProcess.name}", status: "${campaignToProcess.status}" }`);
   if (!db) {
    console.error("[startCampaignProcessingAction] Firestore not initialized.");
    return null;
  }

  try {
    // 1. Add the new campaign to Firestore
    const campaignDataWithInitialStatus: Omit<Campaign, 'id'> = {
      ...campaignToProcess,
      status: "Pending", // Initial status before processing
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(), // Ensure createdAt is set
    };
    const campaignDocRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaignDataWithInitialStatus);
    const campaignId = campaignDocRef.id;
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) ADDED to Firestore.`);

    // 2. Update status to "Processing"
    await updateDoc(campaignDocRef, { status: 'Processing' });
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) status changed to Processing in Firestore.`);
    
    // 3. Simulate message sending and log creation
    const processingPromises: Promise<void>[] = [];

    for (let i = 0; i < campaignToProcess.audienceSize; i++) {
      const customerId = `cust-${campaignId}-${Date.now()}-${i}`;
      const firstNames = ["Alex", "Jamie", "Chris", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Drew", "Skyler"];
      const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const customerName = `${firstNames[i % firstNames.length]} ${lastInitials[i % lastInitials.length]}.`;

      let message = campaignToProcess.messageTemplate 
        ? campaignToProcess.messageTemplate.replace(/\{\{customerName\}\}/gi, customerName) 
        : `Hi ${customerName}, here's a special offer for you!`;
      
      // Temporary logId for local use, Firestore will generate its own
      // const tempLogId = `log-${campaignId}-${Date.now()}-${i}`; 

      const logEntry: Omit<CommunicationLogEntry, 'logId'> = { // Omit logId as Firestore generates it
        campaignId: campaignId,
        customerId,
        customerName,
        message,
        status: 'Pending', 
        timestamp: new Date().toISOString(),
      };
      
      // Add log entry to Firestore and then simulate processing
      const promise = (async () => {
        try {
          const logDocRef = await addDoc(collection(db, COMMUNICATION_LOGS_COLLECTION), logEntry);
          const firestoreLogId = logDocRef.id;

          await new Promise(r => setTimeout(r, Math.random() * 150 + 50)); 
          const isSuccess = Math.random() < 0.9; 
          const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
          await deliveryReceiptAction(firestoreLogId, deliveryStatus); 
        } catch (error) {
          console.error(`[startCampaignProcessingAction] Error processing message for customer ${customerId} in campaign ${campaignId}:`, error);
          // If log creation failed, we can't call deliveryReceiptAction for it.
          // If log creation succeeded but delivery failed, deliveryReceiptAction handles it.
        }
      })();
      processingPromises.push(promise);
    }

    // Don't wait for all promises to resolve here in the server action
    // to allow the function to return faster to the client.
    // The updates will happen asynchronously.
    Promise.allSettled(processingPromises).then(() => {
      console.log(`[startCampaignProcessingAction] All simulated messages for campaign "${campaignToProcess.name}" (ID: ${campaignId}) dispatched for processing.`);
      // Final status is set by deliveryReceiptAction when all messages are processed.
    }).catch(error => {
      console.error(`[startCampaignProcessingAction] Unexpected error in Promise.allSettled for campaign "${campaignToProcess.name}" (ID: ${campaignId}):`, error);
    });

    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" processing initiated. ${campaignToProcess.audienceSize} messages queued.`);
    return campaignId; // Return the new campaign ID

  } catch (error) {
    console.error("[startCampaignProcessingAction] Error processing campaign:", error);
    return null;
  }
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
