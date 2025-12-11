import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, from, throwError, of, timer } from 'rxjs';
import { catchError, map, switchMap, tap, retry, timeout } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { 
  RazorpayConfig, 
  RazorpayOrder, 
  RazorpayPayment, 
  RazorpayResponse, 
  RazorpayError, 
  PaymentOptions, 
  PaymentAttempt, 
  PaymentMethod,
  PaymentVerification 
} from '../models/razorpay.models';

declare global {
  interface Window {
    Razorpay: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  private readonly config: RazorpayConfig = {
    key_id: 'rzp_test_RXcOaqiKNtlddd', // Your test key
    key_secret: 'mpnbzVmBvlxl2azuYiDh8J64', // Your test secret
    environment: 'test',
    currency: 'INR',
    timeout: 300000 // 5 minutes
  };

  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private paymentAttempts = new Map<string, PaymentAttempt>();
  private paymentSubject = new BehaviorSubject<PaymentAttempt | null>(null);

  // Observable for payment status updates
  readonly paymentStatus$ = this.paymentSubject.asObservable();
  
  // Test card details for different scenarios
  readonly testCards = {
    success: {
      cardNumber: '4111111111111111',
      expiry: '12/34',
      cvv: '123',
      name: 'Test Card'
    },
    failure: {
      cardNumber: '4000000000000002',
      expiry: '12/34', 
      cvv: '123',
      name: 'Test Card'
    },
    insufficientFunds: {
      cardNumber: '4000000000009995',
      expiry: '12/34',
      cvv: '123', 
      name: 'Test Card'
    },
    cancelled: {
      cardNumber: '4000000000000119',
      expiry: '12/34',
      cvv: '123',
      name: 'Test Card'
    }
  };

  constructor() {
    this.loadRazorpaySDK();
  }

  /**
   * Load Razorpay SDK dynamically
   */
  private loadRazorpaySDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Create Razorpay order on the server
   */
  createOrder(amount: number, currency: string = 'INR', receipt?: string): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>(`${this.baseUrl}/orders`, {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1
    }).pipe(
      timeout(this.config.timeout),
      retry(3),
      catchError(this.handleError('createOrder'))
    );
  }

  /**
   * Initialize Razorpay payment
   */
  initiatePayment(
    orderData: {
      amount: number;
      currency?: string;
      orderId?: string;
      description?: string;
      notes?: any;
      customerDetails: {
        name: string;
        email: string;
        contact: string;
      };
    }
  ): Observable<{ success: boolean; paymentId?: string; error?: RazorpayError }> {
    const paymentId = this.generatePaymentId();
    
    return new Observable(observer => {
      this.createOrder(orderData.amount, orderData.currency).subscribe({
        next: (razorpayOrder) => {
          const paymentOptions: PaymentOptions = {
            key: this.config.key_id,
            amount: orderData.amount * 100,
            currency: orderData.currency || this.config.currency,
            name: 'Homeopathy E-commerce',
            description: orderData.description || 'Purchase from Homeopathy Store',
            order_id: razorpayOrder.id,
            prefill: {
              name: orderData.customerDetails.name,
              email: orderData.customerDetails.email,
              contact: orderData.customerDetails.contact
            },
            notes: orderData.notes || {},
            theme: {
              color: '#3498db',
              hide_topbar: false
            },
            modal: {
              ondismiss: () => {
                this.handlePaymentCancellation(paymentId, 'User closed the payment modal');
                observer.next({ success: false });
                observer.complete();
              },
              confirm_close: true,
              animation: true
            },
            redirect: false,
            handler: (response: RazorpayResponse) => {
              this.handlePaymentSuccess(response, paymentId, razorpayOrder.id, orderData.amount);
              observer.next({ 
                success: true, 
                paymentId: response.razorpay_payment_id 
              });
              observer.complete();
            }
          };

          try {
            const rzp = new window.Razorpay(paymentOptions);
            
            // Create payment attempt record
            this.createPaymentAttempt(paymentId, orderData, razorpayOrder.id);
            
            rzp.open();
          } catch (error) {
            this.handlePaymentError(paymentId, {
              code: 'INITIATION_FAILED',
              description: 'Failed to initiate payment',
              source: 'client',
              step: 'payment_initiation',
              reason: error instanceof Error ? error.message : 'Unknown error'
            });
            observer.next({ success: false, error: error as RazorpayError });
            observer.complete();
          }
        },
        error: (error) => {
          this.handlePaymentError(paymentId, {
            code: 'ORDER_CREATION_FAILED',
            description: 'Failed to create payment order',
            source: 'server',
            step: 'order_creation',
            reason: error.message
          });
          observer.next({ success: false, error });
          observer.complete();
        }
      });
    });
  }

  /**
   * Verify payment signature
   */
  verifyPayment(paymentVerification: PaymentVerification): Observable<boolean> {
    return this.http.post<{ verified: boolean }>(`/api/payments/verify`, {
      order_id: paymentVerification.orderId,
      payment_id: paymentVerification.paymentId,
      signature: paymentVerification.signature,
      amount: paymentVerification.amount,
      currency: paymentVerification.currency
    }).pipe(
      map(response => response.verified),
      catchError(this.handleError('verifyPayment'))
    );
  }

  /**
   * Get payment details
   */
  getPaymentDetails(paymentId: string): Observable<RazorpayPayment> {
    return this.http.get<RazorpayPayment>(`${this.baseUrl}/payments/${paymentId}`).pipe(
      timeout(this.config.timeout),
      retry(2),
      catchError(this.handleError('getPaymentDetails'))
    );
  }

  /**
   * Refund payment
   */
  refundPayment(paymentId: string, amount?: number, speed?: string): Observable<any> {
    const refundData: any = { payment_id: paymentId };
    
    if (amount) refundData.amount = amount * 100; // Convert to paise
    if (speed) refundData.speed = speed;

    return this.http.post(`${this.baseUrl}/refunds`, refundData).pipe(
      timeout(this.config.timeout),
      catchError(this.handleError('refundPayment'))
    );
  }

  /**
   * Get payment attempts for an order
   */
  getPaymentAttempts(orderId: string): PaymentAttempt[] {
    return Array.from(this.paymentAttempts.values())
      .filter(attempt => attempt.orderId === orderId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Handle webhook events
   */
  handleWebhookEvent(webhookData: any): void {
    console.log('Razorpay Webhook Event:', webhookData);
    
    switch (webhookData.event) {
      case 'payment.authorized':
        this.handlePaymentAuthorized(webhookData.payload);
        break;
      case 'payment.failed':
        this.handlePaymentFailed(webhookData.payload);
        break;
      case 'payment.captured':
        this.handlePaymentCaptured(webhookData.payload);
        break;
      case 'payment.refunded':
        this.handlePaymentRefunded(webhookData.payload);
        break;
      default:
        console.log('Unhandled webhook event:', webhookData.event);
    }
  }

  // Private methods

  private generatePaymentId(): string {
    return `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createPaymentAttempt(
    paymentId: string, 
    orderData: any, 
    razorpayOrderId: string
  ): void {
    const attempt: PaymentAttempt = {
      id: paymentId,
      orderId: orderData.orderId || 'pending',
      razorpayOrderId,
      amount: orderData.amount,
      currency: orderData.currency || this.config.currency,
      method: orderData.method,
      status: 'initiated',
      startedAt: new Date(),
      retryCount: 0,
      metadata: orderData
    };

    this.paymentAttempts.set(paymentId, attempt);
    this.paymentSubject.next(attempt);
  }

  private handlePaymentSuccess(
    response: RazorpayResponse, 
    paymentId: string, 
    razorpayOrderId: string,
    amount: number
  ): void {
    const attempt = this.paymentAttempts.get(paymentId);
    if (attempt) {
      attempt.razorpayPaymentId = response.razorpay_payment_id;
      attempt.status = 'success';
      attempt.completedAt = new Date();
      this.paymentAttempts.set(paymentId, attempt);
      this.paymentSubject.next(attempt);
    }

    // Verify payment signature
    const verification: PaymentVerification = {
      orderId: razorpayOrderId,
      paymentId: response.razorpay_payment_id,
      signature: response.razorpay_signature,
      amount,
      currency: this.config.currency,
      timestamp: new Date()
    };

    this.verifyPayment(verification).subscribe({
      next: (isVerified) => {
        if (isVerified) {
          this.notifications.notify('Payment successful! Order confirmed.', 'success');
        } else {
          this.notifications.notify('Payment verification failed. Please contact support.', 'error');
          this.handlePaymentError(paymentId, {
            code: 'VERIFICATION_FAILED',
            description: 'Payment signature verification failed',
            source: 'server',
            step: 'payment_verification',
            reason: 'Invalid signature'
          });
        }
      },
      error: () => {
        this.notifications.notify('Payment verification failed. Please contact support.', 'error');
      }
    });
  }

  private handlePaymentCancellation(paymentId: string, reason: string): void {
    const attempt = this.paymentAttempts.get(paymentId);
    if (attempt) {
      attempt.status = 'cancelled';
      attempt.completedAt = new Date();
      this.paymentAttempts.set(paymentId, attempt);
      this.paymentSubject.next(attempt);
    }
    
    this.notifications.notify('Payment cancelled', 'warning');
  }

  private handlePaymentError(paymentId: string, error: RazorpayError): void {
    const attempt = this.paymentAttempts.get(paymentId);
    if (attempt) {
      attempt.status = 'error';
      attempt.errorCode = error.code;
      attempt.errorDescription = error.description;
      attempt.completedAt = new Date();
      this.paymentAttempts.set(paymentId, attempt);
      this.paymentSubject.next(attempt);
    }

    this.notifications.notify(`Payment failed: ${error.description}`, 'error');
    console.error('Razorpay Payment Error:', error);
  }

  private handlePaymentAuthorized(payload: any): void {
    console.log('Payment authorized:', payload);
  }

  private handlePaymentFailed(payload: any): void {
    console.log('Payment failed:', payload);
    this.notifications.notify('Payment failed. Please try again.', 'error');
  }

  private handlePaymentCaptured(payload: any): void {
    console.log('Payment captured:', payload);
    this.notifications.notify('Payment captured successfully!', 'success');
  }

  private handlePaymentRefunded(payload: any): void {
    console.log('Payment refunded:', payload);
    this.notifications.notify('Payment refunded successfully.', 'info');
  }

  private handleError(operation: string) {
    return (error: any): Observable<never> => {
      console.error(`Razorpay ${operation} error:`, error);
      
      let message = 'An error occurred';
      if (error.status === 0) {
        message = 'Network error. Please check your connection.';
      } else if (error.status >= 400 && error.status < 500) {
        message = error.error?.error?.description || 'Client error occurred';
      } else if (error.status >= 500) {
        message = 'Server error occurred. Please try again later.';
      }

      this.notifications.notify(message, 'error');
      return throwError(() => new Error(message));
    };
  }

  // Utility methods for testing

  /**
   * Get test payment methods for different scenarios
   */
  getTestPaymentMethods(): Record<string, any> {
    return this.testCards;
  }

  /**
   * Simulate different payment scenarios for testing
   */
  simulatePaymentScenario(scenario: 'success' | 'failure' | 'insufficientFunds' | 'cancelled'): any {
    return this.testCards[scenario];
  }

  /**
   * Check if running in test environment
   */
  isTestEnvironment(): boolean {
    return this.config.environment === 'test';
  }
}