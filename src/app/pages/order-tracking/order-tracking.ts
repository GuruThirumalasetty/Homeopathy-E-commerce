import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Order } from '../../core/models/order';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './order-tracking.html',
  styleUrl: './order-tracking.scss'
})
export class OrderTrackingComponent {
  // private readonly appState = inject(AppStateService);
  // protected readonly query = signal('');
  // protected readonly orders = this.appState.orders;

  // protected readonly match = computed(() => {
  //   const id = this.query().trim();
  //   return this.orders().find(order => order.id === id);
  // });
  
  private readonly appState = inject(AppStateService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly orders = signal<any[]>([]);

  constructor() {
    const user = this.auth.user();
    if (user) {
      this.api.getOrdersByUser(user.id).subscribe({
        next: (orders : Order[]) => {
          // Sort orders by createdAt descending (newest first)
          this.orders.set(orders);
        },
        error: () => this.orders.set([])
      });
    } else {
      this.orders.set([]);
    }
  }
}
