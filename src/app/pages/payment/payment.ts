import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment.html',
  styleUrl: './payment.scss'
})
export class PaymentComponent {
  private readonly appState = inject(AppStateService);
  protected readonly total = this.appState.cartTotal;
}
