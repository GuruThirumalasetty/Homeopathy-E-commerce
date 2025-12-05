import { Injectable, signal } from '@angular/core';

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface NotificationMessage {
  id: number;
  message: string;
  type: NotificationType;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messagesSignal = signal<NotificationMessage[]>([]);
  readonly messages = this.messagesSignal.asReadonly();

  notify(message: string, type: NotificationType = 'info'): void {
    const notification: NotificationMessage = {
      id: Date.now(),
      message,
      type
    };
    this.messagesSignal.update(list => [...list, notification]);
    setTimeout(() => this.dismiss(notification.id), 3000);
  }

  dismiss(id: number): void {
    this.messagesSignal.update(list => list.filter(msg => msg.id !== id));
  }
}

