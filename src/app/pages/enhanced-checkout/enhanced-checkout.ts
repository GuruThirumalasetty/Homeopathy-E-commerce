import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppStateService } from '../../core/services/app-state.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { RazorpayService } from '../../core/services/razorpay.service';
import { PaymentStateService, PaymentState } from '../../core/services/payment-state.service';
import { ApiService } from '../../core/services/api.service';
import { Address } from '../../core/models/address';
import { PaymentMethod } from '../../core/models/razorpay.models';
import { common_response } from '../../core/models/common_response';

@Component({
  selector: 'app-enhanced-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './enhanced-checkout.html',
  styleUrl: './enhanced-checkout.scss'
})
export class EnhancedCheckoutComponent implements OnInit, OnDestroy {
  private readonly app_state = inject(AppStateService);
  private readonly notifications = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly razorpayService = inject(RazorpayService);
  private readonly paymentStateService = inject(PaymentStateService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  // Core data signals
  protected readonly cartItems = this.app_state.cart;
  protected readonly subtotal = this.app_state.cartTotal;
  protected readonly totalDiscount = this.app_state.cartTotalDiscount;
  protected readonly shipping = computed(() => 
    this.cartItems().reduce((sum, item) => sum + (item.shipping_charges || 0), 0)
  );
  protected readonly total = computed(() => this.subtotal() + this.shipping());

  // UI state signals
  protected readonly currentStep = signal(1); // 1: Details, 2: Payment, 3: Confirmation
  protected readonly isProcessing = signal(false);
  protected readonly paymentState = signal<PaymentState>(PaymentState.IDLE);
  protected readonly selectedAddress = signal<Address | null>(null);
  protected readonly addresses = signal<Address[]>([]);
  protected readonly showTestCards = signal(false); // For testing in dev mode

  // Form
  protected readonly checkoutForm = new FormGroup({
    // Customer Details
    fullName: new FormControl('', { 
      nonNullable: true, 
      validators: [Validators.required, Validators.minLength(2)] 
    }),
    email: new FormControl('', { 
      nonNullable: true, 
      validators: [Validators.required, Validators.email] 
    }),
    phone: new FormControl('', { 
      nonNullable: true, 
      validators: [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)] 
    }),
    
    // Payment Method
    paymentMethod: new FormControl<PaymentMethod>('card', { 
      nonNullable: true 
    }),

    // Address selection for physical products
    addressId: new FormControl<string | null>(null)
  });

  // Computed values
  protected readonly hasPhysicalItems = computed(() => 
    this.cartItems().some(item => item.type !== 'subscription' && item.productType !== 'video')
  );

  protected readonly isValid = computed(() => {
    const formValid = this.checkoutForm.valid;
    const hasItems = this.cartItems().length > 0;
    const hasAddress = !this.hasPhysicalItems() || this.selectedAddress() !== null || 
                      this.checkoutForm.get('addressId')?.value !== null;
    return formValid && hasItems /*&& hasAddress*/;
  });

  protected readonly stepTitles = [
    'Customer Details',
    'Payment & Confirmation',
    'Order Complete'
  ];

  // Test cards for different scenarios
  protected readonly testScenarios: Record<string, {
    title: string;
    description: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  }> = {
    success: {
      title: 'Successful Payment',
      description: 'Use this card for successful payments',
      ...this.razorpayService.getTestPaymentMethods()['success']
    },
    failure: {
      title: 'Failed Payment',
      description: 'Use this card to test payment failure',
      ...this.razorpayService.getTestPaymentMethods()['failure']
    },
    insufficientFunds: {
      title: 'Insufficient Funds',
      description: 'Use this card to test insufficient funds scenario',
      ...this.razorpayService.getTestPaymentMethods()['insufficientFunds']
    }
  };

  private subscriptions = new Subscription();

