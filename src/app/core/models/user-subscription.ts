export interface UserSubscription {
  id: number;
  userId: string;
  userName: string;
  userEmail: string;
  subscriptionId: number;
  subscriptionName: string;
  purchasedPrice: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  renewalInfo?: {
    autoRenew: boolean;
    nextRenewalDate?: string;
  };
  createdAt: string;
  updatedAt?: string;
}