import { Pipe, PipeTransform } from '@angular/core';
import { Order, OrderStatus } from '../../core/models/order';

@Pipe({
  name: 'countByStatus',
  standalone: true
})
export class CountByStatusPipe implements PipeTransform {
  transform(orders: Order[], status: OrderStatus): number {
    return orders.filter(order => order.status === status).length;
  }
}
