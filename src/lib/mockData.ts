
import type { Campaign, Audience } from "@/types";

export const MOCK_AUDIENCES: Audience[] = [
  { id: 'aud1', name: 'High Spenders', rules: [], createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'aud2', name: 'Recent Signups', rules: [], createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'aud3', name: 'Inactive > 6m', rules: [], createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString() },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  { 
    id: 'camp1', 
    name: 'Summer Sale Q3', 
    audienceId: 'aud1',
    audienceName: 'High Spenders', 
    audienceSize: 1200, 
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 
    status: 'Sent', 
    sentCount: 1150, 
    failedCount: 50 
  },
  { 
    id: 'camp2', 
    name: 'New Arrivals - Fall Collection', 
    audienceId: 'aud2',
    audienceName: 'Recent Signups', 
    audienceSize: 500, 
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 
    status: 'Sent', 
    sentCount: 480, 
    failedCount: 20 
  },
  { 
    id: 'camp3', 
    name: 'Win-back Inactive Users', 
    audienceId: 'aud3',
    audienceName: 'Inactive > 6m', 
    audienceSize: 750, 
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), 
    status: 'Failed', 
    sentCount: 0, 
    failedCount: 750 
  },
  { 
    id: 'camp4', 
    name: 'Holiday Early Bird Discount', 
    audienceId: 'aud1',
    audienceName: 'High Spenders', 
    audienceSize: 1100, 
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), 
    status: 'Draft', 
    sentCount: 0, 
    failedCount: 0 
  },
];
