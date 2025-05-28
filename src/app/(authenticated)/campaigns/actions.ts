
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

  try {
    console.log(`[deliveryReceiptAction] Reading log entry: ${logId}. Timestamp: ${new Date().toISOString()}`);
    const logDocSnap = await getDoc(logDocRef);
    if (!logDocSnap.exists()) {
      console.error(`[deliveryReceiptAction ERROR] Log entry ${logId} not found. Timestamp: ${new Date().toISOString()}`);
      return;
    }
    const logEntryData = logDocSnap.data() as CommunicationLogEntry;
    console.log(`[deliveryReceiptAction] Log entry ${logId} found. Current status: ${logEntryData.status}. Attempting to update to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
    
    if (logEntryData.status === 'Sent' || logEntryData.status === 'Failed') {
        console.warn(`[deliveryReceiptAction] Log entry ${logId} already processed with status ${logEntryData.status}. Skipping update to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
    } else {
        await updateDoc(logDocRef, {
        status: deliveryStatus,
        timestamp: new Date().toISOString(),
        });
        console.log(`[deliveryReceiptAction SUCCESS] Log entry ${logId} status updated to ${deliveryStatus}. Timestamp: ${new Date().toISOString()}`);
    }

    const campaignId = logEntryData.campaignId;
    if (!campaignId) {
      console.error(`[deliveryReceiptAction ERROR] Campaign ID missing in log entry ${logId}. Cannot update campaign. Timestamp: ${new Date().toISOString()}`);
      return;
    }
    const campaignDocRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    console.log(`[deliveryReceiptAction] Running transaction to update campaign: ${campaignId}. Timestamp: ${new Date().toISOString()}`);

    await runTransaction(db, async (transaction) => {
      console.log(`[deliveryReceiptAction TRANSACTION] Getting campaign snapshot for ${campaignId}. Timestamp: ${new Date().toISOString()}`);
      const campaignDocSnap = await transaction.get(campaignDocRef);
      if (!campaignDocSnap.exists()) {
        console.error(`[deliveryReceiptAction TRANSACTION ERROR] Campaign ${campaignId} not found for log ${logId}. Timestamp: ${new Date().toISOString()}`);
        throw new Error(`Campaign ${campaignId} not found`);
      }
      const campaignData = campaignDocSnap.data() as Campaign;
      console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} retrieved. Status: ${campaignData.status}. Timestamp: ${new Date().toISOString()}`);
      
      let newSentCount = campaignData.sentCount || 0;
      let newFailedCount = campaignData.failedCount || 0;
      let newProcessedCount = (campaignData.processedCount || 0);

      if (logEntryData.status === 'Pending' || logEntryData.status !== deliveryStatus) { 
        if (deliveryStatus === 'Sent') {
          newSentCount++;
        } else {
          newFailedCount++;
        }
        newProcessedCount++; 
      }

      let newStatus = campaignData.status;
      if (newProcessedCount >= campaignData.audienceSize) { 
        if (newFailedCount === 0 && newSentCount === campaignData.audienceSize) {
          newStatus = 'Sent';
        } else if (newSentCount === 0 && newFailedCount === campaignData.audienceSize) {
          newStatus = 'Failed';
        } else {
          newStatus = 'CompletedWithFailures';
        }
        console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} final status determined: ${newStatus}. Processed: ${newProcessedCount}/${campaignData.audienceSize}. Timestamp: ${new Date().toISOString()}`);
      } else if (campaignData.status !== 'Processing' && newProcessedCount > 0) { 
        newStatus = 'Processing';
         console.log(`[deliveryReceiptAction TRANSACTION] Campaign ${campaignId} status set to Processing. Processed: ${newProcessedCount}/${campaignData.audienceSize}. Timestamp: ${new Date().toISOString()}`);
      }
      
      console.log(`[deliveryReceiptAction TRANSACTION] Updating campaign ${campaignId} with counts: S:${newSentCount}, F:${newFailedCount}, P:${newProcessedCount}, Status:${newStatus}. Timestamp: ${new Date().toISOString()}`);
      transaction.update(campaignDocRef, {
        sentCount: newSentCount,
        failedCount: newFailedCount,
        processedCount: newProcessedCount,
        status: newStatus,
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
  console.log(`[startCampaignProcessingAction ENTERED] Received campaign: { name: "${campaignToProcess.name}", audienceSize: ${campaignToProcess.audienceSize}, createdBy: ${campaignToProcess.createdByUserId} }. Timestamp: ${new Date().toISOString()}`);

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
    console.log(`[startCampaignProcessingAction SUCCESS] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) ADDED. Timestamp: ${new Date().toISOString()}`);

    console.log(`[startCampaignProcessingAction] Attempting to UPDATE campaign "${campaignToProcess.name}" (ID: ${campaignId}) status to 'Processing'. Timestamp: ${new Date().toISOString()}`);
    await updateDoc(campaignDocRef, { status: 'Processing' });
    console.log(`[startCampaignProcessingAction SUCCESS] Campaign "${campaignToProcess.name}" (ID: ${campaignId}) status 'Processing'. Timestamp: ${new Date().toISOString()}`);
    
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

          await new Promise(r => setTimeout(r, Math.random() * 150 + 50)); 
          const isSuccess = Math.random() < 0.9; 
          const deliveryStatus = isSuccess ? 'Sent' : 'Failed';
          console.log(`[startCampaignProcessingAction LOOP ${i+1}/${campaignToProcess.audienceSize}] Simulated delivery for log ${firestoreLogId}: ${deliveryStatus}. Calling deliveryReceiptAction. Timestamp: ${new Date().toISOString()}`);
          await deliveryReceiptAction(firestoreLogId, deliveryStatus); 
        } catch (error) {
          console.error(`[startCampaignProcessingAction LOOP ERROR] Processing customer ${customerId} (Log ID: ${firestoreLogId || 'N/A'}) in campaign ${campaignId}. Timestamp: ${new Date().toISOString()}`, error);
          console.error("[startCampaignProcessingAction LOOP ERROR_OBJECT]:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      })();
      processingPromises.push(promise);
    }
    
    Promise.allSettled(processingPromises).then(async () => {
      console.log(`[startCampaignProcessingAction FINAL_CHECK] All simulated messages for campaign "${campaignToProcess.name}" (ID: ${campaignId}) dispatched. Timestamp: ${new Date().toISOString()}`);
      if (campaignId) {
          const campaignFinalDocRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
          const finalCampaignSnap = await getDoc(campaignFinalDocRef);
          if (finalCampaignSnap.exists()) {
              const finalCampaignData = finalCampaignSnap.data() as Campaign;
              if (finalCampaignData.processedCount === finalCampaignData.audienceSize &&
                  (finalCampaignData.status === 'Processing' || finalCampaignData.status === 'Pending')) { 
                  let newFinalStatus: CampaignStatus = 'Sent';
                  if (finalCampaignData.failedCount === finalCampaignData.audienceSize) {
                      newFinalStatus = 'Failed';
                  } else if (finalCampaignData.failedCount > 0) {
                      newFinalStatus = 'CompletedWithFailures';
                  }
                  console.log(`[startCampaignProcessingAction FINAL_CHECK] Updating final status for campaign ${campaignId}. Current: ${finalCampaignData.status}, New: ${newFinalStatus}. Timestamp: ${new Date().toISOString()}`);
                  await updateDoc(campaignFinalDocRef, { status: newFinalStatus });
              }
          }
      }
    }).catch(error => {
      console.error(`[startCampaignProcessingAction ERROR_IN_PROMISE_ALL_SETTLED] For campaign "${campaignToProcess.name}" (ID: ${campaignId}). Timestamp: ${new Date().toISOString()}`, error);
    });

    console.log(`[startCampaignProcessingAction SUCCESS_OVERALL] Processing initiated for campaign "${campaignToProcess.name}". ${campaignToProcess.audienceSize} messages queued. Returning campaignId: ${campaignId}. Timestamp: ${new Date().toISOString()}`);
    return campaignId; 

  } catch (error) {
    console.error(`[startCampaignProcessingAction GLOBAL_CATCH_ERROR] For campaign (ID: ${campaignId || 'N/A before creation'}). Timestamp: ${new Date().toISOString()}`, error);
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

