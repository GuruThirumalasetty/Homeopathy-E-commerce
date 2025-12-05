import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { Product, CartItem } from '../../core/models/product';
import { NotificationService } from '../../core/services/notification.service';
import { calculateDiscountAmount, calculatePurchasePrice, calculateFinalPrice, calculateTaxAmount, formatPrice } from '../../core/utils/discount-utils';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './products.html',
  styleUrl: './products.scss'
})
export class ProductsComponent {
  // services injected in constructor to avoid circular dependency issues

  protected readonly filterForm = new FormGroup({
    search: new FormControl<string>(''),
    minPrice: new FormControl<number | null>(null),
    maxPrice: new FormControl<number | null>(null)
  });

  protected readonly selectedRatings = signal<number[]>([]);
  protected readonly selectedCategories = signal<string[]>([]);
  protected readonly currentType = signal<'books' | 'videos' | null>(null);
  
  // Signals to track form values for reactive filtering
  private readonly searchSignal = signal<string>('');
  private readonly minPriceSignal = signal<number | null>(null);
  private readonly maxPriceSignal = signal<number | null>(null);

  protected products = signal<Product[]>([]);
  protected readonly categories_master = signal<any[]>([]);
  protected readonly filteredProducts = computed(() => {
    const search = this.searchSignal().toLowerCase();
    const minPrice = this.minPriceSignal();
    const maxPrice = this.maxPriceSignal();
    const ratings = this.selectedRatings();
    const categories = this.selectedCategories();
    const type = this.currentType();

    return this.products().filter(product => {
      if (type === 'books' && product.type !== 'book') {
        return false;
      }
      if (type === 'videos' && product.type !== 'video') {
        return false;
      }
      if (search) {
        const haystack = `${product.title} ${product.author ?? ''} ${product.instructor ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      if (minPrice !== null && product.price < minPrice) {
        return false;
      }
      if (maxPrice !== null && product.price > maxPrice) {
        return false;
      }
      if (ratings.length > 0 && product.rating < Math.max(...ratings)) {
        return false;
      }
      if (categories.length > 0 && !categories.includes(product.category)) {
        return false;
      }
      return true;
    });
  });

  protected readonly resultsCount = computed(() => this.filteredProducts().length);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: ApiService,
    private readonly notifications: NotificationService,
    private readonly appState: AppStateService,
    private readonly auth: AuthService,
    private readonly router: Router
  ) {
    this.loadCategories();
    const type = this.route.snapshot.queryParamMap.get('category');
    if (type === 'books' || type === 'videos') {
      this.currentType.set(type);
    }

    // Subscribe to form changes to update signals
    this.filterForm.controls.search.valueChanges.subscribe(value => {
      this.searchSignal.set(value ?? '');
    });

    this.filterForm.controls.minPrice.valueChanges.subscribe(value => {
      this.minPriceSignal.set(value ?? null);
    });

    this.filterForm.controls.maxPrice.valueChanges.subscribe(value => {
      this.maxPriceSignal.set(value ?? null);
    });

    // Fetch products from API
    this.api.getProducts().subscribe({
      next: (products) => {
        this.products.set(products as Product[]);
      },
      error: () => {
        this.notifications.notify('Failed to load products from server', 'error');
      }
    });
  }
  
  private loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (categories) => {
        let category_names = categories.map(category => category.name);
        this.categories_master.set(category_names || []);
      },
      error: () => {
        this.notifications.notify('Failed to load categories', 'error');
        this.categories_master.set([]);
      }
    });
  }

  toggleRating(rating: number): void {
    this.selectedRatings.update(list =>
      list.includes(rating) ? list.filter(item => item !== rating) : [...list, rating]
    );
  }

  toggleCategory(category: string): void {
    this.selectedCategories.update(list =>
      list.includes(category) ? list.filter(item => item !== category) : [...list, category]
    );
  }

  setType(type: 'books' | 'videos' | null): void {
    this.currentType.set(type);
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.selectedRatings.set([]);
    this.selectedCategories.set([]);
    this.setType(null);
  }

  protected calculatePurchasePrice(price: number, discount: number, discountType: 'percentage' | 'fixed' = 'percentage'): number {
    return calculatePurchasePrice(price, discount, discountType);
  }

  protected calculateFinalPrice(price: number, discount: number, discountType: 'percentage' | 'fixed', shipping_charges: number = 0, tax: number = 0, quantity: number = 1): number {
    return calculateFinalPrice(price, discount, discountType, shipping_charges, tax, quantity);
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
            itemPrice: product.price,
            discountAmount,
            purchasePrice,
            taxAmount,
            finalPrice,
            image: product.image,
            rating: product.rating,
            type: product.type,
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
            category: it.category,
            description: it.description,
            quantity
          };
        });
        this.appState.setCartItems(cartItems);
        this.notifications.notify('Product added to cart', 'success');
      },
      error: () => {
        this.notifications.notify('Product added locally but failed to refresh cart', 'error');
      }
    });
  }
}
