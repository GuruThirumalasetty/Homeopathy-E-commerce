import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product';
import { common_response } from '../../core/models/common_response';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss'
})
export class AdminProductsComponent {
  private readonly app_state = inject(AppStateService);
  private readonly auth = inject(AuthService);
  private readonly user = signal(this.auth.user());
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

  // handle file input change for image upload (accepts jpg/png)
  protected uploadedImages = signal<any[]>([]);
  protected readonly displaying_images = computed(()=> this.uploadedImages().filter(x=>x.mode !== 3) || []);
  
  constructor() {
    this.loadProducts();
    this.loadCategories();
  }

  private loadProducts(): void {
    this.api.getProducts().subscribe({
      next: (response: common_response) => {
        if(response && response.status_code == 200){
          let products = response.data || [];
          this.products.set(products);
        }
        else{
          this.products.set([]);
          this.notifications.notify(response.message);
        }
      },
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
      next: (result : common_response) => {
        if(result.status_code == 200){
          let categories = result.data || [];
          this.categories.set(categories || []);
        }
        else{
          this.categories.set([]);
          this.notifications.notify(result.message);
        }
      },
      error: () => {
        this.notifications.notify('Failed to load categories', 'error');
        this.categories.set([]);
      }
    });
  }

  protected readonly productForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    contributor_name: new FormControl('', { nonNullable: true }),
    // instructor: new FormControl('', { nonNullable: true }),
    stock_quantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    price: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    discount: new FormControl(0),
    discount_type: new FormControl<'percentage' | 'fixed'>('percentage', { nonNullable: true }),
    shipping_charges: new FormControl(0),
    tax: new FormControl(0),
    type: new FormControl<'book' | 'video'>('book', { nonNullable: true }),
    category_id: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { }),
    status: new FormControl(1, { }),
    image: new FormControl('', { nonNullable: true }),
    images: new FormControl(),
    rating: new FormControl(4.5, { nonNullable: true, validators: [Validators.min(0), Validators.max(5)] }),
    videoUrl: new FormControl('', { nonNullable: true })
  });

  submit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const formValue = this.productForm.value;
    // const selectedCategory = this.categories().find(c => c.id === formValue.category_id);
    const editingId = this.editingProductId();
    const productData: Product = {
      id: editingId || 0,
      name: formValue.name ?? '',
      code: formValue.code || '',
      stock_quantity: Number(formValue.stock_quantity),
      price: Number(formValue.price),
      discount: Number(formValue.discount),
      discount_type: formValue.discount_type ?? 'percentage',
      shipping_charges : formValue.type == 'book' ? formValue.shipping_charges ?? 0 : 0,
      tax : formValue.type == 'book' ? formValue.tax ?? 0 : 0,
      type: formValue.type ?? 'book',
      category_id: formValue.category_id ?? 0,
      image: formValue.image ?? '',
      rating: Number(formValue.rating) ?? 4.5,
      description: formValue.description ?? 'New product added via admin panel.',
      contributor_name: formValue.type === 'book' ? formValue.contributor_name : undefined,
      status: formValue.status || 1,
      videoUrl: formValue.type === 'video' ? formValue.videoUrl : undefined
    };

    // ensure productData.image uses uploaded image if available
    if (this.uploadedImages().length) {
      (productData as any).files_list = this.uploadedImages().map(file=>{
        return {
          "id": file.id || 0,
          "product_id": editingId || 0,
          "file_name": file.file_name,
          "file_path": file.file_path,
          "file_type": file.file_type,
          "status": file.status || 1,
          "mode": file.mode || 1,
          "created_by": this.user()!.id,
          "updated_by": this.user()!.id
        }
      });
    }

    if (editingId !== null) {
      // prevent updates if product exists in any cart
      if (this.productIdsInCart().has(editingId)) {
        this.notifications.notify('Cannot update product that exists in a cart', 'error');
        return;
      }
      this.api.updateProduct(productData).subscribe({
        next: (response: common_response) => {
          if(response && response.status_code == 200){
          this.notifications.notify('Product updated successfully!', 'success');
            this.loadProducts();
            this.resetForm();
          }
          else{
            this.notifications.notify(response.message);
          }
        },
        error: () => {
          this.notifications.notify('Failed to update product', 'error');
        }
      });
    } else {
      this.api.createProduct(productData).subscribe({
        next: (response: common_response) => {
          if(response && response.status_code == 200){
            this.notifications.notify('Product added successfully!', 'success');
            this.loadProducts();
            this.resetForm();
          }
          else{
            this.notifications.notify(response.message);
          }
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
      name: product.name,
      code: product.code,
      stock_quantity: product.stock_quantity,
      price: product.price,
      discount: product.discount,
      discount_type: product.discount_type ?? 'percentage',
      shipping_charges : product.shipping_charges || 0,
      tax: product.tax || 0,
      type: product.type,
      category_id: product.category_id ?? 0,
      description: product.description,
      image: product.image,
      rating: product.rating,
      contributor_name: product.contributor_name,
      status: product.status || 1,
      videoUrl: product.videoUrl ?? ''
    });
    this.uploadedImageDataUrl = product.image ?? null;
    this.uploadedVideoFileName = product.videoUrl ? product.videoUrl.split('/').pop() || null : null;
    let uploaded_images = product.files_list?.map((x: any)=>{
      return {
        ...x,
        mode: 2
      }
    }) || [];
    this.uploadedImages.set(uploaded_images);
  }

  deleteProduct(id: number): void {
    if (this.productIdsInCart().has(id)) {
      this.notifications.notify('Cannot delete product that exists in a cart', 'error');
      return;
    }
    if (confirm('Are you sure you want to delete this product?')) {
      this.api.deleteProduct({ id: id, status: 0}).subscribe({
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
      name: '',
      code: '',
      contributor_name: '',
      stock_quantity: 0,
      price: 0,
      discount: 0,
      discount_type: 'percentage',
      shipping_charges : 0,
      tax : 0,
      type: 'book',
      category_id: 0,
      description: '',
      image: '',
      rating: 4.5,
      videoUrl: ''
    });
    this.editingProductId.set(null);
    this.showForm.set(false);
    this.uploadedImageDataUrl = null;
    this.uploadedVideoFileName = null;
    this.uploadedImages.set([]);
  }
handleImageFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const allowed = ['image/jpeg', 'image/png'];

  Array.from(input.files).forEach(file => {
    if (!allowed.includes(file.type)) {
      this.notifications.notify('Only JPG and PNG images are allowed', 'error');
      input.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;

      // ✔ Add new image using signal.update()
      this.uploadedImages.update(images => [
        ...images,
        { file_path: result,file_name: file.name, file_type: 'photo', file, status: 0, mode: 1 }
      ]);

      // ✔ Patch the form with full images data (mode 1,2,3)
      this.productForm.patchValue({
        images: this.uploadedImages()
      });
    };

    reader.readAsDataURL(file);
  });
}

removeImage(image: any, index: number): void {

  this.uploadedImages.update(images => {
    // Case 1: Remove completely if mode == 1
    if (image.mode === 1) {
      return images.filter((_, i) => i !== index);  // new array
    }
    // Case 2: Change mode to 3
    return images.map(img =>
      img === image ? { ...img, mode: 3 } : img   // new object
    );
  });

  // update form value also
  this.productForm.patchValue({
    images: this.uploadedImages()
  });
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
