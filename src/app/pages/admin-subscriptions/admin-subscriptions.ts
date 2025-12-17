import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserSubscription } from '../../core/models/user-subscription';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner';

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  templateUrl: './admin-subscriptions.html',
  styleUrl: './admin-subscriptions.scss'
})
export class AdminSubscriptionsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly subscriptions = signal<UserSubscription[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Check if user is admin
    const currentUser = this.auth.user();
    if (!currentUser || currentUser.role !== 'admin') {
      this.notifications.notify('Access denied. Admin privileges required.', 'error');
      this.router.navigate(['/home']);
      return;
    }

    this.loadSubscriptions();
  }

  protected loadSubscriptions(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getUserSubscriptions().subscribe({
      next: (subscriptions) => {
        this.subscriptions.set(subscriptions || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load subscriptions:', err);
        this.error.set('Failed to load subscriptions. Please try again.');
        this.notifications.notify('Failed to load subscriptions', 'error');
        this.loading.set(false);
      }
    });
  }

  protected formatDate(dateString: string | undefined): string {
    return dateString ? new Date(dateString).toLocaleString() : '';
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'expired': return 'status-expired';
      case 'cancelled': return 'status-cancelled';
      case 'pending': return 'status-pending';
      default: return '';
    }
  }
}