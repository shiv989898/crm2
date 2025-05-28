
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

export async function deliveryReceiptAction(logId: string, deliveryStatus: 'Sent' | 'Failed') {
  console.log(`[deliveryReceiptAction ENTERED] Log ID: ${logId}, Status: ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
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
    
    if (logEntryData.status === 'Sent' || logEntryData.status === 'Failed') {
        console.warn(`[deliveryReceiptAction] Log entry ${logId} already in a final state (${logEntryData.status}). Skipping log document update to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
    } else {
        await updateDoc(logDocRef, {
          status: deliveryStatus,
          timestamp: new Date().toISOString(),
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
      console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} data from DB: Status: ${campaignData.status}, Sent: ${campaignData.sentCount || 0}, Failed: ${campaignData.failedCount || 0}, Processed: ${campaignData.processedCount || 0}, Audience: ${campaignData.audienceSize}. Timestamp: ${new Date().toISOString()}`);

      let finalSentCount = campaignData.sentCount || 0;
      let finalFailedCount = campaignData.failedCount || 0;

      // Increment counts only if this log entry was 'Pending' before this delivery receiptAction call potentially updated it.
      // logEntryData holds the state of the log *before* this specific deliveryReceiptAction call potentially updated it.
      if (logEntryData && logEntryData.status === 'Pending') {
        if (deliveryStatus === 'Sent') {
          finalSentCount++;
          console.log(`[deliveryReceiptAction TRANSACTION] Log ${logId} was Pending and is now Sent. Incrementing finalSentCount for ${campaignId} to: ${finalSentCount}`);
        } else { // deliveryStatus is 'Failed'
          finalFailedCount++;
          console.log(`[deliveryReceiptAction TRANSACTION] Log ${logId} was Pending and is now Failed. Incrementing finalFailedCount for ${campaignId} to: ${finalFailedCount}`);
        }
      } else if (logEntryData) {
        console.log(`[deliveryReceiptAction TRANSACTION] Log ${logId} was not 'Pending' (was ${logEntryData.status}). Counts for campaign ${campaignId} not incremented by this event.`);
      }


      const finalProcessedCount = finalSentCount + finalFailedCount; // Recalculate based on potentially updated counts
      let finalStatus: CampaignStatus = campaignData.status; // Default to current status

      console.log(`[deliveryReceiptAction TRANSACTION] Values for status decision for ${campaignId}: finalSentCount=${finalSentCount}, finalFailedCount=${finalFailedCount}, finalProcessedCount=${finalProcessedCount}, audienceSize=${campaignData.audienceSize}, currentCampaignStatus=${campaignData.status}. Timestamp: ${new Date().toISOString()}`);
      
      // Only update status if the campaign is still in a processing-related state
      if (campaignData.status === 'Pending' || campaignData.status === 'Processing') {
        if (campaignData.audienceSize === 0) { // Handle zero audience size explicitly
            finalStatus = 'Sent'; 
            console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} has ZERO AUDIENCE. Setting status to ${finalStatus}.`);
        } else if (finalProcessedCount >= campaignData.audienceSize) {
          // All messages accounted for
          if (finalFailedCount === 0 && finalSentCount === campaignData.audienceSize) { // All processed, no failures, all sent
            finalStatus = 'Sent';
          } else if (finalSentCount === 0 && finalFailedCount === campaignData.audienceSize) { // All processed, all failed
            finalStatus = 'Failed';
          } else { // All processed, some failures, or partial processing
            finalStatus = 'CompletedWithFailures';
          }
          console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} ALL MESSAGES PROCESSED (${finalProcessedCount}/${campaignData.audienceSize}). Determined final status: ${finalStatus}.`);
        } else if (finalProcessedCount > 0) {
          // Some messages processed, but not all. Ensure status remains 'Processing'.
          finalStatus = 'Processing';
          console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} SOME MESSAGES PROCESSED (${finalProcessedCount}/${campaignData.audienceSize}). Ensuring status remains ${finalStatus}.`);
        } else {
           // finalProcessedCount is 0 (and audienceSize > 0). Status should remain 'Processing' (or 'Pending' if it never started).
           console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} NO MESSAGES PROCESSED YET (${finalProcessedCount}/${campaignData.audienceSize}). Status remains: ${finalStatus}.`);
        }
      } else {
         console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} is already in a final state (${campaignData.status}). Not re-evaluating overall status.`);
      }
      
      console.log(`[deliveryReceiptAction TRANSACTION] Updating campaign ${campaignId} in Firestore. New values - Sent: ${finalSentCount}, Failed: ${finalFailedCount}, Processed: ${finalProcessedCount}, Status: ${finalStatus}. Timestamp: ${new Date().toISOString()}`);
      transaction.update(campaignDocRef, {
        sentCount: finalSentCount,
        failedCount: finalFailedCount,
        processedCount: finalProcessedCount,
        status: finalStatus,
      });
    });
    console.log(`[deliveryReceiptAction SUCCESS] Transaction for campaign ${campaignId} completed. Timestamp: ${new Date().toISOString()}`);

  } catch (error) {
    console.error(`[deliveryReceiptAction ERROR_PROCESSING_RECEIPT] For log ${logId}. Timestamp: ${new Date().toISOString()}`, error);
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
      return campaignId;
    }

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
          console.log(`[startCampaignProcessingAction LOOP ${i+1}/${campaignToProcess.audienceSize}] Attempting to ADD log to Firestore. Campaign ${campaignId}. Data:`, JSON.stringify(logEntry) + `. Timestamp: ${new Date().toISOString()}`);
          const logDocRef = await addDoc(collection(db, COMMUNICATION_LOGS_COLLECTION), logEntry);
          firestoreLogId = logDocRef.id;
          console.log(`[startCampaignProcessingAction LOOP ${i+1}/${campaignToProcess.audienceSize} SUCCESS] Log (ID: ${firestoreLogId}) ADDED. Timestamp: ${new Date().toISOString()}`);

          // Reduced delay: 10ms to 50ms per message
          await new Promise(r => setTimeout(r, Math.random() * 40 + 10)); 
          
          const isSuccess = Math.random() < 0.9; 
          const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
          
          console.log(`[startCampaignProcessingAction LOOP ${i+1}/${campaignToProcess.audienceSize}] Simulated delivery for log ${firestoreLogId}: ${deliveryStatus}. Calling deliveryReceiptAction. Timestamp: ${new Date().toISOString()}`);
          await deliveryReceiptAction(firestoreLogId, deliveryStatus); 
        } catch (error) {
          console.error(`[startCampaignProcessingAction LOOP ERROR] Error processing customer ${customerId} (Log ID: ${firestoreLogId || 'N/A'}) in campaign ${campaignId}. Timestamp: ${new Date().toISOString()}`, error);
          console.error("[startCampaignProcessingAction LOOP ERROR_OBJECT]:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      })();
      processingPromises.push(promise);
    }
    
    Promise.allSettled(processingPromises).then(() => {
      console.log(`[startCampaignProcessingAction FINAL_LOG] All simulated message dispatches for campaign "${campaignToProcess.name}" (ID: ${campaignId}) have been initiated. Final status updates are handled by deliveryReceiptAction. Timestamp: ${new Date().toISOString()}`);
    }).catch(error => {
      console.error(`[startCampaignProcessingAction ERROR_IN_PROMISE_ALL_SETTLED] For campaign "${campaignToProcess.name}" (ID: ${campaignId}). This is unexpected as allSettled should not reject. Timestamp: ${new Date().toISOString()}`, error);
    });

    console.log(`[startCampaignProcessingAction SUCCESS_OVERALL] Processing initiated for campaign "${campaignToProcess.name}". ${campaignToProcess.audienceSize} messages queued. Returning campaignId: ${campaignId}. Timestamp: ${new Date().toISOString()}`);
    return campaignId; 

  } catch (error) {
    console.error(`[startCampaignProcessingAction GLOBAL_CATCH_ERROR] Error during campaign (ID: ${campaignId || 'N/A before creation'}) processing initiation. Timestamp: ${new Date().toISOString()}`, error);
    console.error("[startCampaignProcessingAction GLOBAL_CATCH_ERROR_OBJECT]:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
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

