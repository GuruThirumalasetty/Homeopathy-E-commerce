import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss'
})
export class AdminProductsComponent {
  private readonly appState = inject(AppStateService);
  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly products = signal<Product[]>([]);
  // set of productIds that exist in any cart (prevents edit/delete)
  protected readonly productIdsInCart = signal<Set<number>>(new Set());
  // temporary preview/data-url for uploaded image
  protected uploadedImageDataUrl: string | null = null;
  protected uploadedVideoFileName: string | null = null;
  protected readonly editingProductId = signal<number | null>(null);
  protected readonly showForm = signal(false);
  protected readonly categories = signal<any[]>([]);

  search_products : FormControl = new FormControl('');

  constructor() {
    this.loadProducts();
    this.loadCategories();
  }

  private loadProducts(): void {
    this.api.getProducts().subscribe({
      next: (products) => this.products.set(products || []),
      error: () => {
        this.notifications.notify('Failed to load products', 'error');
        this.products.set([]);
      }
    });
    // also load cart items to determine which products are in carts
    this.api.getCart().subscribe({
      next: (items) => {
        const ids = new Set<number>();
        (items || []).forEach((it: any) => {
          if (typeof it.productId === 'number') ids.add(it.productId);
          else ids.add(Number(it.productId));
        });
        this.productIdsInCart.set(ids);
      },
      error: () => this.productIdsInCart.set(new Set())
    });
  }

  private loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (categories) => this.categories.set(categories || []),
      error: () => {
        this.notifications.notify('Failed to load categories', 'error');
        this.categories.set([]);
      }
    });
  }

  protected readonly productForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    author: new FormControl('', { nonNullable: true }),
    instructor: new FormControl('', { nonNullable: true }),
    stock_quantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    price: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    discount: new FormControl(0),
    discountType: new FormControl<'percentage' | 'fixed'>('percentage', { nonNullable: true }),
    shipping_charges: new FormControl(0),
    tax: new FormControl(0),
    type: new FormControl<'book' | 'video'>('book', { nonNullable: true }),
    categoryId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { }),
    image: new FormControl('', { nonNullable: true }),
    rating: new FormControl(4.5, { nonNullable: true, validators: [Validators.min(0), Validators.max(5)] }),
    videoUrl: new FormControl('', { nonNullable: true })
  });

  submit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const formValue = this.productForm.value;
    const selectedCategory = this.categories().find(c => c.id === formValue.categoryId);
    const productData: Omit<Product, 'id'> = {
      title: formValue.title ?? '',
      stock_quantity: Number(formValue.stock_quantity),
      price: Number(formValue.price),
      discount: Number(formValue.discount),
      discountType: formValue.discountType ?? 'percentage',
      shipping_charges : formValue.type == 'book' ? formValue.shipping_charges ?? 0 : 0,
      tax : formValue.type == 'book' ? formValue.tax ?? 0 : 0,
      type: formValue.type ?? 'book',
      category: selectedCategory?.name ?? 'general', // keep for backward compatibility
      categoryId: formValue.categoryId ?? '',
      categoryName: selectedCategory?.name ?? '',
      image: formValue.image ?? '',
      rating: Number(formValue.rating) ?? 4.5,
      description: formValue.description ?? 'New product added via admin panel.',
      author: formValue.type === 'book' ? formValue.author : undefined,
      instructor: formValue.type === 'video' ? formValue.instructor : undefined,
      videoUrl: formValue.type === 'video' ? formValue.videoUrl : undefined
    };

    const editingId = this.editingProductId();
    // ensure productData.image uses uploaded image if available
    if (this.uploadedImageDataUrl) {
      (productData as any).image = this.uploadedImageDataUrl;
    }

    if (editingId !== null) {
      // prevent updates if product exists in any cart
      if (this.productIdsInCart().has(editingId)) {
        this.notifications.notify('Cannot update product that exists in a cart', 'error');
        return;
      }
      this.api.updateProduct(editingId, productData).subscribe({
        next: () => {
          this.notifications.notify('Product updated successfully!', 'success');
          this.loadProducts();
          this.resetForm();
        },
        error: () => {
          this.notifications.notify('Failed to update product', 'error');
        }
      });
    } else {
      this.api.createProduct(productData).subscribe({
        next: () => {
          this.notifications.notify('Product added successfully!', 'success');
          this.loadProducts();
          this.resetForm();
        },
        error: () => {
          this.notifications.notify('Failed to add product', 'error');
        }
      });
    }
  }

  editProduct(product: Product): void {
    if (this.productIdsInCart().has(product.id)) {
      this.notifications.notify('This product is present in a cart and cannot be edited', 'info');
      return;
    }
    this.editingProductId.set(product.id);
    this.showForm.set(true);
    this.productForm.patchValue({
      title: product.title,
      stock_quantity: product.stock_quantity,
      price: product.price,
      discount: product.discount,
      discountType: product.discountType ?? 'percentage',
      shipping_charges : product.shipping_charges || 0,
      tax: product.tax || 0,
      type: product.type,
      categoryId: product.categoryId ?? '',
      description: product.description,
      image: product.image,
      rating: product.rating,
      author: product.author,
      instructor: product.instructor,
      videoUrl: product.videoUrl ?? ''
    });
    this.uploadedImageDataUrl = product.image ?? null;
    this.uploadedVideoFileName = product.videoUrl ? product.videoUrl.split('/').pop() || null : null;
  }

  deleteProduct(id: number): void {
    if (this.productIdsInCart().has(id)) {
      this.notifications.notify('Cannot delete product that exists in a cart', 'error');
      return;
    }
    if (confirm('Are you sure you want to delete this product?')) {
      this.api.deleteProduct(id).subscribe({
        next: () => {
          this.notifications.notify('Product deleted successfully!', 'success');
          this.loadProducts();
        },
        error: () => {
          this.notifications.notify('Failed to delete product', 'error');
        }
      });
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.productForm.reset({
      title: '',
      author: '',
      instructor: '',
      stock_quantity: 0,
      price: 0,
      discount: 0,
      discountType: 'percentage',
      shipping_charges : 0,
      tax : 0,
      type: 'book',
      categoryId: '',
      description: '',
      image: '',
      rating: 4.5,
      videoUrl: ''
    });
    this.editingProductId.set(null);
    this.showForm.set(false);
    this.uploadedImageDataUrl = null;
    this.uploadedVideoFileName = null;
  }

  // handle file input change for image upload (accepts jpg/png)
  handleImageFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const allowed = ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      this.notifications.notify('Only JPG and PNG images are allowed', 'error');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.uploadedImageDataUrl = result;
      // set form image value to data url so it's persisted with product
      this.productForm.patchValue({ image: result });
    };
    reader.readAsDataURL(file);
  }

  // handle file input change for video upload (accepts mp4)
  handleVideoFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const allowed = ['video/mp4'];
    if (!allowed.includes(file.type)) {
      this.notifications.notify('Only MP4 videos are allowed', 'error');
      input.value = '';
      return;
    }
    this.uploadedVideoFileName = file.name;
    // For simplicity, store the filename as videoUrl; in real app, upload to server
    this.productForm.patchValue({ videoUrl: file.name });
  }
}
