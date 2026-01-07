import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { UserSubscription } from '../../core/models/user-subscription';
import { Subscription } from '../../core/models/subscription';

interface SubscriptionWithDetails extends UserSubscription {
  subscriptionDetails?: Subscription;
}

@Component({
  selector: 'app-my-subscriptions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-subscriptions.html',
  styleUrl: './my-subscriptions.scss'
})
export class MySubscriptionsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly subscriptions = signal<SubscriptionWithDetails[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    this.loadSubscriptions();
  }

  private loadSubscriptions() {
    const user = this.auth.user();
    if (!user) return;

    this.loading.set(true);
    this.api.getUserSubscriptions().subscribe({
      next: (userSubs: UserSubscription[]) => {
        const userSubscriptions = userSubs.filter(sub => sub.userId === user.id);

        // Separate active and expired subscriptions
        const activeSubs = userSubscriptions.filter(sub => sub.status === 'active');
        const expiredSubs = userSubscriptions.filter(sub => sub.status === 'expired');

        // Show only the most recent expired subscription (if any)
        const mostRecentExpired = expiredSubs.length > 0
          ? [expiredSubs.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0]]
          : [];

        const subsToShow = [...activeSubs, ...mostRecentExpired];

        // For each, fetch subscription details
        const subsWithDetails: SubscriptionWithDetails[] = [];
        let loadedCount = 0;

        if (subsToShow.length === 0) {
          this.subscriptions.set([]);
          this.loading.set(false);
          return;
        }

        subsToShow.forEach(sub => {
          this.api.getSubscriptionById(sub.subscriptionId).subscribe({
            next: (details: Subscription | null) => {
              subsWithDetails.push({ ...sub, subscriptionDetails: details || undefined });
              loadedCount++;
              if (loadedCount === subsToShow.length) {
                this.subscriptions.set(subsWithDetails);
                this.loading.set(false);
              }
            },
            error: () => {
              subsWithDetails.push(sub);
              loadedCount++;
              if (loadedCount === subsToShow.length) {
                this.subscriptions.set(subsWithDetails);
                this.loading.set(false);
              }
            }
          });
        });
      },
      error: () => {
        this.subscriptions.set([]);
        this.loading.set(false);
      }
    });
  }

  protected renewSubscription(sub: SubscriptionWithDetails) {
    // Navigate to renewal screen with subscription data
    this.router.navigate(['/renew-subscription', sub.id]);
  }

  protected getBillingCycle(sub: SubscriptionWithDetails): string {
    return sub.subscriptionDetails?.duration === 'monthly' ? 'Monthly' : 'Yearly';
  }

  protected getFeatures(sub: SubscriptionWithDetails): string[] {
    return sub.subscriptionDetails?.features?.filter(f => f.status === 1).map(f => f.name) || [];
  }
}