  constructor() {
    // Auto-fill form with user data
    const user = this.authService.user();
    if (user) {
      this.checkoutForm.patchValue({
        fullName: user.name,
        email: user.email
      });
    }

    // Watch for payment state changes
    this.subscriptions.add(
      this.paymentStateService.currentSession$.subscribe(session => {
        if (session) {
          this.paymentState.set(session.state);
          // Handle successful payment
          if (session.state === PaymentState.SUCCESS) {
            this.handlePaymentSuccess();
          }
        }
      })
    );

    // Watch for Razorpay payment status updates
    this.subscriptions.add(
      this.razorpayService.paymentStatus$.subscribe(attempt => {
        if (attempt && attempt.status === 'success') {
          // Payment was successful, verify and complete order
          this.verifyAndCompletePayment(attempt);
        }
      })
    );

    // Watch for form changes
    this.subscriptions.add(
      this.checkoutForm.valueChanges.subscribe(() => {
        // Auto-select address when addressId changes
        const addressId = this.checkoutForm.get('addressId')?.value;
        if (addressId) {
          const address = this.addresses().find(addr => addr.id === addressId);
          if (address) {
            this.selectedAddress.set(address);
          }
        }
      })
    );
  }

  ngOnInit(): void {
    // Load addresses for logged in user
    const user = this.authService.user();
    if (user) {
      this.loadUserAddresses();
    }

    // Check if running in test mode
    this.showTestCards.set(this.razorpayService.isTestEnvironment());
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Load user addresses
   */
  private loadUserAddresses(): void {
    const user = this.authService.user();
    if (user) {
      this.api.getAddresses(user.id).subscribe({
        next: (response: common_response) => {
          if(response.status_code == 200){
            const addresses = response.data || [];
            this.addresses.set(addresses);
            // Select default address
            const defaultAddr = addresses.find((addr: Partial<Address>) => addr.set_as_default);
            if (defaultAddr) {
              this.selectAddress(defaultAddr);
            }
          }
          else{
            this.notifications.notify(response.message);
            this.addresses.set([]);
          }
        },
        error: (error) => {
          this.notifications.notify('Failed to load addresses', 'error');
          console.error('Error loading addresses:', error);
        }
      });
    }
  }

  /**
   * Select address
   */
  selectAddress(address: Address): void {
    this.selectedAddress.set(address);
    this.checkoutForm.patchValue({ addressId: address.id });
  }

  /**
   * Go to next step
   */
  nextStep(): void {
    if (this.currentStep() === 1) {
      // Validate step 1 before proceeding
      if (!this.validateStep1()) {
        return;
      }
      this.currentStep.set(2);
    } else if (this.currentStep() === 2) {
      // Start payment process
      this.processPayment();
    }
  }

  /**
   * Go to previous step
   */
  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  /**
   * Validate step 1 (customer details and address)
   */
  private validateStep1(): boolean {
    const form = this.checkoutForm;
    
    // Check if form is valid
    if (form.invalid) {
      form.markAllAsTouched();
      this.notifications.notify('Please fill in all required fields correctly', 'error');
      return false;
    }

    // Check if address is selected for physical items
    if (this.hasPhysicalItems() && !this.selectedAddress()) {
      this.notifications.notify('Please select a delivery address', 'error');
      return false;
    }

    return true;
  }

  /**
   * Process payment
   */
  public processPayment(): void {
    this.isProcessing.set(true);

    try {
      // Start payment session
      const session = this.paymentStateService.startPaymentSession({
        items: this.cartItems(),
        customerDetails: {
          name: this.checkoutForm.get('fullName')!.value,
          email: this.checkoutForm.get('email')!.value,
          contact: this.checkoutForm.get('phone')!.value,
          addressId: this.selectedAddress()?.id
        },
        paymentMethod: this.checkoutForm.get('paymentMethod')!.value,
        amount: this.total()
      });

      // Initiate payment
      this.paymentStateService.initiatePayment().subscribe({
        next: (result) => {
          if (result.success) {
            // Payment initiated successfully, wait for Razorpay callback
            this.notifications.notify('Payment initiated. Please complete payment.', 'info');
          } else {
            this.handlePaymentError(result.error);
          }
        },
        error: (error) => {
          this.handlePaymentError(error);
        }
      });

    } catch (error) {
      this.handlePaymentError(error);
    }
  }

  /**
   * Handle successful payment completion
   */
  private handlePaymentSuccess(): void {
    this.isProcessing.set(false);
    this.paymentState.set(PaymentState.SUCCESS);
    this.currentStep.set(3);
    this.notifications.notify('Payment successful! Order placed.', 'success');
  }

  /**
   * Verify and complete payment
   */
  private verifyAndCompletePayment(attempt: any): void {
    if (attempt && attempt.razorpayPaymentId && attempt.razorpayOrderId) {
      // Verify payment with Razorpay
      const verification = {
        orderId: attempt.razorpayOrderId,
        paymentId: attempt.razorpayPaymentId,
        signature: attempt.razorpaySignature,
        amount: attempt.amount,
        currency: 'INR',
        timestamp: new Date()
      };

      this.paymentStateService.verifyAndCompleteOrder(verification).subscribe({
        next: (result) => {
          if (result.success) {
            this.handlePaymentSuccess();
          } else {
            this.handlePaymentError('Payment verification failed');
          }
        },
        error: (error) => {
          this.handlePaymentError(error);
        }
      });
    }
  }

  /**
   * Handle payment errors
   */
  private handlePaymentError(error: any): void {
    this.isProcessing.set(false);
    this.paymentState.set(PaymentState.FAILED);
    
    let errorMessage = 'Payment failed. Please try again.';
    
    if (error) {
      if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'ORDER_CREATION_FAILED') {
        errorMessage = 'Failed to create payment order. Please try again.';
      } else if (error.description) {
        errorMessage = error.description;
      }
    }

    this.notifications.notify(errorMessage, 'error');
    
    // Reset to step 1 for retry
    setTimeout(() => {
      this.currentStep.set(1);
      this.isProcessing.set(false);
    }, 3000);
  }

