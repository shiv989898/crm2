
export type SegmentRule = {
  id: string;
  field: string;
  operator: string;
  value: string | number | boolean | Date | undefined; 
  logicalOperator?: 'AND' | 'OR'; 
};

export type Audience = {
  id: string;
  name: string;
  rules: SegmentRule[];
  createdAt: string; // ISO string
  description?: string; 
};

export type CampaignStatus =
  | 'Sent'
  | 'Failed'
  | 'Pending'
  | 'Draft'
  | 'Processing'
  | 'CompletedWithFailures';

export type Campaign = {
  id:string;
  name: string;
  audienceId: string; 
  audienceName: string; 
  audienceSize: number;
  createdAt: string; // ISO string
  status: CampaignStatus;
  sentCount: number;
  failedCount: number;
  processedCount?: number; 
  objective?: string; 
  messageTemplate?: string; 
  createdByUserId?: string; // ID of the user who created the campaign
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type CommunicationLogEntry = {
  logId: string; // This will be the Firestore document ID
  campaignId: string;
  customerId: string; 
  customerName: string; 
  message: string; 
  status: 'Pending' | 'Sent' | 'Failed';
  timestamp: string; // ISO string
};
