import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { Product, CartItem } from '../../core/models/product';
import { Subscription, SubscriptionCartItem } from '../../core/models/subscription';
import { NotificationService } from '../../core/services/notification.service';
import { calculateFinalPrice, calculateTaxAmount, calculateDiscountAmount, calculatePurchasePrice } from '../../core/utils/discount-utils';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent {
  // services injected via constructor

  protected products = signal<Product[]>([]);
  protected subscriptions = signal<Subscription[]>([]);
  protected readonly featuredBooks = computed(() =>
    this.products().filter(product => product.type === 'book').slice(0, 4)
  );
  protected readonly featuredVideos = computed(() =>
    this.products().filter(product => product.type === 'video').slice(0, 4)
  );

  protected readonly subscriptionTypes = computed(() => {
    const types = [...new Set(this.subscriptions().map(s => s.type))];
    return types;
  });

  protected readonly plansByType = computed(() => {
    const types = this.subscriptionTypes();
    return types.map(type => ({
      type,
      plans: this.subscriptions().filter(s => s.type === type)
    }));
  });

  protected readonly bookPlans = computed(() => this.subscriptions().filter(s => s.type === 'book'));
  protected readonly videoPlans = computed(() => this.subscriptions().filter(s => s.type === 'video'));
  protected readonly perception_on_homeopathy_plan : any = computed(() => this.subscriptions().find(s => s.type === 'perceptions on homeopathy') || '');

  // Discount calculation methods for products
  protected getProductDiscountedPrice(product: Product): number {
    const { price, discount, discountType } = product;
    if (!discount || discount === 0) return price;

    if (discountType === 'percentage') {
      return price - (price * discount / 100);
    } else {
      return Math.max(0, price - discount);
    }
  }

  protected getProductDiscountAmount(product: Product): number {
    const { price, discount, discountType } = product;
    if (!discount || discount === 0) return 0;

    if (discountType === 'percentage') {
      return price * discount / 100;
    } else {
      return discount;
    }
  }

  protected hasProductDiscount(product: Product): boolean {
    return !!(product && product.discount && product.discount > 0);
  }

  protected getProductFinalPrice(product: Product, quantity: number = 1): number {
    return calculateFinalPrice(
      product.price,
      product.discount || 0,
      product.discountType || 'percentage',
      product.shipping_charges || 0,
      product.tax || 0,
      quantity
    );
  }

  // Discount calculation methods for subscriptions
  protected getSubscriptionDiscountedPrice(subscription: Subscription): number {
    const { price, discount, discountType } = subscription;
    if (!discount || discount === 0) return price;

    if (discountType === 'percentage') {
      return price - (price * discount / 100);
    } else {
      return Math.max(0, price - discount);
    }
  }

  protected getSubscriptionDiscountAmount(subscription: Subscription): number {
    const { price, discount, discountType } = subscription;
    if (!discount || discount === 0) return 0;

    if (discountType === 'percentage') {
      return price * discount / 100;
    } else {
      return discount;
    }
  }

  protected hasSubscriptionDiscount(subscription: Subscription): boolean {
    return !!(subscription && subscription.discount && subscription.discount > 0);
  }

  protected isTypeInCart(type: string): boolean {
    const cartItems = this.appState.cart();
    return cartItems.some(item => item.type === 'subscription' && item.planType === type);
  }

  constructor(
    private api: ApiService,
    private appState: AppStateService,
    private notifications: NotificationService,
    private auth: AuthService,
    private router: Router
  ) {
    this.api.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
      },
      error: () => {
        this.notifications.notify('Failed to load products from server', 'error');
      }
    });

    this.api.getSubscriptions().subscribe({
      next: (subscriptions) => {
        this.subscriptions.set(subscriptions);
      },
      error: () => {
        this.notifications.notify('Failed to load subscription plans from server', 'error');
      }
    });
  }

  addToCart(product: Product): void {
    const currentUser = this.auth.user();
    if (!currentUser) {
      this.notifications.notify('Please login to add items to cart', 'info');
      this.router.navigate(['/login']);
      return;
    }

    // First, check if product already exists in cart
    this.api.getCart(currentUser.id).subscribe({
      next: (items) => {
        const existing = items.find((it: any) => it.productId === product.id);
        if (existing) {
          // Update existing cart item quantity
          this.api.updateCartItem(existing.id, { quantity: existing.quantity + 1 }).subscribe({
            next: () => {
              this.refreshCart(currentUser.id);
            },
            error: () => {
              this.notifications.notify('Failed to update cart item', 'error');
            }
          });
        } else {
          // Add new cart item
          const discountAmount = calculateDiscountAmount(product.price, product.discount || 0, product.discountType || 'percentage');
          const purchasePrice = calculatePurchasePrice(product.price, product.discount || 0, product.discountType || 'percentage');
          const shipping_charges = product.shipping_charges || 0;
          const tax = product.tax || 0;
          const taxAmount = calculateTaxAmount(product.price, product.discount || 0, product.discountType || 'percentage', shipping_charges, tax);
          const finalPrice = calculateFinalPrice(product.price, product.discount || 0, product.discountType || 'percentage', shipping_charges, tax);
           const payload = {
             userId: currentUser.id,
             productId: product.id,
             quantity: 1,
             title: product.title,
             price: product.price,
             discount: product.discount || 0,
             discountType: product.discountType || 'percentage',
             shipping_charges,
             tax,
             itemPrice: product.price, // original price
             discountAmount,
             purchasePrice,
             taxAmount,
             finalPrice,
             image: product.image,
             rating: product.rating,
             type: 'product', // specify this is a product item
             productType: product.type,
             category: product.category,
             author: product.author,
             instructor: product.instructor,
             description: product.description
           };
          this.api.addCartItem(payload).subscribe({
            next: () => {
              this.refreshCart(currentUser.id);
            },
            error: () => {
              this.notifications.notify('Failed to add product to cart', 'error');
            }
          });
        }
      },
      error: () => {
        this.notifications.notify('Failed to check cart', 'error');
      }
    });
  }

  private refreshCart(userId: string): void {
    this.api.getCart(userId).subscribe({
      next: (items) => {
        const cartItems = (items || []).map((it: any): CartItem => {
          if (it.type === 'subscription') {
            const discountAmount = it.discountAmount || this.getSubscriptionDiscountAmount({ id: it.subscriptionId, name: it.name, price: it.price, discount: it.discount || 0, discountType: it.discountType || 'percentage', duration: it.duration } as Subscription);
            const purchasePrice = it.purchasePrice || this.getSubscriptionDiscountedPrice({ id: it.subscriptionId, name: it.name, price: it.price, discount: it.discount || 0, discountType: it.discountType || 'percentage', duration: it.duration } as Subscription);
            return {
              subscriptionId: it.subscriptionId,
              name: it.name,
              price: it.price,
              discount: it.discount || 0,
              discountType: it.discountType || 'percentage',
              duration: it.duration,
              itemPrice: it.itemPrice || it.price,
              discountAmount,
              purchasePrice,
              finalPrice: purchasePrice,
              type: 'subscription',
              planType: it.planType,
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
        this.notifications.notify('Item added to cart', 'success');
      },
      error: () => {
        this.notifications.notify('Item added locally but failed to refresh cart', 'error');
      }
    });
  }

  subscribe(plan: Subscription): void {
    const currentUser = this.auth.user();
    if (!currentUser) {
      this.notifications.notify('Please login to subscribe', 'info');
      this.router.navigate(['/login']);
      return;
    }

    if (this.isTypeInCart(plan.type)) {
      this.notifications.notify(`A ${plan.type} plan is already in your cart`, 'info');
      return;
    }

    this.addSubscriptionToCart(plan, currentUser.id);
  }

  private addSubscriptionToCart(plan: Subscription, userId: string): void {
    const discountAmount = this.getSubscriptionDiscountAmount(plan);
    const purchasePrice = this.getSubscriptionDiscountedPrice(plan);
    const subscriptionData = {
      userId,
      subscriptionId: plan.id,
      name: plan.name,
      price: plan.price,
      discount: plan.discount || 0,
      discountType: plan.discountType || 'percentage',
      duration: plan.duration,
      itemPrice: plan.price,
      discountAmount,
      purchasePrice,
      finalPrice: purchasePrice, // no tax/shipping for subscriptions
      type: 'subscription',
      planType: plan.type,
      quantity: 1
    };

    this.api.addSubscriptionToCart(subscriptionData).subscribe({
      next: () => {
        this.notifications.notify(`Added ${plan.name} plan to cart!`, 'success');
        // Refresh cart in app state
        this.refreshCart(userId);
      },
      error: () => {
        this.notifications.notify('Failed to add subscription to cart', 'error');
      }
    });
  }
}
