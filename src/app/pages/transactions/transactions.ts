import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss'
})
export class TransactionsComponent {
  private readonly appState = inject(AppStateService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly user = this.auth.user;
  protected readonly transactions = signal<any[]>([]);
  protected readonly orders = signal<any[]>([]);
  protected readonly users = signal<any[]>([]);

  protected readonly enrichedTransactions = computed(() => {
    const txs = this.transactions();
    const ords = this.orders();
    const usrs = this.users();
    return txs.map(tx => {
      const order = ords.find(o => o.id === tx.orderId);
      const user = order ? usrs.find(u => u.id === order.createdBy) : null;
      return {
        ...tx,
        order,
        user
      };
    });
  });

  constructor() {
    const user = this.auth.user();
    if (user) {
      if (user.role === 'admin') {
        // Fetch all data for admin
        this.api.getTransactions().subscribe({
          next: (list) => this.transactions.set(list || []),
          error: () => this.transactions.set([])
        });
        this.api.getOrders().subscribe({
          next: (list) => this.orders.set(list || []),
          error: () => this.orders.set([])
        });
        this.api.getUsers().subscribe({
          next: (list) => this.users.set(list || []),
          error: () => this.users.set([])
        });
      } else {
        // For regular user, fetch their transactions and orders
        this.api.getTransactionsByUser(user.id).subscribe({
          next: (list) => this.transactions.set(list || []),
          error: () => this.transactions.set([])
        });
        this.api.getOrdersByUser(user.id).subscribe({
          next: (list) => this.orders.set(list || []),
          error: () => this.orders.set([])
        });
        // Users don't need all users, but for their own name
        this.users.set([user]);
      }
    }
  }
}
