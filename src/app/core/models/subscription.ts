export interface Subscription {
  id: number;
  name: string;
  type : string;
  price: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  duration: 'monthly' | 'yearly';
  benefits: string[];
  limitations: string[];
  description: string;
  popular?: boolean;
}

export interface SubscriptionCartItem extends Subscription {
  quantity: number;
  serverId?: string;
  itemPrice?: number; // original price
  discountAmount?: number;
  purchasePrice?: number; // final price after discount
}