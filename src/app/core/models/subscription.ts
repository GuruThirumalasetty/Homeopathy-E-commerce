export interface Subscription {
  id: number;
  name: string;
  type : string;
  price: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
  duration: 'monthly' | 'yearly';
  features: features[];
  // limitations: string[];
  description: string;
  popular?: boolean;
}

export interface features {
  id: number;
  name: string;
  status: number;
  mode: number;
}

export interface SubscriptionCartItem extends Subscription {
  quantity: number;
  serverId?: string;
  itemPrice?: number; // original price
  discountAmount?: number;
  purchasePrice?: number; // final price after discount
}