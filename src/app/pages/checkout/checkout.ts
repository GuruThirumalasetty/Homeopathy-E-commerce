import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { NotificationService } from '../../core/services/notification.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Address } from '../../core/models/address';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss'
})
export class CheckoutComponent {
  private readonly appState = inject(AppStateService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly items = this.appState.cart;
  protected readonly subtotal = this.appState.cartTotal;
  protected readonly totalDiscount = this.appState.cartTotalDiscount;
  protected readonly charges = this.appState.charges;
  protected readonly shipping = computed(() => this.items().reduce((sum, item) => sum + (item.shipping_charges || 0), 0));
  protected readonly total = computed(() => this.subtotal() + this.shipping());

  protected readonly hasBooks = computed(() => this.items().some(item => item.type !== 'subscription' && item.productType === 'book'));
  protected readonly hasVideos = computed(() => this.items().some(item => item.type !== 'subscription' && item.productType === 'video'));
  protected readonly hasSubscriptions = computed(() => this.items().some(item => item.type === 'subscription'));
  protected readonly videosOnly = computed(() => this.hasVideos() && !this.hasBooks() && !this.hasSubscriptions());
  protected readonly booksOnly = computed(() => this.hasBooks() && !this.hasVideos() && !this.hasSubscriptions());
  protected readonly subscriptionsOnly = computed(() => this.hasSubscriptions() && !this.hasBooks() && !this.hasVideos());
  protected readonly mixed = computed(() => (this.hasBooks() || this.hasVideos()) && this.hasSubscriptions() || (this.hasBooks() && this.hasVideos()));

  protected readonly addresses = signal<Address[]>([]);
  protected readonly selectedAddress = signal<Address | null>(null);
  protected readonly showEditDialog = signal(false);
  protected readonly selectedAddressForEdit = signal<Address | null>(null);

  protected readonly checkoutForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    // address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    // city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    // zip: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    paymentMethod: new FormControl<'card' | 'upi' | 'netbanking'>('card', { nonNullable: true })
  });

  // Track form status changes for reactive validation
  private readonly formStatusSignal = signal<'VALID' | 'INVALID'>(this.checkoutForm.status as 'VALID' | 'INVALID');

  constructor() {
    // Subscribe to form status changes
    this.checkoutForm.statusChanges.subscribe(status => {
      this.formStatusSignal.set(status as 'VALID' | 'INVALID');
    });

    // Load user addresses
    const user = this.auth.user();
    if (user) {
      this.api.getAddresses(user.id).subscribe({
        next: (addresses) => {
          this.addresses.set(addresses);
          // Set default address if available
          const defaultAddr = addresses.find(addr => addr.isDefault);
          if (defaultAddr) {
            this.selectAddress(defaultAddr);
          }
        }
      });
    }
  }

  protected readonly isValid = computed(() => {
    const formValid = this.formStatusSignal() === 'VALID';
    const hasItems = this.items().length > 0;
    const hasAddress = this.selectedAddress() !== null || this.videosOnly() || this.subscriptionsOnly();
    return formValid && hasItems && hasAddress;
  });

  selectAddress(address: Address) {
    this.selectedAddress.set(address);
    // Update form with address details
    // this.checkoutForm.patchValue({
    //   fullName: address.name,
    //   address: address.street,
    //   city: address.city,
    //   zip: address.zipCode
    // });
  }

  editAddress(address: Address) {
    this.selectedAddressForEdit.set({ ...address });
    this.showEditDialog.set(true);
  }

  closeEditDialog() {
    this.showEditDialog.set(false);
    this.selectedAddressForEdit.set(null);
  }

  updateAddress() {
    const address = this.selectedAddressForEdit();
    if (!address) return;

    this.api.updateAddress(address.id, address).subscribe({
      next: () => {
        // Reload addresses
        const user = this.auth.user();
        if (user) {
          this.api.getAddresses(user.id).subscribe({
            next: (addresses) => {
              this.addresses.set(addresses);
              // Update selected if it was edited
              const updated = addresses.find(a => a.id === address.id);
              if (updated && this.selectedAddress()?.id === address.id) {
                this.selectAddress(updated);
              }
            }
          });
        }
        this.closeEditDialog();
        this.notifications.notify('Address updated successfully!', 'success');
      },
      error: () => {
        this.notifications.notify('Failed to update address', 'error');
      }
    });
  }

  placeOrder(): void {
    if (!this.checkoutForm.valid && !this.videosOnly() && !this.subscriptionsOnly()) {
      this.notifications.notify('Please complete the form before placing the order.', 'error');
      this.checkoutForm.markAllAsTouched();
      return;
    }

    if (this.items().length === 0) {
      this.notifications.notify('Your cart is empty.', 'error');
      return;
    }

    const currentUser = this.auth.user();
    const items = this.items();
    if (!currentUser) {
      this.notifications.notify('Please login to place an order', 'info');
      this.router.navigate(['/login']);
      return;
    }

    // Download items based on type
    if (this.videosOnly()) {
      this.downloadVideos(items);
    } else if (this.booksOnly()) {
      this.downloadBooks(items);
    } else if (this.subscriptionsOnly()) {
      // No downloads for subscriptions
      this.notifications.notify('Subscription activated! Access your content from your account.', 'success');
    } else if (this.mixed()) {
      this.downloadBooks(items);
      this.downloadVideos(items);
      if (this.hasSubscriptions()) {
        this.notifications.notify('Subscription activated! Access your content from your account.', 'success');
      }
    }

    const orderPayload = {
      userId: currentUser.id,
      name : this.checkoutForm.controls.fullName.value,
      email: this.checkoutForm.controls.email.value,
      address_id : this.videosOnly() || this.subscriptionsOnly() ? 0 : this.selectedAddress()?.id,
      items: items.map(item => ({
          ...item,
          rating : 0
        })
      ),
      subtotal: this.subtotal(),
      gst : 0, // tax included in subtotal
      tax: 0,
      shipping: this.shipping(),
      total: this.total(),
      status: 'processing',
      createdAt: new Date().toISOString(),
      placed_on: new Date().toISOString(),
      createdBy: currentUser.id
    };

    this.api.placeOrder(orderPayload).subscribe({
      next: (savedOrder) => {
        // create a transaction record
        const tx = {
          id: `TX-${Date.now()}`,
          orderId: savedOrder.id,
          amount: savedOrder.total,
          status: 'success',
          method: this.checkoutForm.controls.paymentMethod.value,
          createdAt: new Date().toISOString(),
          createdBy : currentUser.id
        };
        this.api.createTransaction(tx).subscribe({
          next: () => {
            // clear server-side cart for user and local cart
            this.api.clearCartForUser(currentUser.id).subscribe({
              next: () => {
                this.appState.clearCart();
                this.notifications.notify('Order placed successfully!', 'success');
                this.router.navigate(['/success'], { state: { orderId: savedOrder.id } });
              },
              error: () => {
                this.appState.clearCart();
                this.notifications.notify('Order placed, but failed to clear cart on server', 'warning');
                this.router.navigate(['/success'], { state: { orderId: savedOrder.id } });
              }
            });
          },
          error: () => {
            this.notifications.notify('Order placed but failed to record transaction', 'warning');
            this.appState.clearCart();
            this.router.navigate(['/success'], { state: { orderId: savedOrder.id } });
          }
        });
      },
      error: () => {
        this.notifications.notify('Failed to place order', 'error');
      }
    });
  }

  private downloadVideos(items: any[]): void {
    const videos = items.filter(item => item.type === 'video' && item.videoUrl);
    videos.forEach(video => {
      // Assume videoUrl is the filename, and videos are served from /videos/
      const link = document.createElement('a');
      link.href = `/videos/${video.videoUrl}`;
      link.download = video.videoUrl;
      link.click();
    });
  }

  private downloadBooks(items: any[]): void {
    const books = items.filter(item => item.type === 'book');
    books.forEach(book => {
      // For books, perhaps download a PDF or something; for now, just notify
      this.notifications.notify(`Downloading ${book.title}...`, 'info');
      // In real app, trigger download link for book file
    });
  }
}
