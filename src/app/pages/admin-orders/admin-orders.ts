import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { CountByStatusPipe } from './count-by-status.pipe';
import { ApiService } from '../../core/services/api.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, CountByStatusPipe, RouterLink],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.scss'
})
export class AdminOrdersComponent {
  private readonly appState = inject(AppStateService);
  private readonly api = inject(ApiService);
  protected readonly orders = signal<any[]>([]);
  protected readonly statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

  constructor() {
    this.loadOrders();
  }

  private loadOrders(): void {
    this.api.getOrders().subscribe({
      next: (orders) => {
        // Sort orders by createdAt descending (newest first)
        const sortedOrders = (orders || []).sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.orders.set(sortedOrders);
      },
      error: () => this.orders.set([])
    });
  }

  updateStatus(orderId: string, status: (typeof this.statuses)[number]): void {
    let order : any = {
      status,
      updatedAt : new Date().toISOString()
    }
    if(status == 'shipped') order.shipped_on = new Date().toISOString();
    else if(status == 'delivered') order.delivered_on = new Date().toISOString();
    this.api.updateOrder(orderId, order).subscribe({
      next: () => this.loadOrders(),
      error: () => {
        // fallback to local update
        this.appState.updateOrderStatus(orderId, status);
      }
    });
  }
}
