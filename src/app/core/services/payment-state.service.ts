import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map, switchMap } from 'rxjs/operators';
import { RazorpayService } from './razorpay.service';
import { AuthService } from './auth.service';
import { AppStateService } from './app-state.service';
import { ApiService } from './api.service';
import { PaymentAttempt, PaymentMethod, PaymentVerification } from '../models/razorpay.models';
import { Order } from '../models/order';

export enum PaymentState {
  IDLE = 'idle',
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  VERIFYING = 'verifying',
  CONFIRMING = 'confirming'
}

export interface PaymentSession {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  state: PaymentState;
  attempt?: PaymentAttempt;
  order?: Order;
  customerDetails: {
    name: string;
    email: string;
    contact: string;
    addressId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
  metadata?: any;
}

export interface OrderPlacementRequest {
  items: any[];
  customerDetails: {
    name: string;
    email: string;
    contact: string;
    addressId?: string;
  };
  paymentMethod: PaymentMethod;
  amount: number;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentStateService {
  private readonly razorpayService = inject(RazorpayService);
  private readonly authService = inject(AuthService);
  private readonly appState = inject(AppStateService);
  private readonly apiService = inject(ApiService);

  private readonly paymentSessions = new Map<string, PaymentSession>();
  private readonly currentSessionSubject = new BehaviorSubject<PaymentSession | null>(null);
  private readonly paymentHistorySubject = new BehaviorSubject<PaymentSession[]>([]);

  // Observables
  readonly currentSession$ = this.currentSessionSubject.asObservable();
  readonly paymentHistory$ = this.paymentHistorySubject.asObservable();

  /**
   * Get current payment session
   */
  getCurrentSession(): PaymentSession | null {
    return this.currentSessionSubject.value;
  }

  /**
   * Start a new payment session
   */
  startPaymentSession(request: OrderPlacementRequest): PaymentSession {
    const sessionId = this.generateSessionId();
    const user = this.authService.user();
    
    const session: PaymentSession = {
      id: sessionId,
      orderId: `ORD_${Date.now()}`,
      amount: request.amount,
      currency: 'INR',
      state: PaymentState.IDLE,
      customerDetails: request.customerDetails,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      metadata: {
        ...request.metadata,
        items: request.items,
        paymentMethod: request.paymentMethod,
        userId: user?.id,
        sessionStartTime: new Date().toISOString()
      }
    };

    this.paymentSessions.set(sessionId, session);
    this.currentSessionSubject.next(session);
    this.updatePaymentHistory();

    return session;
  }

  /**
   * Initiate payment process
   */
  initiatePayment(): Observable<{ success: boolean; error?: any }> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active payment session');
    }

    this.updateSessionState(session.id, PaymentState.INITIATED);

    const paymentRequest = {
      amount: session.amount,
      currency: session.currency,
      orderId: session.orderId,
      description: `Order ${session.orderId} from Homeopathy Store`,
      notes: {
        sessionId: session.id,
        userId: session.metadata.userId,
        itemCount: session.metadata.items.length
      },
      customerDetails: session.customerDetails
    };

    return this.razorpayService.initiatePayment(paymentRequest).pipe(
      tap(result => {
        if (result.success) {
          this.updateSessionState(session.id, PaymentState.PROCESSING);
        } else {
          this.updateSessionState(session.id, PaymentState.FAILED);
          if (result.error) {
            session.metadata.lastError = result.error;
          }
        }
      })
    );
  }

  /**
   * Confirm payment and create order
   */
  confirmOrder(): Observable<{ success: boolean; orderId?: string; error?: any }> {
    const session = this.getCurrentSession();
    if (!session) {
      return new Observable(observer => {
        observer.next({ success: false, error: 'No active payment session' });
        observer.complete();
      });
    }

    this.updateSessionState(session.id, PaymentState.CONFIRMING);

    const orderPayload = this.createOrderPayload(session);
    
    return this.apiService.placeOrder(orderPayload).pipe(
      tap(response => {
        if (response) {
          session.order = response;
          this.updateSessionState(session.id, PaymentState.SUCCESS);
          this.clearCart();
        } else {
          this.updateSessionState(session.id, PaymentState.FAILED);
        }
      }),
      map(response => ({
        success: !!response,
        orderId: response?.id,
        error: response ? undefined : 'Failed to create order'
      }))
    );
  }

