
export type SegmentRule = {
  id: string;
  field: string;
  operator: string;
  value: string | number | boolean | Date | undefined; // Modified to allow undefined
  logicalOperator?: 'AND' | 'OR'; // Connects this rule to the NEXT rule
};

export type Audience = {
  id: string;
  name: string;
  rules: SegmentRule[];
  createdAt: string; // ISO string
  description?: string; // Optional description, possibly from NLP
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
  audienceId: string; // ID of the Audience
  audienceName: string; // Name of the Audience
  audienceSize: number;
  createdAt: string; // ISO string
  status: CampaignStatus;
  sentCount: number;
  failedCount: number;
  processedCount?: number; // Number of messages that have reached a final state (Sent/Failed)
  objective?: string; // User-defined campaign objective
  messageTemplate?: string; // Core message template with placeholders like {{customerName}}
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type CommunicationLogEntry = {
  logId: string;
  campaignId: string;
  customerId: string; // Mock customer ID
  customerName: string; // Mock customer name for personalized message
  message: string; // The final personalized message sent
  status: 'Pending' | 'Sent' | 'Failed';
  timestamp: string; // ISO string
};
