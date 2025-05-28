
"use server";

import { config } from 'dotenv'; // Explicitly load dotenv at the top of the server action file
config();
console.log('[CampaignActions] dotenv config() called. Checking GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Loaded' : 'NOT Loaded');
console.log('[CampaignActions] Checking NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Loaded' : 'NOT Loaded');


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
  increment // Keep increment if you plan to use atomic counters
} from 'firebase/firestore';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';
import { generateCampaignMessages, type GenerateCampaignMessagesInput, type GenerateCampaignMessagesOutput } from '@/ai/flows/generate-campaign-messages-flow';

const CAMPAIGNS_COLLECTION = 'campaigns';
const COMMUNICATION_LOGS_COLLECTION = 'communicationLogs';

// Diagnostic log to check if db instance is available when the module loads
if (!db) {
  console.error(`[CampaignActions ModuleLoad] CRITICAL: Firestore 'db' instance is NOT initialized in @/config/firebase.ts. Firestore operations will fail. Timestamp: ${new Date().toISOString()}`);
} else {
  console.log(`[CampaignActions ModuleLoad] Firestore 'db' instance appears to be initialized. Timestamp: ${new Date().toISOString()}`);
}

export async function getCampaignsAction(): Promise<Campaign[]> {
  console.log(`[getCampaignsAction] ENTERED. Fetching from Firestore. Timestamp: ${new Date().toISOString()}`);
  if (!db) {
    console.error(`[getCampaignsAction] CRITICAL_FAILURE_POINT: Firestore 'db' instance is NULL. Cannot fetch campaigns. Timestamp: ${new Date().toISOString()}`);
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
    console.log(`[getCampaignsAction] Fetched ${campaigns.length} campaigns from Firestore. Campaign names: ${campaigns.map(c => c.name).join(', ')}`);
    return campaigns;
  } catch (error) {
    console.error(`[getCampaignsAction] Error fetching campaigns from Firestore. Timestamp: ${new Date().toISOString()}`, error);
    return [];
  }
}

