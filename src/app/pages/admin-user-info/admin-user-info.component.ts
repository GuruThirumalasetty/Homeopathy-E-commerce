import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models/user';
import { Order, Transaction } from '../../core/models/order';

@Component({
  selector: 'app-admin-user-info',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-user-info.component.html',
  styleUrl: './admin-user-info.component.scss'
})
export class AdminUserInfoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  protected readonly user = signal<User | null>(null);
  protected readonly orders = signal<Order[]>([]);
  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly totalSpent = computed(() => this.orders().reduce((sum, order) => sum + order.total, 0));
  protected readonly accountAge = computed(() => {
    const user = this.user();
    if (!user || !user.createdAt) return 0;
    return Math.floor((new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  });

  constructor() {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.loadUserData(userId);
    }
  }

  private loadUserData(userId: string): void {
    // Fetch user
    this.api.getUsers().subscribe({
      next: (users) => {
        const foundUser = users.find(u => u.id === userId);
        if (foundUser) {
          this.user.set(foundUser);
        }
      }
    });

    // Fetch orders for user
    this.api.getOrdersByUser(userId).subscribe({
      next: (orders) => this.orders.set(orders || [])
    });

    // Fetch transactions for user
    this.api.getTransactionsByUser(userId).subscribe({
      next: (transactions) => this.transactions.set(transactions || [])
    });
  }

  protected getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'pending': 'fa-clock',
      'processing': 'fa-cogs',
      'shipped': 'fa-truck',
      'delivered': 'fa-check-circle',
      'cancelled': 'fa-times-circle'
    };
    return icons[status] || 'fa-question-circle';
  }

  protected getTransactionIcon(method: string): string {
    const icons: { [key: string]: string } = {
      'card': 'fa-credit-card',
      'upi': 'fa-mobile-alt',
      'netbanking': 'fa-university',
      'wallet': 'fa-wallet'
    };
    return icons[method] || 'fa-credit-card';
  }

  protected getOrderTransactions(orderId: string) {
    return this.transactions().filter(tx => tx.orderId === orderId);
  }
}
