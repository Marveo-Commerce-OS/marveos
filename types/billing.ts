export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export interface SubscriptionModel {
  id: string;
  tenantId: string;
  planId: string;
  interval: BillingInterval;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  paymentVerificationStatus?: 'NOT_REQUIRED' | 'PENDING' | 'FAILED' | 'SANDBOX_VERIFIED' | 'VERIFIED';
}