  /**
   * Retry payment
   */
  retryPayment(): void {
    this.paymentStateService.retryPayment().subscribe({
      next: (result) => {
        if (!result.success) {
          this.handlePaymentError(result.error);
        }
      },
      error: (error) => {
        this.handlePaymentError(error);
      }
    });
  }

  /**
   * Cancel payment
   */
  cancelPayment(): void {
    this.paymentStateService.cancelPaymentSession('User cancelled payment');
    this.currentStep.set(1);
    this.isProcessing.set(false);
  }

  /**
   * Use test card (for development/testing)
   */
  useTestCard(scenario: 'success' | 'failure' | 'insufficientFunds'): void {
    const cardDetails = this.razorpayService.simulatePaymentScenario(scenario);
    this.notifications.notify(
      `Test card loaded: ${cardDetails.cardNumber} - ${this.testScenarios[scenario].title}`, 
      'info'
    );
    
    // In a real implementation, you would pre-fill the Razorpay payment form
    // with these card details for testing purposes
  }

  /**
   * Use test card (wrapper for template compatibility)
   */
  useTestCardWrapper(scenario: string): void {
    if (scenario === 'success' || scenario === 'failure' || scenario === 'insufficientFunds') {
      this.useTestCard(scenario);
    }
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  /**
   * Get payment state display text
   */
  getPaymentStateText(): string {
    switch (this.paymentState()) {
      case PaymentState.IDLE:
        return 'Ready to pay';
      case PaymentState.INITIATED:
        return 'Payment initiated';
      case PaymentState.PROCESSING:
        return 'Processing payment...';
      case PaymentState.SUCCESS:
        return 'Payment successful!';
      case PaymentState.FAILED:
        return 'Payment failed';
      case PaymentState.CANCELLED:
        return 'Payment cancelled';
      default:
        return 'Processing...';
    }
  }

  /**
   * Get step completion status
   */
  isStepCompleted(step: number): boolean {
    switch (step) {
      case 1:
        return this.checkoutForm.valid && 
               (!this.hasPhysicalItems() || this.selectedAddress() !== null);
      case 2:
        return this.paymentState() === PaymentState.SUCCESS;
      default:
        return false;
    }
  }
}