import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { PaymentAttempt, RazorpayPayment, RazorpayOrder } from '../models/razorpay.models';
import { Transaction } from '../models/order';

export interface EnhancedTransaction extends Transaction {
  // Razorpay-specific fields
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  razorpayFee?: number;
  razorpayTax?: number;
  razorpayErrorCode?: string;
  razorpayErrorDescription?: string;
  
  // Additional metadata
  paymentMethodType?: string; // card, netbanking, wallet, upi, etc.
  cardLast4?: string;
  cardBrand?: string;
  bankName?: string;
  vpa?: string;
  wallet?: string;
  
  // Payment flow tracking
  paymentFlow: 'initiated' | 'pending' | 'success' | 'failed' | 'cancelled' | 'refunded' | 'disputed';
  retryCount: number;
  sessionId?: string;
  
  // Customer details at time of payment
  customerDetails?: {
    name: string;
    email: string;
    contact: string;
  };
  
  // Audit trail
  auditLog: AuditEntry[];
  
  // Timing
  paymentInitiatedAt?: string;
  paymentCompletedAt?: string;
  paymentFailedAt?: string;
  paymentRefundedAt?: string;
  
  // Additional context
  context?: {
    userAgent?: string;
    ipAddress?: string;
    deviceInfo?: string;
    location?: string;
  };
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface TransactionQuery {
  userId?: string;
  orderId?: string;
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  private readonly transactionsSubject = new BehaviorSubject<EnhancedTransaction[]>([]);
  private readonly currentTransactionSubject = new BehaviorSubject<EnhancedTransaction | null>(null);

  // Observables
  readonly transactions$ = this.transactionsSubject.asObservable();
  readonly currentTransaction$ = this.currentTransactionSubject.asObservable();

  /**
   * Create a new transaction record
   */
  createTransaction(transactionData: Partial<EnhancedTransaction>): Observable<EnhancedTransaction> {
    const user = this.authService.user();
    const baseTransaction: Partial<EnhancedTransaction> = {
      ...transactionData,
      id: this.generateTransactionId(),
      createdAt: new Date().toISOString(),
      createdBy: user?.id || 'system',
      auditLog: [{
        id: this.generateAuditId(),
        timestamp: new Date().toISOString(),
        action: 'transaction_created',
        actor: user?.id || 'system',
        details: transactionData
      }],
      retryCount: 0,
      paymentFlow: 'initiated'
    };

    return this.apiService.createTransaction(baseTransaction).pipe(
      tap((created: Transaction) => {
        const enhanced = { ...created, ...baseTransaction } as EnhancedTransaction;
        this.addToTransaction(enhanced);
        this.currentTransactionSubject.next(enhanced);
        this.logAudit(enhanced.id, 'transaction_created', user?.id || 'system', transactionData);
      }),
      map(response => ({ ...response, ...baseTransaction } as EnhancedTransaction))
    );
  }

  /**
   * Update transaction with Razorpay details
   */
  updateTransactionWithRazorpayData(
    transactionId: string, 
    razorpayOrder: RazorpayOrder, 
    razorpayPayment?: RazorpayPayment
  ): Observable<EnhancedTransaction> {
    const user = this.authService.user();
    
    // First get the existing transaction
    return this.getTransaction(transactionId).pipe(
      map(existing => {
        if (!existing) {
          throw new Error('Transaction not found');
        }
        return existing;
      }),
      switchMap(existing => {
        const updateData: Partial<EnhancedTransaction> = {
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount / 100, // Convert from paise
          status: this.mapRazorpayStatus(razorpayOrder.status),
          paymentFlow: razorpayOrder.status === 'created' ? 'initiated' : 'pending',
          paymentInitiatedAt: new Date(razorpayOrder.created_at * 1000).toISOString()
        };

        // Add payment-specific details if payment is available
        if (razorpayPayment) {
          updateData.razorpayPaymentId = razorpayPayment.id;
          updateData.razorpayFee = razorpayPayment.fee;
          updateData.razorpayTax = razorpayPayment.tax;
          updateData.paymentMethodType = razorpayPayment.method;
          updateData.status = this.mapRazorpayStatus(razorpayPayment.status);
          updateData.paymentFlow = this.mapPaymentFlow(razorpayPayment.status);
          
          // Add method-specific details
          if (razorpayPayment.card_id) {
            updateData.cardLast4 = razorpayPayment.card_id.slice(-4);
            // You can decode card brand from card_id if needed
          } else if (razorpayPayment.bank) {
            updateData.bankName = razorpayPayment.bank;
          } else if (razorpayPayment.wallet) {
            updateData.wallet = razorpayPayment.wallet;
          } else if (razorpayPayment.vpa) {
            updateData.vpa = razorpayPayment.vpa;
          }

          // Add error details if payment failed
          if (razorpayPayment.error_code) {
            updateData.razorpayErrorCode = razorpayPayment.error_code;
            updateData.razorpayErrorDescription = razorpayPayment.error_description;
            updateData.paymentFailedAt = new Date(razorpayPayment.created_at * 1000).toISOString();
          }
        }

        // Update the transaction
        return this.apiService.updateOrder(transactionId, updateData as any).pipe(
          map(updated => ({ ...updated, ...updateData } as EnhancedTransaction))
        );
      })
    );
  }

  /**
   * Update transaction status
   */
  updateTransactionStatus(
    transactionId: string, 
    status: string, 
    flow: EnhancedTransaction['paymentFlow'],
    details?: any
  ): Observable<EnhancedTransaction> {
    const user = this.authService.user();
    const updateData: Partial<EnhancedTransaction> = {
      status: status as any,
      paymentFlow: flow,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.id || 'system'
    };

    // Add timestamp based on flow
    if (flow === 'success') {
      updateData.paymentCompletedAt = new Date().toISOString();
    } else if (flow === 'failed') {
      updateData.paymentFailedAt = new Date().toISOString();
    }

    return this.updateTransaction(transactionId, updateData).pipe(
      tap(updated => {
        this.logAudit(transactionId, 'status_updated', user?.id || 'system', {
          oldStatus: updated.status,
          newStatus: status,
          flow,
          details
        });
      })
    );
  }

  /**
   * Record payment attempt
   */
  recordPaymentAttempt(
    transactionId: string, 
    attempt: PaymentAttempt,
    additionalDetails?: any
  ): Observable<EnhancedTransaction> {
    const user = this.authService.user();
    
    return this.getTransaction(transactionId).pipe(
      map(transaction => {
        if (!transaction) {
          throw new Error('Transaction not found');
        }
        return transaction;
      }),
      switchMap(transaction => {
        const retryCount = (transaction.retryCount || 0) + 1;
        const updateData: Partial<EnhancedTransaction> = {
          retryCount,
          paymentFlow: attempt.status === 'success' ? 'success' : 
                     attempt.status === 'failed' ? 'failed' : 'pending',
          auditLog: [
            ...transaction.auditLog,
            {
              id: this.generateAuditId(),
              timestamp: new Date().toISOString(),
              action: 'payment_attempt',
              actor: user?.id || 'system',
              details: {
                attemptId: attempt.id,
                attemptStatus: attempt.status,
                retryCount,
                ...additionalDetails
              }
            }
          ]
        };

        // Add error details if attempt failed
        if (attempt.status === 'failed' && attempt.errorDescription) {
          updateData.razorpayErrorDescription = attempt.errorDescription;
          updateData.razorpayErrorCode = attempt.errorCode;
        }

        return this.updateTransaction(transactionId, updateData);
      })
    );
  }

  /**
   * Process refund
   */
  processRefund(
    transactionId: string, 
    refundAmount?: number, 
    reason?: string
  ): Observable<EnhancedTransaction> {
    const user = this.authService.user();
    
    return this.updateTransactionStatus(transactionId, 'refunded', 'refunded', {
      refundAmount,
      reason,
      refundRequestedBy: user?.id
    }).pipe(
      tap(updated => {
        this.logAudit(transactionId, 'refund_processed', user?.id || 'system', {
          refundAmount,
          reason,
          previousStatus: updated.status
        });
      })
    );
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): Observable<EnhancedTransaction | null> {
    return this.apiService.getTransactions().pipe(
      map(transactions => (transactions as EnhancedTransaction[]).find(t => t.id === transactionId) || null),
      tap(transaction => {
        if (transaction) {
          this.currentTransactionSubject.next(transaction);
        }
      })
    );
  }

  /**
   * Get transactions with filtering
   */
  getTransactions(query: TransactionQuery = {}): Observable<EnhancedTransaction[]> {
    return this.apiService.getTransactions().pipe(
      map(response => {
        let transactions = (response as EnhancedTransaction[]) || [];
        // Apply client-side filtering since API doesn't support query params
        if (query.userId) {
          transactions = transactions.filter(t => t.createdBy === query.userId);
        }
        if (query.status) {
          transactions = transactions.filter(t => t.status === query.status);
        }
        if (query.orderId) {
          transactions = transactions.filter(t => t.orderId === query.orderId);
        }
        return transactions;
      }),
      tap(transactions => {
        this.transactionsSubject.next(transactions);
      })
    );
  }

  /**
   * Get transactions by user ID
   */
  getUserTransactions(userId?: string): Observable<EnhancedTransaction[]> {
    const actualUserId = userId || this.authService.user()?.id;
    if (!actualUserId) {
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }

    return this.getTransactions({ userId: actualUserId });
  }

  /**
   * Get transaction statistics
   */
  getTransactionStats(userId?: string): Observable<{
    total: number;
    successful: number;
    failed: number;
    pending: number;
    totalAmount: number;
    averageAmount: number;
  }> {
    return this.getUserTransactions(userId).pipe(
      map(transactions => {
        const total = transactions.length;
        const successful = transactions.filter(t => t.status === 'success').length;
        const failed = transactions.filter(t => t.status === 'failed').length;
        const pending = transactions.filter(t => t.status === 'pending').length;
        const totalAmount = transactions
          .filter(t => t.status === 'success')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        const averageAmount = successful > 0 ? totalAmount / successful : 0;

        return {
          total,
          successful,
          failed,
          pending,
          totalAmount,
          averageAmount
        };
      })
    );
  }

  /**
   * Export transactions
   */
  exportTransactions(
    format: 'csv' | 'excel' | 'pdf',
    query: TransactionQuery = {}
  ): Observable<Blob> {
    return this.getTransactions(query).pipe(
      map(transactions => {
        switch (format) {
          case 'csv':
            return this.exportToCSV(transactions);
          case 'excel':
            return this.exportToExcel(transactions);
          case 'pdf':
            return this.exportToPDF(transactions);
          default:
            throw new Error('Unsupported format');
        }
      })
    );
  }

  /**
   * Log audit entry
   */
  logAudit(
    transactionId: string, 
    action: string, 
    actor: string, 
    details: any,
    context?: { ipAddress?: string; userAgent?: string }
  ): void {
    const auditEntry: AuditEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      action,
      actor,
      details,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    };

    // In a real implementation, you would send this to your audit logging service
    console.log('Transaction Audit:', { transactionId, ...auditEntry });
  }

