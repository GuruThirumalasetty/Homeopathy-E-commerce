import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './orders.html',
  styleUrl: './orders.scss'
})
export class OrdersComponent {
  private readonly appState = inject(AppStateService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly orders = signal<any[]>([]);
  protected readonly expandedOrders = signal<Set<string>>(new Set());

  constructor() {
    this.getUser();
  }

  protected getUser(){
    const user = this.auth.user();
    if (user) {
      this.api.getOrdersByUser(user.id).subscribe({
        next: (orders) => {
          // Sort orders by createdAt descending (newest first)
          const sortedOrders = (orders || []).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          this.orders.set(sortedOrders);
        },
        error: () => this.orders.set([])
      });
    } else {
      this.orders.set([]);
    }
  }

  protected viewOrderDetails(orderId: string) {
    this.router.navigate(['/order', orderId]);
  }

  protected getTotalDiscount(order: any): number {
    return order.items.reduce((sum: number, item: any) => sum + (item.discountAmount || 0) * item.quantity, 0);
  }

  protected hasDiscount(order: any): boolean {
    return order.items.some((item: any) => item.discountAmount > 0);
  }

  protected cancelOrder(order: any): void {
    if (confirm('Are you sure you want to cancel this order?')) {
      const user = this.auth.user();
      if (!user) return;

      // Update order status to cancelled
      this.api.updateOrder(order.id, { status: 'cancelled', updatedAt: new Date().toISOString() }).subscribe({
        next: () => {
          // Create refund transaction
          const refundTx = {
            id: `TX-REFUND-${Date.now()}`,
            orderId: order.id,
            amount: order.total,
            status: 'refunded',
            method: 'wallet', // or original method
            createdAt: new Date().toISOString()
          };
          this.api.createTransaction(refundTx).subscribe({
            next: () => {
              // Reload orders
              this.getUser();
            },
            error: () => {
              // Handle error
            }
          });
        },
        error: () => {
          // Handle error
        }
      });
    }
  }

  protected toggleExpansion(orderId: string): void {
    const current = this.expandedOrders();
    const newSet = new Set(current);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    this.expandedOrders.set(newSet);
  }

  protected isExpanded(orderId: string): boolean {
    return this.expandedOrders().has(orderId);
  }
}
