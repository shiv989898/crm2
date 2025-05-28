
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

// Diagnostic log to check if db instance is available
if (!db) {
  console.error("[CampaignActions] CRITICAL: Firestore 'db' instance is NOT initialized in @/config/firebase.ts. Firestore operations will fail.");
} else {
  console.log("[CampaignActions] Firestore 'db' instance appears to be initialized.");
}

export async function getCampaignsAction(): Promise<Campaign[]> {
  console.log(`[getCampaignsAction] ENTERED. Fetching from Firestore. Timestamp: ${new Date().toISOString()}`);
  if (!db) {
    console.error("[getCampaignsAction] Firestore not initialized. Cannot fetch campaigns.");
    return [];
  }
  try {
    const campaignsQuery = query(collection(db, CAMPAIGNS_COLLECTION), orderBy("createdAt", "desc"));
    console.log("[getCampaignsAction] Executing query to fetch campaigns...");
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
    console.error("[deliveryReceiptAction] Firestore not initialized. Cannot process delivery receipt.");
    return;
  }

  const logDocRef = doc(db, COMMUNICATION_LOGS_COLLECTION, logId);

  try {
    console.log(`[deliveryReceiptAction] Attempting to read log entry: ${logId}`);
    const logDocSnap = await getDoc(logDocRef);
    if (!logDocSnap.exists()) {
      console.error(`[deliveryReceiptAction] Log entry ${logId} not found in Firestore.`);
      return;
    }
    console.log(`[deliveryReceiptAction] Log entry ${logId} found. Attempting to update status to ${deliveryStatus}.`);

    const logEntryData = logDocSnap.data() as CommunicationLogEntry;
    await updateDoc(logDocRef, {
      status: deliveryStatus,
      timestamp: new Date().toISOString(),
    });
    console.log(`[deliveryReceiptAction] Log entry ${logId} status updated successfully.`);

    const campaignId = logEntryData.campaignId;
    if (!campaignId) {
      console.error(`[deliveryReceiptAction] Campaign ID missing in log entry ${logId}. Cannot update campaign stats.`);
      return;
    }
    const campaignDocRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    console.log(`[deliveryReceiptAction] Attempting to run transaction to update campaign: ${campaignId}`);

    // Transaction to safely update campaign counts
    await runTransaction(db, async (transaction) => {
      console.log(`[deliveryReceiptAction] Inside transaction for campaign: ${campaignId}. Attempting to get campaign snapshot.`);
      const campaignDocSnap = await transaction.get(campaignDocRef);
      if (!campaignDocSnap.exists()) {
        console.error(`[deliveryReceiptAction] Campaign ${campaignId} for log ${logId} not found in Firestore during transaction.`);
        throw new Error(`Campaign ${campaignId} not found`);
      }
      console.log(`[deliveryReceiptAction] Campaign ${campaignId} snapshot retrieved in transaction.`);

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
        console.log(`[deliveryReceiptAction] Campaign ${campaignId} final status determined: ${newStatus}`);
      } else if (campaignData.status !== 'Processing') {
        newStatus = 'Processing';
         console.log(`[deliveryReceiptAction] Campaign ${campaignId} status set to Processing as not all messages processed yet.`);
      }
      
      console.log(`[deliveryReceiptAction] Attempting to update campaign ${campaignId} in transaction with counts: S:${newSentCount}, F:${newFailedCount}, P:${newProcessedCount}, Status:${newStatus}`);
      transaction.update(campaignDocRef, {
        sentCount: newSentCount,
        failedCount: newFailedCount,
        processedCount: newProcessedCount,
        status: newStatus,
      });
    });
    console.log(`[deliveryReceiptAction] Transaction for campaign ${campaignId} completed successfully.`);

  } catch (error) {
    console.error(`[deliveryReceiptAction] Error processing delivery receipt for log ${logId}:`, error);
    // Log the full error object for more details
    console.error("[deliveryReceiptAction] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
}

export async function startCampaignProcessingAction(campaignToProcess: Omit<Campaign, 'id'>): Promise<string | null> {
  console.log(`[startCampaignProcessingAction] Received campaign: { name: "${campaignToProcess.name}", audienceSize: ${campaignToProcess.audienceSize} }`);
   if (!db) {
    console.error("[startCampaignProcessingAction] Firestore 'db' instance is NOT initialized. Campaign processing aborted.");
    return null;
  }
  console.log("[startCampaignProcessingAction] Firestore 'db' instance seems available.");

  let campaignId: string | null = null;

  try {
    // 1. Add the new campaign to Firestore
    const campaignDataWithInitialStatus: Omit<Campaign, 'id'> = {
      ...campaignToProcess,
      status: "Pending", // Initial status before processing
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(), 
    };
    console.log(`[startCampaignProcessingAction] Attempting to ADD campaign "${campaignToProcess.name}" to Firestore collection '${CAMPAIGNS_COLLECTION}'. Data:`, JSON.stringify(campaignDataWithInitialStatus));
    const campaignDocRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaignDataWithInitialStatus);
    campaignId = campaignDocRef.id;
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) ADDED to Firestore successfully.`);

    // 2. Update status to "Processing"
    console.log(`[startCampaignProcessingAction] Attempting to UPDATE campaign "${campaignToProcess.name}" (ID: ${campaignId}) status to 'Processing' in Firestore.`);
    await updateDoc(campaignDocRef, { status: 'Processing' });
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) status changed to 'Processing' in Firestore successfully.`);
    
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
      
      const logEntry: Omit<CommunicationLogEntry, 'logId'> = { 
        campaignId: campaignId, // Use the Firestore generated campaignId
        customerId,
        customerName,
        message,
        status: 'Pending', 
        timestamp: new Date().toISOString(),
      };
      
      const promise = (async () => {
        let firestoreLogId: string | null = null;
        try {
          console.log(`[startCampaignProcessingAction] For campaign ${campaignId}, customer ${i+1}/${campaignToProcess.audienceSize}: Attempting to ADD log entry to Firestore. Data:`, JSON.stringify(logEntry));
          const logDocRef = await addDoc(collection(db, COMMUNICATION_LOGS_COLLECTION), logEntry);
          firestoreLogId = logDocRef.id;
          console.log(`[startCampaignProcessingAction] Log entry (ID: ${firestoreLogId}) for customer ${customerId} ADDED to Firestore successfully.`);

          // Simulate processing delay
          await new Promise(r => setTimeout(r, Math.random() * 150 + 50)); 
          const isSuccess = Math.random() < 0.9; 
          const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
          console.log(`[startCampaignProcessingAction] Simulated delivery for log ${firestoreLogId}: ${deliveryStatus}. Calling deliveryReceiptAction.`);
          await deliveryReceiptAction(firestoreLogId, deliveryStatus); 
        } catch (error) {
          console.error(`[startCampaignProcessingAction] Error processing message for customer ${customerId} (Log ID: ${firestoreLogId || 'N/A'}) in campaign ${campaignId}:`, error);
          // Log the full error object
          console.error("[startCampaignProcessingAction] Full error object during message processing loop:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

          // If log creation itself failed, we can't call deliveryReceiptAction.
          // If log creation succeeded but delivery or subsequent receipt action failed, it's handled within deliveryReceiptAction.
          // We might want to update the campaign's failedCount here directly if log creation itself fails for a customer,
          // but for now, the focus is on getting the initial campaign/log writes to succeed.
        }
      })();
      processingPromises.push(promise);
    }

    Promise.allSettled(processingPromises).then(() => {
      console.log(`[startCampaignProcessingAction] All simulated messages for campaign "${campaignToProcess.name}" (ID: ${campaignId}) dispatched for processing.`);
    }).catch(error => {
      console.error(`[startCampaignProcessingAction] Unexpected error in Promise.allSettled for campaign "${campaignToProcess.name}" (ID: ${campaignId}):`, error);
    });

    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" processing initiated. ${campaignToProcess.audienceSize} messages queued.`);
    return campaignId; 

  } catch (error) {
    console.error(`[startCampaignProcessingAction] Error processing campaign (ID: ${campaignId || 'N/A before creation'}):`, error);
    // Log the full error object
    console.error("[startCampaignProcessingAction] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return null; // Ensure null is returned on any top-level error
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

    