  // Private methods

  private updateTransaction(transactionId: string, updateData: Partial<EnhancedTransaction>): Observable<EnhancedTransaction> {
    return this.apiService.updateTransaction(transactionId, updateData).pipe(
      map(response => response as EnhancedTransaction),
      tap(updated => {
        // Update local state
        const transactions = this.transactionsSubject.value;
        const index = transactions.findIndex(t => t.id === transactionId);
        if (index !== -1) {
          transactions[index] = updated;
          this.transactionsSubject.next([...transactions]);
        }
        this.currentTransactionSubject.next(updated);
      })
    );
  }

  private addToTransaction(transaction: EnhancedTransaction): void {
    const transactions = this.transactionsSubject.value;
    const existingIndex = transactions.findIndex(t => t.id === transaction.id);
    
    if (existingIndex !== -1) {
      transactions[existingIndex] = transaction;
    } else {
      transactions.unshift(transaction);
    }
    
    this.transactionsSubject.next([...transactions]);
  }

  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `AUD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapRazorpayStatus(razorpayStatus: string): Transaction['status'] {
    switch (razorpayStatus?.toLowerCase()) {
      case 'captured':
      case 'authorized':
        return 'success';
      case 'failed':
        return 'failed';
      case 'pending':
        return 'pending';
      case 'refunded':
        return 'refunded';
      default:
        return 'pending';
    }
  }

  private mapPaymentFlow(razorpayStatus: string): EnhancedTransaction['paymentFlow'] {
    switch (razorpayStatus?.toLowerCase()) {
      case 'captured':
      case 'authorized':
        return 'success';
      case 'failed':
        return 'failed';
      case 'pending':
        return 'pending';
      default:
        return 'initiated';
    }
  }

  private exportToCSV(transactions: EnhancedTransaction[]): Blob {
    const headers = [
      'Transaction ID',
      'Order ID',
      'Amount',
      'Status',
      'Payment Method',
      'Created At',
      'Completed At',
      'Customer Email',
      'Razorpay Order ID',
      'Razorpay Payment ID'
    ];

    const csvContent = [
      headers.join(','),
      ...transactions.map(t => [
        t.id,
        t.orderId,
        t.amount,
        t.status,
        t.paymentMethodType || '',
        t.createdAt,
        t.paymentCompletedAt || '',
        t.customerDetails?.email || '',
        t.razorpayOrderId || '',
        t.razorpayPaymentId || ''
      ].join(','))
    ].join('\n');

    return new Blob([csvContent], { type: 'text/csv' });
  }

  private exportToExcel(transactions: EnhancedTransaction[]): Blob {
    // In a real implementation, you would use a library like ExcelJS
    // For now, we'll return a CSV with .xlsx extension
    return this.exportToCSV(transactions);
  }

  private exportToPDF(transactions: EnhancedTransaction[]): Blob {
    // In a real implementation, you would use a library like jsPDF
    const content = transactions.map(t => 
      `Transaction: ${t.id}\nAmount: ₹${t.amount}\nStatus: ${t.status}\nDate: ${t.createdAt}\n`
    ).join('\n---\n\n');

    return new Blob([content], { type: 'text/plain' });
  }
}