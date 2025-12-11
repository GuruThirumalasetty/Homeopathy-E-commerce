export interface RazorpayConfig {
  key_id: string;
  key_secret: string;
  environment: 'test' | 'production';
  currency: string;
  timeout: number;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
  notes: any;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id: string;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: string;
  captured: boolean;
  description: string;
  card_id: string;
  bank: string;
  wallet: string;
  vpa: string;
  email: string;
  contact: string;
  notes: any;
  fee: number;
  tax: number;
  error_code: string;
  error_description: string;
  created_at: number;
}

export interface RazorpayRefund {
  id: string;
  entity: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  speed: string;
  speed_requested: string;
  receipt: string;
  created_at: number;
}

export interface PaymentOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: any;
  theme: {
    color?: string;
    hide_topbar?: boolean;
  };
  modal: {
    ondismiss?: () => void;
    confirm_close?: boolean;
    animation?: boolean;
  };
  redirect?: boolean;
  readonly?: {
    contact?: boolean;
    email?: boolean;
    name?: boolean;
  };
  handler?: (response: RazorpayResponse) => void;
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_order_id_old?: string;
  razorpay_subscription_id?: string;
}

export interface RazorpayError {
  code: string;
  description: string;
  source: string;
  step: string;
  reason: string;
  field_id?: string;
}

export type PaymentMethod = 'card' | 'netbanking' | 'wallet' | 'upi' | 'emi' | 'paylater';

export interface PaymentAttempt {
  id: string;
  orderId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  method?: PaymentMethod;
  status: 'initiated' | 'pending' | 'success' | 'failed' | 'cancelled' | 'error';
  errorCode?: string;
  errorDescription?: string;
  startedAt: Date;
  completedAt?: Date;
  retryCount: number;
  metadata?: any;
}

export interface PaymentVerification {
  orderId: string;
  paymentId: string;
  signature: string;
  amount: number;
  currency: string;
  timestamp: Date;
}

export interface PaymentWebhook {
  entity: string;
  contains: string[];
  trigger: string;
  occurs_at: number;
  source: string;
  summary?: string;
  created_at: number;
}