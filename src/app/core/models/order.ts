import { CartItem } from './product';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  name ?: string;
  items: CartItem[];
  subtotal: number;
  gst ?: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  placed_on ?: string,
  shipped_on ?: string,
  delivered_on ?: string,
  createdAt: string;
  createdBy: string | string;
  updatedAt?: string;
  updatedBy?: string | string;
  deliveryDate?: string;
  address_id: string;
  email: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  status: 'success' | 'failed' | 'pending' | 'refunded';
  method: 'card' | 'upi' | 'netbanking' | 'wallet';
  createdAt: string;
}
export interface Charges {
  gst : number;
  shipping_charges : number;
}

