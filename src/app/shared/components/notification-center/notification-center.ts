import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="notification-stack">
      @for (message of notifications(); track message.id) {
        <article class="notification" [class.notification-error]="message.type === 'error'" [class.notification-success]="message.type === 'success'">
          <span>{{ message.message }}</span>
          <button type="button" (click)="dismiss(message.id)">×</button>
        </article>
      }
    </section>
  `,
  styles: `
    .notification-stack {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      z-index: 1000;
    }

    .notification {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.85rem 1.2rem;
      border-radius: 999px;
      background: #1d4ed8;
      color: #fff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);
      min-width: 220px;
    }

    .notification-success {
      background: #047857;
    }

    .notification-error {
      background: #b91c1c;
    }

    button {
      border: none;
      background: transparent;
      color: inherit;
      font-size: 1.25rem;
      cursor: pointer;
      line-height: 1;
    }
  `
})
export class NotificationCenterComponent {
  private readonly notificationService = inject(NotificationService);
  readonly notifications = this.notificationService.messages;

  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }
}