  /**
   * Verify payment and complete order placement
   */
  verifyAndCompleteOrder(paymentVerification: PaymentVerification): Observable<{ success: boolean; orderId?: string }> {
    const session = this.getCurrentSession();
    if (!session) {
      return of({ success: false });
    }

    this.updateSessionState(session.id, PaymentState.VERIFYING);

    return this.razorpayService.verifyPayment(paymentVerification).pipe(
      switchMap((isVerified: boolean) => {
        if (isVerified) {
          return this.confirmOrder();
        } else {
          this.updateSessionState(session.id, PaymentState.FAILED);
          return of({ success: false, orderId: undefined });
        }
      })
    );
  }

  /**
   * Cancel current payment session
   */
  cancelPaymentSession(reason?: string): Observable<void> {
    const session = this.getCurrentSession();
    if (session) {
      this.updateSessionState(session.id, PaymentState.CANCELLED);
      if (reason) {
        session.metadata.cancellationReason = reason;
      }
      this.currentSessionSubject.next(null);
      this.updatePaymentHistory();
    }
    return of(void 0);
  }

  /**
   * Retry payment
   */
  retryPayment(): Observable<{ success: boolean; error?: any }> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active payment session');
    }

    session.retryCount++;
    session.updatedAt = new Date();
    this.updateSessionState(session.id, PaymentState.IDLE);

    return this.initiatePayment();
  }

  /**
   * Get payment sessions for user
   */
  getUserPaymentSessions(userId: string): PaymentSession[] {
    return Array.from(this.paymentSessions.values())
      .filter(session => session.metadata.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get payment session by ID
   */
  getPaymentSession(sessionId: string): PaymentSession | undefined {
    return this.paymentSessions.get(sessionId);
  }

  /**
   * Update session state
   */
  private updateSessionState(sessionId: string, state: PaymentState): void {
    const session = this.paymentSessions.get(sessionId);
    if (session) {
      session.state = state;
      session.updatedAt = new Date();
      this.paymentSessions.set(sessionId, session);
      
      if (this.currentSessionSubject.value?.id === sessionId) {
        this.currentSessionSubject.next(session);
      }
      
      this.updatePaymentHistory();
    }
  }

  /**
   * Create order payload from session
   */
  private createOrderPayload(session: PaymentSession): any {
    const user = this.authService.user();
    
    return {
      userId: user?.id,
      name: session.customerDetails.name,
      email: session.customerDetails.email,
      address_id: session.customerDetails.addressId || 0,
      items: session.metadata.items.map((item: any) => ({
        ...item,
        rating: 0
      })),
      subtotal: this.calculateSubtotal(session.metadata.items),
      gst: 0,
      tax: 0,
      shipping: this.calculateShipping(session.metadata.items),
      total: session.amount,
      status: 'processing',
      createdAt: new Date().toISOString(),
      placed_on: new Date().toISOString(),
      createdBy: user?.id,
      paymentSessionId: session.id,
      paymentMethod: session.metadata.paymentMethod
    };
  }

  /**
   * Calculate subtotal from items
   */
  private calculateSubtotal(items: any[]): number {
    return items.reduce((sum, item) => {
      const price = item.finalPrice || item.purchasePrice || item.price || 0;
      return sum + (price * item.quantity);
    }, 0);
  }

  /**
   * Calculate shipping from items
   */
  private calculateShipping(items: any[]): number {
    return items.reduce((sum, item) => sum + (item.shipping_charges || 0), 0);
  }

  /**
   * Clear cart after successful order
   */
  private clearCart(): void {
    this.appState.clearCart();
  }

  /**
   * Update payment history
   */
  private updatePaymentHistory(): void {
    const sessions = Array.from(this.paymentSessions.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    this.paymentHistorySubject.next(sessions);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `PAY_SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  cleanupOldSessions(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [sessionId, session] of this.paymentSessions.entries()) {
      if (session.createdAt < cutoff && session.state !== PaymentState.PROCESSING) {
        this.paymentSessions.delete(sessionId);
      }
    }

    this.updatePaymentHistory();
  }
}