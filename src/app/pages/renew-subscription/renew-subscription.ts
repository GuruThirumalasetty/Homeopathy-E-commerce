import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RazorpayService } from '../../core/services/razorpay.service';
import { NotificationService } from '../../core/services/notification.service';
import { UserSubscription } from '../../core/models/user-subscription';
import { Subscription } from '../../core/models/subscription';

interface RenewalData {
  subscription: UserSubscription;
  subscriptionDetails: Subscription;
  selectedPaymentMethod: string;
  renewalPeriod: 'monthly' | 'yearly';
}

@Component({
  selector: 'app-renew-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './renew-subscription.html',
  styleUrl: './renew-subscription.scss'
})
export class RenewSubscriptionComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly razorpay = inject(RazorpayService);
  private readonly notification = inject(NotificationService);

  protected readonly renewalData = signal<RenewalData | null>(null);
  protected readonly loading = signal(false);
  protected readonly processing = signal(false);

  private subscriptionId: string = '';

  constructor() {
    this.route.params.subscribe(params => {
      this.subscriptionId = params['id'];
      this.loadRenewalData();
    });
  }

  private loadRenewalData() {
    if (!this.subscriptionId) return;

    this.loading.set(true);
    // First get the user subscription
    this.api.getUserSubscriptions().subscribe({
      next: (userSubs: UserSubscription[]) => {
        const userSub = userSubs.find(sub => sub.id.toString() === this.subscriptionId);
        if (!userSub) {
          this.notification.notify('Subscription not found', 'error');
          this.router.navigate(['/my-subscriptions']);
          return;
        }

        // Get subscription details
        this.api.getSubscriptionById(userSub.subscriptionId).subscribe({
          next: (details: Subscription | null) => {
            if (!details) {
              this.notification.notify('Subscription details not found', 'error');
              this.router.navigate(['/my-subscriptions']);
              return;
            }

            this.renewalData.set({
              subscription: userSub,
              subscriptionDetails: details,
              selectedPaymentMethod: 'razorpay',
              renewalPeriod: details.duration
            });
            this.loading.set(false);
          },
          error: () => {
            this.notification.notify('Failed to load subscription details', 'error');
            this.router.navigate(['/my-subscriptions']);
            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.notification.notify('Failed to load subscription', 'error');
        this.router.navigate(['/my-subscriptions']);
        this.loading.set(false);
      }
    });
  }

  protected getRenewalAmount(): number {
    const data = this.renewalData();
    if (!data) return 0;

    // For renewal, use the current purchased price or the plan's price
    return data.subscription.purchasedPrice || data.subscriptionDetails.price;
  }

  protected getRenewalPeriod(): string {
    const data = this.renewalData();
    return data?.renewalPeriod === 'monthly' ? 'Month' : 'Year';
  }

  protected confirmRenewal() {
    const data = this.renewalData();
    if (!data) return;

    this.processing.set(true);

    // For demo, we'll simulate payment success
    // In real app, integrate with payment gateway
    setTimeout(() => {
      this.processRenewal();
    }, 1000);
  }

  private processRenewal() {
    const data = this.renewalData();
    if (!data) return;

    const user = this.auth.user();
    if (!user) return;

    // Calculate new end date
    const currentEndDate = new Date(data.subscription.endDate);
    const newEndDate = new Date(currentEndDate);

    if (data.renewalPeriod === 'monthly') {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }

    // Create new user subscription entry for renewal
    const renewedSubscription: Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.id,
      userName: user.name || user.email,
      userEmail: user.email,
      subscriptionId: data.subscription.subscriptionId,
      subscriptionName: data.subscription.subscriptionName,
      purchasedPrice: this.getRenewalAmount(),
      startDate: data.subscription.endDate, // Start from current end date
      endDate: newEndDate.toISOString(),
      status: 'active'
    };

    this.api.createUserSubscription(renewedSubscription).subscribe({
      next: () => {
        this.notification.notify('Subscription renewed successfully!', 'success');
        this.router.navigate(['/my-subscriptions']);
      },
      error: () => {
        this.notification.notify('Failed to renew subscription. Please try again.', 'error');
        this.processing.set(false);
      }
    });
  }

  protected cancelRenewal() {
    this.router.navigate(['/my-subscriptions']);
  }

  protected getFeatures(): string[] {
    const data = this.renewalData();
    return data?.subscriptionDetails.features?.filter(f => f.status === 1).map(f => f.name) || [];
  }

  protected getNewEndDate(): Date {
    const data = this.renewalData();
    if (!data) return new Date();

    const currentEndDate = new Date(data.subscription.endDate);
    const newEndDate = new Date(currentEndDate);

    if (data.renewalPeriod === 'monthly') {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }

    return newEndDate;
  }
}
