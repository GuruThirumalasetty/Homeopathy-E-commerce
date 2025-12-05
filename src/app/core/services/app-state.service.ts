import { Injectable, computed, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { CartItem, Product } from '../models/product';
import { Subscription } from '../models/subscription';
import { Charges, Order, OrderStatus, Transaction } from '../models/order';
import { forkJoin } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly api = inject(ApiService);
  private readonly productsSignal = signal<Product[]>([]);
  private readonly cartSignal = signal<CartItem[]>([]);
  private readonly ordersSignal = signal<Order[]>([]);
  private readonly transactionsSignal = signal<Transaction[]>([]);
  private readonly chargesSignal = signal<Charges[]>([]);
  private readonly highlightedSubscriptionIdSignal = signal<number | null>(null);

  readonly products = computed(() => this.productsSignal());
  readonly cart = computed(() => this.cartSignal());
  readonly charges = computed(() => this.chargesSignal());
  readonly highlightedSubscriptionId = computed(() => this.highlightedSubscriptionIdSignal());
  readonly cartCount = computed(() =>
    this.cartSignal().reduce((total, item) => total + item.quantity, 0)
  );
  readonly cartTotal = computed(() =>
    this.cartSignal().reduce((total, item) => total + item.quantity * (item.finalPrice || item.purchasePrice || item.price || 0), 0)
  );

  readonly cartTotalDiscount = computed(() =>
    this.cartSignal().reduce((total, item) => total + item.quantity * (item.discountAmount || 0), 0)
  );

  readonly orders = computed(() => this.ordersSignal());
  readonly transactions = computed(() => this.transactionsSignal());
  readonly user = computed(() => null); // User is now managed by AuthService

  addToCart(product: Product): void {
    const existing = this.cartSignal().find(item => item.type !== 'subscription' && item.id === product.id);
    if (existing) {
      this.cartSignal.update(items =>
        items.map(item =>
          item.type !== 'subscription' && item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      this.cartSignal.update(items => [...items, {
        ...product,
        quantity: 1,
        // type: 'subscription'
      }]);
    }
    // no local persistence; server-backed flows handled in components/services
  }

  removeFromCart(productId: number): void {
    this.cartSignal.update(items => items.filter(item => item.id !== productId));
    // no local persistence
  }

  updateCartQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.cartSignal.update(items =>
      items.map(item => (item.id === productId ? { ...item, quantity } : item))
    );
    // no local persistence; server-backed flows handled in components/services
  }

  clearCart(): void {
    this.cartSignal.set([]);
    // no local persistence
  }

  removeSubscriptionFromCart(subscriptionId: number): void {
    this.cartSignal.update(items => items.filter(item => item.subscriptionId !== subscriptionId));
  }

  getProductById(id: number): Product | undefined {
    return this.productsSignal().find(product => product.id === id);
  }

  createProduct(product: Omit<Product, 'id'>): void {
    const nextId = Math.max(0, ...this.productsSignal().map(item => item.id)) + 1;
    this.productsSignal.update(products => [...products, { ...product, id: nextId }]);
  }

  updateProduct(id: number, updates: Partial<Product>): void {
    this.productsSignal.update(products =>
      products.map(product => (product.id === id ? { ...product, ...updates } : product))
    );
  }

  deleteProduct(id: number): void {
    this.productsSignal.update(products => products.filter(product => product.id !== id));
  }

  placeOrder(): Order {
    const items = this.cartSignal();
    if (items.length === 0) {
      throw new Error('Cart is empty');
    }
    const subtotal = this.cartTotal(); // now includes tax
    const shipping = items.reduce((sum, item) => sum + (item.shipping_charges || 0), 0);
    const total = subtotal + shipping;

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      items,
      subtotal,
      tax: 0, // tax is included in subtotal
      shipping,
      total,
      status: 'processing',
      createdAt: new Date().toISOString(),
      createdBy: '', // should be set to current user ID in real implementation
      address_id: '',
      email: ''
    };
    this.ordersSignal.update(orders => [newOrder, ...orders]);
    this.clearCart();
    return newOrder;
  }

  addTransaction(order: Order, status: Transaction['status'], method: Transaction['method'] = 'card'): Transaction {
    const tx: Transaction = {
      id: `TX-${Date.now()}`,
      orderId: order.id,
      amount: order.total,
      status,
      method,
      createdAt: new Date().toISOString()
    };
    this.transactionsSignal.update(list => [tx, ...list]);
    return tx;
  }


  updateOrderStatus(orderId: string, status: OrderStatus): void {
    this.ordersSignal.update(orders =>
      orders.map(order => (order.id === orderId ? { ...order, status } : order))
    );
    // server-side update should be used via ApiService
  }

  // Method to load user-specific data when user logs in
  loadUserData(userId: string | null): void {
    if (!userId) {
      this.cartSignal.set([]);
      this.ordersSignal.set([]);
      this.transactionsSignal.set([]);
      this.chargesSignal.set([]);
      return;
    }

    // Load cart, orders and transactions from server
    forkJoin({
      items : this.api.getCart(userId),
      // charges : this.api.getCharges()
    }).subscribe({
      next: ({ items, /*charges*/ }) => {
        const cartItems = (items || []).map((it: any): CartItem => {
          if (it.type === 'subscription') {
            const discountAmount = it.discountAmount || 0;
            const purchasePrice = it.purchasePrice || it.price;
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
            return {
              id: it.productId,
              serverId: it.id,
              title: it.title,
              author: it.author,
              instructor: it.instructor,
              price: it.price,
              discount: it.discount || 0,
              discountType: it.discountType || 'percentage',
              itemPrice: it.itemPrice || it.price,
              discountAmount: it.discountAmount || 0,
              purchasePrice: it.purchasePrice || it.price,
              image: it.image,
              rating: it.rating,
              type: it.type,
              productType: it.type, // This is the product type (book/video)
              category: it.category,
              description: it.description,
              quantity: it.quantity || 1
            };
          }
        });
        this.cartSignal.set(cartItems);
        // this.chargesSignal.set(charges || []);
      },
      error: () => {
        this.cartSignal.set([]);
        // this.chargesSignal.set([]);
      }
    })
    // Note: orders and transactions are intentionally NOT prefetched here.
    // Pages that display orders/transactions should call the API when they are opened.
  }

  // Allow external code to set cart items (e.g., after fetching from API)
  setCartItems(items: CartItem[]): void {
    this.cartSignal.set(items);
  }

  setHighlightedSubscriptionId(id: number | null): void {
    this.highlightedSubscriptionIdSignal.set(id);
  }

  // Method to clear user data when user logs out
  clearUserData(): void {
    this.cartSignal.set([]);
    this.ordersSignal.set([]);
    this.transactionsSignal.set([]);
  }
}