export async function deliveryReceiptAction(logId: string, deliveryStatus: 'Sent' | 'Failed') {
  console.log(`[deliveryReceiptAction] ENTERED. Log ID: ${logId}, Status: ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
  if (!db) {
    console.error(`[deliveryReceiptAction] CRITICAL_FAILURE_POINT: Firestore 'db' instance is NULL. Cannot process delivery receipt. Timestamp: ${new Date().toISOString()}`);
    return;
  }

  const logDocRef = doc(db, COMMUNICATION_LOGS_COLLECTION, logId);

  try {
    console.log(`[deliveryReceiptAction] Attempting to read log entry: ${logId}. Timestamp: ${new Date().toISOString()}`);
    const logDocSnap = await getDoc(logDocRef);
    if (!logDocSnap.exists()) {
      console.error(`[deliveryReceiptAction] Log entry ${logId} not found in Firestore. Timestamp: ${new Date().toISOString()}`);
      return;
    }
    console.log(`[deliveryReceiptAction] Log entry ${logId} found. Current status: ${logDocSnap.data().status}. Attempting to update status to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);

    const logEntryData = logDocSnap.data() as CommunicationLogEntry;
    // Avoid re-processing if already processed
    if (logEntryData.status === 'Sent' || logEntryData.status === 'Failed') {
        console.warn(`[deliveryReceiptAction] Log entry ${logId} already processed with status ${logEntryData.status}. Skipping update to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
        // Still need to ensure campaign counts are accurate if this is a retry
    } else {
        await updateDoc(logDocRef, {
        status: deliveryStatus,
        timestamp: new Date().toISOString(),
        });
        console.log(`[deliveryReceiptAction] Log entry ${logId} status updated to ${deliveryStatus} successfully. Timestamp: ${new Date().toISOString()}`);
    }


    const campaignId = logEntryData.campaignId;
    if (!campaignId) {
      console.error(`[deliveryReceiptAction] Campaign ID missing in log entry ${logId}. Cannot update campaign stats. Timestamp: ${new Date().toISOString()}`);
      return;
    }
    const campaignDocRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    console.log(`[deliveryReceiptAction] Attempting to run transaction to update campaign: ${campaignId}. Timestamp: ${new Date().toISOString()}`);

    await runTransaction(db, async (transaction) => {
      console.log(`[deliveryReceiptAction] Inside transaction for campaign: ${campaignId}. Attempting to get campaign snapshot. Timestamp: ${new Date().toISOString()}`);
      const campaignDocSnap = await transaction.get(campaignDocRef);
      if (!campaignDocSnap.exists()) {
        console.error(`[deliveryReceiptAction] Campaign ${campaignId} for log ${logId} not found in Firestore during transaction. Timestamp: ${new Date().toISOString()}`);
        throw new Error(`Campaign ${campaignId} not found`);
      }
      console.log(`[deliveryReceiptAction] Campaign ${campaignId} snapshot retrieved in transaction. Status: ${campaignDocSnap.data().status}. Timestamp: ${new Date().toISOString()}`);

      const campaignData = campaignDocSnap.data() as Campaign;
      
      // Only increment counts if the log entry was actually updated (not a duplicate receipt for an already processed item)
      // This check needs to be refined if we re-process or allow status changes.
      // For now, assume we increment if we *would have* updated the log or if it's its first time.
      // A more robust way is to fetch the logEntry again *within* the transaction if necessary,
      // or ensure that `deliveryReceiptAction` is only called once per successful log write.
      // The current structure might over-increment if `deliveryReceiptAction` is called multiple times for the same logId
      // after the log status has already been set to Sent/Failed.
      // Let's assume for simplicity that the simulation calls it once per log.

      let newSentCount = campaignData.sentCount || 0;
      let newFailedCount = campaignData.failedCount || 0;
      let newProcessedCount = (campaignData.processedCount || 0); // Initialize with current

      // This logic is simplified: it assumes this receipt means one more item is processed.
      // More complex logic would be needed if deliveryReceiptAction could be called multiple times for the same log entry
      // without it having been marked "Pending" before this call.
      // The check on logEntryData.status earlier helps a bit.
      // If we are certain deliveryReceiptAction is called for a newly "Pending" log:
      if (logEntryData.status === 'Pending' || logEntryData.status !== deliveryStatus) { // If it was pending or status is changing
        if (deliveryStatus === 'Sent') {
          newSentCount++;
        } else {
          newFailedCount++;
        }
        newProcessedCount++; // Increment processed count only if it's a new "final" status
      }


      let newStatus = campaignData.status;
      if (newProcessedCount >= campaignData.audienceSize) { // Use >= for safety
        if (newFailedCount === 0 && newSentCount === campaignData.audienceSize) {
          newStatus = 'Sent';
        } else if (newSentCount === 0 && newFailedCount === campaignData.audienceSize) {
          newStatus = 'Failed';
        } else {
          newStatus = 'CompletedWithFailures';
        }
        console.log(`[deliveryReceiptAction] Campaign ${campaignId} final status determined: ${newStatus}. Processed: ${newProcessedCount}/${campaignData.audienceSize}. Timestamp: ${new Date().toISOString()}`);
      } else if (campaignData.status !== 'Processing' && newProcessedCount > 0) { // If some are processed, it must be 'Processing'
        newStatus = 'Processing';
         console.log(`[deliveryReceiptAction] Campaign ${campaignId} status set to Processing as not all messages processed yet. Processed: ${newProcessedCount}/${campaignData.audienceSize}. Timestamp: ${new Date().toISOString()}`);
      }
      
      console.log(`[deliveryReceiptAction] Attempting to update campaign ${campaignId} in transaction with counts: S:${newSentCount}, F:${newFailedCount}, P:${newProcessedCount}, Status:${newStatus}. Timestamp: ${new Date().toISOString()}`);
      transaction.update(campaignDocRef, {
        sentCount: newSentCount,
        failedCount: newFailedCount,
        processedCount: newProcessedCount,
        status: newStatus,
      });
    });
    console.log(`[deliveryReceiptAction] Transaction for campaign ${campaignId} completed successfully. Timestamp: ${new Date().toISOString()}`);

  } catch (error) {
    console.error(`[deliveryReceiptAction] Error processing delivery receipt for log ${logId}. Timestamp: ${new Date().toISOString()}`, error);
    console.error("[deliveryReceiptAction] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
}

export async function startCampaignProcessingAction(campaignToProcess: Omit<Campaign, 'id'>): Promise<string | null> {
  console.log(`[startCampaignProcessingAction] ENTERED. Received campaign: { name: "${campaignToProcess.name}", audienceSize: ${campaignToProcess.audienceSize} }. Timestamp: ${new Date().toISOString()}`);

  if (!db) {
    console.error(`[startCampaignProcessingAction] CRITICAL_FAILURE_POINT: Firestore 'db' instance is NULL or undefined. Aborting campaign processing. Ensure Firebase is correctly initialized in src/config/firebase.ts and .env variables are loaded. Timestamp: ${new Date().toISOString()}`);
    return null; 
  }
  console.log(`[startCampaignProcessingAction] Firestore 'db' instance appears to be available. Timestamp: ${new Date().toISOString()}`);

  let campaignId: string | null = null;

  try {
    const campaignDataWithInitialStatus: Omit<Campaign, 'id'> = {
      ...campaignToProcess,
      status: "Pending", 
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(), 
    };
    console.log(`[startCampaignProcessingAction] Attempting to ADD campaign "${campaignToProcess.name}" to Firestore collection '${CAMPAIGNS_COLLECTION}'. Data:`, JSON.stringify(campaignDataWithInitialStatus) + `. Timestamp: ${new Date().toISOString()}`);
    const campaignDocRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaignDataWithInitialStatus);
    campaignId = campaignDocRef.id;
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) ADDED to Firestore successfully. Timestamp: ${new Date().toISOString()}`);

    console.log(`[startCampaignProcessingAction] Attempting to UPDATE campaign "${campaignToProcess.name}" (ID: ${campaignId}) status to 'Processing' in Firestore. Timestamp: ${new Date().toISOString()}`);
    await updateDoc(campaignDocRef, { status: 'Processing' });
    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) status changed to 'Processing' in Firestore successfully. Timestamp: ${new Date().toISOString()}`);
    
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
        campaignId: campaignId,
        customerId,
        customerName,
        message,
        status: 'Pending', 
        timestamp: new Date().toISOString(),
      };
      
      const promise = (async () => {
        let firestoreLogId: string | null = null;
        try {
          console.log(`[startCampaignProcessingAction] For campaign ${campaignId}, customer ${i+1}/${campaignToProcess.audienceSize}: Attempting to ADD log entry to Firestore. Data:`, JSON.stringify(logEntry) + `. Timestamp: ${new Date().toISOString()}`);
          const logDocRef = await addDoc(collection(db, COMMUNICATION_LOGS_COLLECTION), logEntry);
          firestoreLogId = logDocRef.id;
          console.log(`[startCampaignProcessingAction] Log entry (ID: ${firestoreLogId}) for customer ${customerId} ADDED to Firestore successfully. Timestamp: ${new Date().toISOString()}`);

          await new Promise(r => setTimeout(r, Math.random() * 150 + 50)); 
          const isSuccess = Math.random() < 0.9; 
          const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
          console.log(`[startCampaignProcessingAction] Simulated delivery for log ${firestoreLogId}: ${deliveryStatus}. Calling deliveryReceiptAction. Timestamp: ${new Date().toISOString()}`);
          // IMPORTANT: DO NOT await deliveryReceiptAction here directly if you want all log creations to proceed in parallel.
          // However, for reliable sequential updates, awaiting is simpler for mock.
          // For true parallelism, `deliveryReceiptAction` should be robust enough for concurrent calls
          // or these calls should be queued. Given it's a simulation, direct await is fine.
          await deliveryReceiptAction(firestoreLogId, deliveryStatus); 
        } catch (error) {
          console.error(`[startCampaignProcessingAction] Error processing message for customer ${customerId} (Log ID: ${firestoreLogId || 'N/A'}) in campaign ${campaignId}. Timestamp: ${new Date().toISOString()}`, error);
          console.error("[startCampaignProcessingAction] Full error object during message processing loop:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      })();
      processingPromises.push(promise);
    }

    // We are now awaiting each deliveryReceiptAction, so this Promise.allSettled will wait for all of them.
    Promise.allSettled(processingPromises).then(async () => {
      console.log(`[startCampaignProcessingAction] All simulated messages for campaign "${campaignToProcess.name}" (ID: ${campaignId}) dispatched and processed. Timestamp: ${new Date().toISOString()}`);
      // Final check on campaign status after all logs are processed.
      // This might be redundant if deliveryReceiptAction correctly sets final status, but can act as a fallback.
      if (campaignId) {
          const campaignFinalDocRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
          const finalCampaignSnap = await getDoc(campaignFinalDocRef);
          if (finalCampaignSnap.exists()) {
              const finalCampaignData = finalCampaignSnap.data() as Campaign;
              if (finalCampaignData.processedCount === finalCampaignData.audienceSize &&
                  (finalCampaignData.status === 'Processing' || finalCampaignData.status === 'Pending')) { // If it's still processing but all done
                  let newFinalStatus: CampaignStatus = 'Sent';
                  if (finalCampaignData.failedCount === finalCampaignData.audienceSize) {
                      newFinalStatus = 'Failed';
                  } else if (finalCampaignData.failedCount > 0) {
                      newFinalStatus = 'CompletedWithFailures';
                  }
                  console.log(`[startCampaignProcessingAction] Post-loop final status check for campaign ${campaignId}. Current: ${finalCampaignData.status}, New: ${newFinalStatus}`);
                  await updateDoc(campaignFinalDocRef, { status: newFinalStatus });
              }
          }
      }
    }).catch(error => {
      console.error(`[startCampaignProcessingAction] Unexpected error in Promise.allSettled for campaign "${campaignToProcess.name}" (ID: ${campaignId}). Timestamp: ${new Date().toISOString()}`, error);
    });

    console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" processing initiated. ${campaignToProcess.audienceSize} messages queued. Returning campaignId: ${campaignId}. Timestamp: ${new Date().toISOString()}`);
    return campaignId; 

  } catch (error) {
    console.error(`[startCampaignProcessingAction] GLOBAL_CATCH_BLOCK: Error processing campaign (ID: ${campaignId || 'N/A before creation'}). Timestamp: ${new Date().toISOString()}`, error);
    console.error("[startCampaignProcessingAction] Full error object in global catch:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return null; 
  }
}


export async function generateCampaignMessagesAction(
  input: GenerateCampaignMessagesInput
): Promise<GenerateCampaignMessagesOutput> {
  console.log(`[generateCampaignMessagesAction] ENTERED. Input: ${JSON.stringify(input)}. Timestamp: ${new Date().toISOString()}`);
  try {
    const result = await generateCampaignMessages(input);
    console.log(`[generateCampaignMessagesAction] Successfully generated ${result.length} suggestions. Timestamp: ${new Date().toISOString()}`);
    return result;
  } catch (error) {
    console.error(`[generateCampaignMessagesAction] Error generating messages. Timestamp: ${new Date().toISOString()}`, error);
    return []; 
  }
}
