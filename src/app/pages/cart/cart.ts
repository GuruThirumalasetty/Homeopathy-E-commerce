import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { NotificationService } from '../../core/services/notification.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CartItem } from '../../core/models/product';
import { calculateDiscountAmount, calculatePurchasePrice, calculateTaxAmount, calculateFinalPrice } from '../../core/utils/discount-utils';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.scss'
})
export class CartComponent {
  private readonly appState = inject(AppStateService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly items = this.appState.cart;
  protected readonly subtotal = computed(() => this.items().reduce((total, item) => total + item.quantity * (item.finalPrice || item.purchasePrice || item.price || 0), 0));
  protected readonly totalDiscount = computed(() => this.items().reduce((total, item) => total + item.quantity * (item.discountAmount || 0), 0));
  protected readonly highlightedSubscriptionId = this.appState.highlightedSubscriptionId;
  protected readonly shipping = computed(() => this.items().reduce((sum, item) => sum + (item.shipping_charges || 0), 0));
  protected readonly total = computed(() => this.subtotal() + this.shipping());

  updateQuantity(itemId: number, quantity: number): void {
    if (Number.isNaN(quantity)) {
      return;
    }
    const currentUser = this.auth.user();
    const item = this.items().find(i => (i.type !== 'subscription' ? i.id : i.subscriptionId) === itemId) as (CartItem | undefined);

    if (currentUser && item && item.serverId) {
      this.api.updateCartItem(item.serverId, { quantity }).subscribe({
        next: () => {
          // refresh cart from server
          this.refreshCart(currentUser.id);
        },
        error: () => {
          this.notifications.notify('Failed to update quantity on server', 'error');
        }
      });
      return;
    }

    // Fallback to local update (guest or no serverId)
    if (item?.type !== 'subscription') {
      this.appState.updateCartQuantity(itemId, quantity);
    }
  }

  remove(itemId: number): void {
    const currentUser = this.auth.user();
    const item = this.items().find(i => (i.type !== 'subscription' ? i.id : i.subscriptionId) === itemId) as (CartItem | undefined);

    if (currentUser && item && item.serverId) {
      this.api.removeCartItem(item.serverId).subscribe({
        next: () => {
          this.refreshCart(currentUser.id);
          this.notifications.notify('Item removed from cart', 'info');
        },
        error: () => this.notifications.notify('Failed to remove item from server', 'error')
      });
      return;
    }

    // Fallback to local remove
    if (item?.type !== 'subscription') {
      this.appState.removeFromCart(itemId);
    } else if (item?.type === 'subscription') {
      // For subscriptions, just remove from local cart
      this.appState.removeSubscriptionFromCart(itemId);
      this.notifications.notify('Subscription removed from cart', 'info');
    }
  }

  proceedToCheckout(): void {
    if (this.items().length === 0) {
      this.notifications.notify('Your cart is empty', 'error');
      return;
    }
    this.router.navigate(['/checkout']);
  }

  private refreshCart(userId: string): void {
    this.api.getCart(userId).subscribe({
      next: (items) => {
        const cartItems = (items || []).map((it: any): CartItem => {
          if (it.type === 'subscription') {
            return {
              subscriptionId: it.subscriptionId,
              name: it.name,
              price: it.price,
              discount: it.discount || 0,
              discountType: it.discountType || 'percentage',
              duration: it.duration,
              itemPrice: it.itemPrice || it.price,
              discountAmount: it.discountAmount || 0,
              purchasePrice: it.purchasePrice || it.price,
              type: 'subscription',
              quantity: it.quantity || 1,
              serverId: it.id
            };
          } else {
            const quantity = it.quantity || 1;
            const discountAmount = calculateDiscountAmount(it.price, it.discount || 0, it.discountType || 'percentage');
            const purchasePrice = calculatePurchasePrice(it.price, it.discount || 0, it.discountType || 'percentage');
            const shipping_charges = it.shipping_charges || 0;
            const tax = it.tax || 0;
            const taxAmount = calculateTaxAmount(it.price, it.discount || 0, it.discountType || 'percentage', shipping_charges, tax, quantity);
            const finalPrice = calculateFinalPrice(it.price, it.discount || 0, it.discountType || 'percentage', shipping_charges, tax, quantity);
            return {
              id: it.productId,
              serverId: it.id,
              title: it.title,
              author: it.author,
              instructor: it.instructor,
              price: it.price,
              discount: it.discount || 0,
              discountType: it.discountType || 'percentage',
              shipping_charges,
              tax,
              itemPrice: it.itemPrice || it.price,
              discountAmount,
              purchasePrice,
              taxAmount,
              finalPrice,
              image: it.image,
              rating: it.rating,
              type: it.type,
              productType: it.type, // This is the product type (book/video)
              category: it.category,
              description: it.description,
              quantity
            };
          }
        });
        this.appState.setCartItems(cartItems);
      },
      error: () => {
        this.notifications.notify('Failed to refresh cart from server', 'error');
      }
    });
  }
}
