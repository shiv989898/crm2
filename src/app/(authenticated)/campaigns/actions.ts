
"use server";

import { config } from 'dotenv'; 
config();
console.log('[CampaignActions ModuleLoad] dotenv config() called. GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Loaded' : 'NOT Loaded');
console.log('[CampaignActions ModuleLoad] NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Loaded' : 'NOT Loaded');

import { db } from '@/config/firebase'; 
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  runTransaction,
  getDoc,
  Timestamp, // Import Timestamp
} from 'firebase/firestore';
import type { Campaign, CommunicationLogEntry, CampaignStatus } from '@/types';
import { generateCampaignMessages, type GenerateCampaignMessagesInput, type GenerateCampaignMessagesOutput } from '@/ai/flows/generate-campaign-messages-flow';

const CAMPAIGNS_COLLECTION = 'campaigns';
const COMMUNICATION_LOGS_COLLECTION = 'communicationLogs';

if (!db) {
  console.error(`[CampaignActions ModuleLoad] CRITICAL_ERROR_AT_MODULE_LOAD: Firestore 'db' instance is NOT initialized from @/config/firebase.ts. Firebase operations will fail. Timestamp: ${new Date().toISOString()}`);
} else {
  console.log(`[CampaignActions ModuleLoad] Firestore 'db' instance appears to be initialized. Timestamp: ${new Date().toISOString()}`);
}

export async function getCampaignsAction(): Promise<Campaign[]> {
  console.log(`[getCampaignsAction ENTERED] Attempting to fetch campaigns from Firestore. Timestamp: ${new Date().toISOString()}`);
  if (!db) {
    console.error(`[getCampaignsAction CRITICAL_FAILURE_POINT] Firestore 'db' instance is NULL. Cannot fetch campaigns. Timestamp: ${new Date().toISOString()}`);
    return [];
  }
  try {
    const campaignsQuery = query(collection(db, CAMPAIGNS_COLLECTION), orderBy("createdAt", "desc"));
    console.log("[getCampaignsAction] Executing Firestore query to fetch campaigns...");
    const querySnapshot = await getDocs(campaignsQuery);
    const campaigns: Campaign[] = [];
    querySnapshot.forEach((doc) => {
      campaigns.push({ id: doc.id, ...doc.data() } as Campaign);
    });
    console.log(`[getCampaignsAction SUCCESS] Fetched ${campaigns.length} campaigns. Names: ${campaigns.map(c => c.name).join(', ')}. Timestamp: ${new Date().toISOString()}`);
    return campaigns;
  } catch (error) {
    console.error(`[getCampaignsAction ERROR] Error fetching campaigns from Firestore. Timestamp: ${new Date().toISOString()}`, error);
    return [];
  }
}

// Counter for deliveryReceiptAction calls per campaign (for debugging)
const deliveryReceiptCallCounts: Record<string, number> = {};

