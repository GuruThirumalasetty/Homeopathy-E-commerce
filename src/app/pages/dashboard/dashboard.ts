import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {
  private readonly app_state = inject(AppStateService);
  protected readonly cartCount = this.app_state.cartCount;
  protected readonly cartTotal = this.app_state.cartTotal;
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly user = this.auth.user;
  protected readonly orders = signal<any[]>([]);
  protected readonly transactions = signal<any[]>([]);

  constructor() {
    const user = this.auth.user();
    if(user){
      if (user.role === 'admin') {
        this.api.getOrders().subscribe({ next: (list) => this.orders.set(list || []), error: () => this.orders.set([]) });
        this.api.getTransactions().subscribe({ next: (list) => this.transactions.set(list || []), error: () => this.transactions.set([]) });
      } else {
        this.api.getOrdersByUser(user.id).subscribe({ next: (list) => this.orders.set(list || []), error: () => this.orders.set([]) });
        this.api.getTransactionsByUser(user.id).subscribe({ next: (list) => this.transactions.set(list || []), error: () => this.transactions.set([]) });
      }
    }
  }
}
