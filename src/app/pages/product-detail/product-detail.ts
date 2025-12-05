import { CommonModule } from '@angular/common';
import { Component, computed, signal, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AppStateService } from '../../core/services/app-state.service';
import { NotificationService } from '../../core/services/notification.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Product } from '../../core/models/product';
import { calculateFinalPrice, calculateTaxAmount, calculateDiscountAmount, calculatePurchasePrice } from '../../core/utils/discount-utils';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss'
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly appState = inject(AppStateService);
  private readonly notifications = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly productSignal = signal<Product | undefined>(undefined);
  protected readonly product = computed(() => this.productSignal());

  constructor() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) {
        this.productSignal.set(undefined);
        return;
      }
      this.api.getProductById(id).subscribe({
        next: (p: any) => this.productSignal.set(p),
        error: () => {
          this.notifications.notify('Failed to load product details from server', 'error');
          this.router.navigate(['/products']);
        }
      });
    });
  }

  protected readonly safeVideoUrl = computed<SafeResourceUrl | null>(() => {
    const product = this.product();
    if (!product || product.type !== 'video' || !product.videoUrl) {
      return null;
    }
    const embedUrl = product.videoUrl.replace('watch?v=', 'embed/');
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  });

  // Discount calculation methods
  protected getDiscountedPrice(): number {
    const product = this.product();
    if (!product) return 0;

    const { price, discount, discountType } = product;
    if (!discount || discount === 0) return price;

    if (discountType === 'percentage') {
      return price - (price * discount / 100);
    } else {
      return Math.max(0, price - discount);
    }
  }

  protected getDiscountAmount(): number {
    const product = this.product();
    if (!product) return 0;

    const { price, discount, discountType } = product;
    if (!discount || discount === 0) return 0;

    if (discountType === 'percentage') {
      return price * discount / 100;
    } else {
      return discount;
    }
  }

  protected hasDiscount(): boolean {
    const product = this.product();
    return !!(product && product.discount && product.discount > 0);
  }

  protected getTaxAmount(): number {
    const product = this.product();
    if (!product) return 0;
    return calculateTaxAmount(
      product.price,
      product.discount || 0,
      product.discountType || 'percentage',
      product.shipping_charges || 0,
      product.tax || 0,
      1
    );
  }

  protected getFinalPrice(): number {
    const product = this.product();
    if (!product) return 0;
    return calculateFinalPrice(
      product.price,
      product.discount || 0,
      product.discountType || 'percentage',
      product.shipping_charges || 0,
      product.tax || 0,
      1
    );
  }

  addToCart(): void {
    const product = this.product();
    if (!product) {
      return;
    }

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
        const cartItems = (items || []).map((it: any) => {
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
              type: 'product',
              productType: it.productType || it.type,
              category: it.category,
              description: it.description,
              quantity
            };
          }
        });
        this.appState.setCartItems(cartItems as any);
        this.notifications.notify('Product added to cart', 'success');
      },
      error: () => {
        this.notifications.notify('Product added locally but failed to refresh cart', 'error');
      }
    });
  }

  buyNow(): void {
    this.addToCart();
    this.router.navigate(['/cart']);
  }
}