export async function deliveryReceiptAction(logId: string, deliveryStatus: 'Sent' | 'Failed', campaignIdForLog: string) {
  if (!deliveryReceiptCallCounts[campaignIdForLog]) {
    deliveryReceiptCallCounts[campaignIdForLog] = 0;
  }
  deliveryReceiptCallCounts[campaignIdForLog]++;
  console.log(`[deliveryReceiptAction ENTERED] Log ID: ${logId}, Campaign ID: ${campaignIdForLog}, Status: ${deliveryStatus}. Call #${deliveryReceiptCallCounts[campaignIdForLog]} for this campaign. Timestamp: ${new Date().toISOString()}`);
  
  if (!db) {
    console.error(`[deliveryReceiptAction CRITICAL_FAILURE_POINT] Firestore 'db' instance is NULL. Cannot process. Timestamp: ${new Date().toISOString()}`);
    return;
  }

  const logDocRef = doc(db, COMMUNICATION_LOGS_COLLECTION, logId);
  let logEntryData: CommunicationLogEntry | null = null;

  try {
    console.log(`[deliveryReceiptAction] Reading log entry: ${logId}. Timestamp: ${new Date().toISOString()}`);
    const logDocSnap = await getDoc(logDocRef);
    if (!logDocSnap.exists()) {
      console.error(`[deliveryReceiptAction ERROR] Log entry ${logId} not found. Timestamp: ${new Date().toISOString()}`);
      return;
    }
    logEntryData = logDocSnap.data() as CommunicationLogEntry; 
    console.log(`[deliveryReceiptAction] Log entry ${logId} found. Current status from DB: ${logEntryData.status}. Attempting to update to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
    
    const wasPending = logEntryData.status === 'Pending';

    if (logEntryData.status === 'Sent' || logEntryData.status === 'Failed') {
        console.warn(`[deliveryReceiptAction] Log entry ${logId} already in a final state (${logEntryData.status}). Skipping log document update to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
    } else {
        await updateDoc(logDocRef, {
          status: deliveryStatus,
          timestamp: new Date().toISOString(), // Update timestamp on status change
        });
        console.log(`[deliveryReceiptAction SUCCESS] Log entry ${logId} status updated in Firestore to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
    }

    const campaignId = logEntryData.campaignId;
    if (!campaignId) {
      console.error(`[deliveryReceiptAction ERROR] Campaign ID missing in log entry ${logId}. Cannot update campaign. Timestamp: ${new Date().toISOString()}`);
      return;
    }
    const campaignDocRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    console.log(`[deliveryReceiptAction] Running transaction to update campaign: ${campaignId}. Based on log ${logId} receiving status ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);

    await runTransaction(db, async (transaction) => {
      console.log(`[deliveryReceiptAction TRANSACTION START] Getting campaign snapshot for ${campaignId}. Timestamp: ${new Date().toISOString()}`);
      const campaignDocSnap = await transaction.get(campaignDocRef);
      if (!campaignDocSnap.exists()) {
        console.error(`[deliveryReceiptAction TRANSACTION ERROR] Campaign ${campaignId} not found in transaction for log ${logId}. Timestamp: ${new Date().toISOString()}`);
        throw new Error(`Campaign ${campaignId} not found`);
      }
      const campaignData = campaignDocSnap.data() as Campaign;
      console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} DATA FROM DB: Status: ${campaignData.status}, Sent: ${campaignData.sentCount || 0}, Failed: ${campaignData.failedCount || 0}, Processed: ${campaignData.processedCount || 0}, Audience: ${campaignData.audienceSize}. Log ${logId} original status was Pending: ${wasPending}. Timestamp: ${new Date().toISOString()}`);

      let newSentCount = campaignData.sentCount || 0;
      let newFailedCount = campaignData.failedCount || 0;

      if (wasPending) { // Only increment counts if the log was actually 'Pending'
        if (deliveryStatus === 'Sent') {
          newSentCount++;
          console.log(`[deliveryReceiptAction TRANSACTION] Log ${logId} was Pending and is now Sent. Incrementing newSentCount for ${campaignId} to: ${newSentCount}`);
        } else { // deliveryStatus is 'Failed'
          newFailedCount++;
          console.log(`[deliveryReceiptAction TRANSACTION] Log ${logId} was Pending and is now Failed. Incrementing newFailedCount for ${campaignId} to: ${newFailedCount}`);
        }
      } else {
        console.log(`[deliveryReceiptAction TRANSACTION] Log ${logId} was NOT Pending (was ${logEntryData?.status}). Counts for campaign ${campaignId} not incremented by this event.`);
      }

      const newProcessedCount = newSentCount + newFailedCount;
      let newStatus: CampaignStatus = campaignData.status; 

      console.log(`[deliveryReceiptAction TRANSACTION] Values for status decision for ${campaignId}: newSentCount=${newSentCount}, newFailedCount=${newFailedCount}, newProcessedCount=${newProcessedCount}, audienceSize=${campaignData.audienceSize}, currentCampaignStatusDB=${campaignData.status}. Timestamp: ${new Date().toISOString()}`);
      
      if (campaignData.status === 'Pending' || campaignData.status === 'Processing') {
        if (campaignData.audienceSize === 0) { 
            newStatus = 'Sent'; 
            console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} has ZERO AUDIENCE. Setting status to ${newStatus}.`);
        } else if (newProcessedCount === campaignData.audienceSize) { // Strict equality check here
          if (newFailedCount === 0) { // All processed, no failures
            newStatus = 'Sent';
          } else if (newSentCount === 0) { // All processed, all failed
            newStatus = 'Failed';
          } else { // All processed, some failures
            newStatus = 'CompletedWithFailures';
          }
          console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} ALL MESSAGES PROCESSED (${newProcessedCount}/${campaignData.audienceSize}). Determined final status: ${newStatus}.`);
        } else if (newProcessedCount > 0 && newProcessedCount < campaignData.audienceSize) {
          newStatus = 'Processing'; // Still processing
          console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} SOME MESSAGES PROCESSED (${newProcessedCount}/${campaignData.audienceSize}). Status remains ${newStatus}.`);
        } else if (newProcessedCount === 0 && campaignData.audienceSize > 0 ) {
           // No messages processed yet, status should remain what it was (likely 'Processing' or 'Pending')
           console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} NO MESSAGES PROCESSED YET (${newProcessedCount}/${campaignData.audienceSize}). Status remains: ${newStatus}.`);
        } else if (newProcessedCount > campaignData.audienceSize) {
            // This case should ideally not happen if audienceSize and loop count are correct.
            console.warn(`[deliveryReceiptAction TRANSACTION WARNING] Processed count (${newProcessedCount}) exceeds audience size (${campaignData.audienceSize}) for campaign ${campaignId}. Setting to completed status based on counts.`);
            if (newFailedCount === 0) newStatus = 'Sent';
            else if (newSentCount === 0) newStatus = 'Failed';
            else newStatus = 'CompletedWithFailures';
        }
      } else {
         console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} is already in a final state (${campaignData.status}). Not re-evaluating overall status, but updating counts.`);
      }
      
      const updateData: Partial<Campaign> = {
        sentCount: newSentCount,
        failedCount: newFailedCount,
        processedCount: newProcessedCount,
      };
      if (newStatus !== campaignData.status) { // Only update status if it changed
        updateData.status = newStatus;
      }

      console.log(`[deliveryReceiptAction TRANSACTION] Updating campaign ${campaignId} in Firestore. UpdateData:`, JSON.stringify(updateData) + `. Timestamp: ${new Date().toISOString()}`);
      transaction.update(campaignDocRef, updateData);
    });
    console.log(`[deliveryReceiptAction SUCCESS] Transaction for campaign ${campaignId} completed. Timestamp: ${new Date().toISOString()}`);

  } catch (error) {
    console.error(`[deliveryReceiptAction ERROR_PROCESSING_RECEIPT] For log ${logId} (Campaign: ${campaignIdForLog}). Timestamp: ${new Date().toISOString()}`, error);
    console.error("[deliveryReceiptAction ERROR_OBJECT]:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
}

export async function startCampaignProcessingAction(
  campaignToProcess: Omit<Campaign, 'id' | 'createdAt' | 'status' | 'sentCount' | 'failedCount' | 'processedCount'> & { createdByUserId: string }
): Promise<string | null> {
  console.log(`[startCampaignProcessingAction ENTERED] Received campaign: { name: "${campaignToProcess.name}", audienceSize: ${campaignToProcess.audienceSize}, objective: "${campaignToProcess.objective}", createdBy: ${campaignToProcess.createdByUserId} }. Timestamp: ${new Date().toISOString()}`);

  if (!db) {
    console.error(`[startCampaignProcessingAction CRITICAL_FAILURE_POINT] Firestore 'db' instance is NULL or undefined. Aborting. Timestamp: ${new Date().toISOString()}`);
    return null; 
  }
  console.log(`[startCampaignProcessingAction] Firestore 'db' instance OK. Timestamp: ${new Date().toISOString()}`);

  let campaignId: string | null = null;

  try {
    const campaignDataForFirestore: Omit<Campaign, 'id'> = {
      ...campaignToProcess,
      status: "Pending", 
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(), 
    };
    console.log(`[startCampaignProcessingAction] Attempting to ADD campaign "${campaignToProcess.name}" to Firestore. Data:`, JSON.stringify(campaignDataForFirestore) + `. Timestamp: ${new Date().toISOString()}`);
    const campaignDocRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaignDataForFirestore);
    campaignId = campaignDocRef.id;
    console.log(`[startCampaignProcessingAction SUCCESS] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) ADDED to Firestore with 'Pending' status. Timestamp: ${new Date().toISOString()}`);

    console.log(`[startCampaignProcessingAction] Attempting to UPDATE campaign "${campaignToProcess.name}" (ID: ${campaignId}) status to 'Processing'. Timestamp: ${new Date().toISOString()}`);
    await updateDoc(campaignDocRef, { status: 'Processing' });
    console.log(`[startCampaignProcessingAction SUCCESS] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) status updated to 'Processing' in Firestore. Timestamp: ${new Date().toISOString()}`);
    
    if (campaignToProcess.audienceSize === 0) {
      console.log(`[startCampaignProcessingAction] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) has zero audience size. Setting status to 'Sent'.`);
      await updateDoc(campaignDocRef, { status: 'Sent', processedCount: 0, sentCount: 0, failedCount: 0 });
      // Reset call count for this campaign if it's being re-processed for some reason or for new campaign
      if (campaignId) delete deliveryReceiptCallCounts[campaignId]; 
      return campaignId;
    }

    const processingPromises: Promise<void>[] = [];
    let dispatchInitiatedCount = 0;

    for (let i = 0; i < campaignToProcess.audienceSize; i++) {
      const customerId = `cust-${campaignId}-${Date.now()}-${i}`; // Unique customer ID
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
        timestamp: new Date().toISOString(), // Timestamp for log creation
      };
      
      const promise = (async () => {
        let firestoreLogId: string | null = null;
        try {
          console.log(`[startCampaignProcessingAction LOOP ${i+1}/${campaignToProcess.audienceSize}] Attempting to ADD log to Firestore. Campaign ${campaignId}. Data:`, JSON.stringify(logEntry) + `. Timestamp: ${new Date().toISOString()}`);
          const logDocRef = await addDoc(collection(db, COMMUNICATION_LOGS_COLLECTION), logEntry);
          firestoreLogId = logDocRef.id;
          console.log(`[startCampaignProcessingAction LOOP ${i+1}/${campaignToProcess.audienceSize} SUCCESS] Log (ID: ${firestoreLogId}) ADDED. Timestamp: ${new Date().toISOString()}`);

          // Reduced delay: 10ms to 50ms per message
          await new Promise(r => setTimeout(r, Math.random() * 40 + 10)); 
          
          const isSuccess = Math.random() < 0.9; 
          const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
          
          console.log(`[startCampaignProcessingAction LOOP ${i+1}/${campaignToProcess.audienceSize}] Simulated delivery for log ${firestoreLogId}: ${deliveryStatus}. Calling deliveryReceiptAction. Campaign ID: ${campaignId}. Timestamp: ${new Date().toISOString()}`);
          if (campaignId) { // Ensure campaignId is not null
             await deliveryReceiptAction(firestoreLogId, deliveryStatus, campaignId); 
          } else {
            console.error(`[startCampaignProcessingAction LOOP ERROR] Campaign ID is null, cannot call deliveryReceiptAction for log ${firestoreLogId}`);
          }
        } catch (error) {
          console.error(`[startCampaignProcessingAction LOOP ERROR] Error processing customer ${customerId} (Log ID: ${firestoreLogId || 'N/A'}) in campaign ${campaignId}. Timestamp: ${new Date().toISOString()}`, error);
          console.error("[startCampaignProcessingAction LOOP ERROR_OBJECT]:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      })();
      processingPromises.push(promise);
      dispatchInitiatedCount++;
    }
    
    console.log(`[startCampaignProcessingAction] Loop finished. Initiated ${dispatchInitiatedCount} dispatches for campaign "${campaignToProcess.name}" (ID: ${campaignId}). Waiting for all to settle. Timestamp: ${new Date().toISOString()}`);

    Promise.allSettled(processingPromises).then(() => {
      console.log(`[startCampaignProcessingAction FINAL_LOG] All ${dispatchInitiatedCount} simulated message dispatches for campaign "${campaignToProcess.name}" (ID: ${campaignId}) have been initiated and settled. Final status updates are handled by deliveryReceiptAction. Timestamp: ${new Date().toISOString()}`);
      // Optionally, reset the debug counter after all processing for this campaign initiation is done.
      if (campaignId) delete deliveryReceiptCallCounts[campaignId]; 
    }).catch(error => {
      console.error(`[startCampaignProcessingAction ERROR_IN_PROMISE_ALL_SETTLED] For campaign "${campaignToProcess.name}" (ID: ${campaignId}). This is unexpected as allSettled should not reject. Timestamp: ${new Date().toISOString()}`, error);
    });

    console.log(`[startCampaignProcessingAction SUCCESS_OVERALL] Processing initiated for campaign "${campaignToProcess.name}". ${campaignToProcess.audienceSize} messages queued. Returning campaignId: ${campaignId}. Timestamp: ${new Date().toISOString()}`);
    return campaignId; 

  } catch (error) {
    console.error(`[startCampaignProcessingAction GLOBAL_CATCH_ERROR] Error during campaign (ID: ${campaignId || 'N/A before creation'}) processing initiation. Timestamp: ${new Date().toISOString()}`, error);
    console.error("[startCampaignProcessingAction GLOBAL_CATCH_ERROR_OBJECT]:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    if (campaignId) delete deliveryReceiptCallCounts[campaignId]; // Clean up counter on error
    return null; 
  }
}

export async function generateCampaignMessagesAction(
  input: GenerateCampaignMessagesInput
): Promise<GenerateCampaignMessagesOutput> {
  console.log(`[generateCampaignMessagesAction ENTERED] Input: ${JSON.stringify(input)}. Timestamp: ${new Date().toISOString()}`);
  try {
    const result = await generateCampaignMessages(input);
    console.log(`[generateCampaignMessagesAction SUCCESS] Generated ${result.length} suggestions. Timestamp: ${new Date().toISOString()}`);
    return result;
  } catch (error) {
    console.error(`[generateCampaignMessagesAction ERROR] Generating messages. Timestamp: ${new Date().toISOString()}`, error);
    return []; 
  }
}
