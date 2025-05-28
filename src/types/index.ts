
export type SegmentRule = {
  id: string;
  field: string;
  operator: string;
  value: string | number | boolean | Date;
  logicalOperator?: 'AND' | 'OR'; // Connects this rule to the NEXT rule
};

export type Audience = {
  id: string;
  name: string;
  rules: SegmentRule[];
  createdAt: string; // ISO string
  description?: string; // Optional description, possibly from NLP
};

export type Campaign = {
  id:string;
  name: string;
  audienceId: string; // ID of the Audience
  audienceName: string; // Name of the Audience
  audienceSize: number;
  createdAt: string; // ISO string
  status: 'Sent' | 'Failed' | 'Pending' | 'Draft';
  sentCount: number;
  failedCount: number;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};
