import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

interface Category {
  id: string;
  name: string;
  code: string;
  // description?: string;
  // status?: string;
}

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.scss'
})
export class AdminCategoriesComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly notification = inject(NotificationService);

  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(false);
  protected readonly editingCategory = signal<Category | null>(null);
  protected readonly showForm = signal(false);

  protected readonly categoryForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(10)]],
    // description: ['', [Validators.required]],
    // status: ['Active', [Validators.required]]
  });

  constructor() {
    this.loadCategories();
  }

  protected loadCategories(): void {
    this.loading.set(true);
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories || []);
        this.loading.set(false);
      },
      error: () => {
        this.notification.notify('Failed to load categories', 'error');
        this.loading.set(false);
      }
    });
  }

  protected onSubmit(): void {
    if (this.categoryForm.invalid) return;

    const formValue = this.categoryForm.value;
    const categoryData = {
      name: formValue.name.trim(),
      code: formValue.code.trim().toUpperCase(),
      // description: formValue.description.trim(),
      // status: formValue.status
    };

    this.loading.set(true);

    if (this.editingCategory()) {
      // Update
      this.api.updateCategory(this.editingCategory()!.id, categoryData).subscribe({
        next: () => {
          this.notification.notify('Category updated successfully', 'success');
          this.loadCategories();
          this.resetForm();
        },
        error: () => {
          this.notification.notify('Failed to update category', 'error');
          this.loading.set(false);
        }
      });
    } else {
      // Create
      this.api.createCategory(categoryData).subscribe({
        next: () => {
          this.notification.notify('Category created successfully', 'success');
          this.loadCategories();
          this.resetForm();
        },
        error: () => {
          this.notification.notify('Failed to create category', 'error');
          this.loading.set(false);
        }
      });
    }
  }

  protected showAddForm(): void {
    this.showForm.set(true);
    this.categoryForm.reset({ status: 'Active' });
    this.editingCategory.set(null);
    this.loading.set(false);
  }

  protected editCategory(category: Category): void {
    this.showForm.set(true);
    this.editingCategory.set(category);
    this.categoryForm.patchValue({
      name: category.name,
      code: category.code,
      // description: category.description || '',
      // status: category.status || 'Active'
    });
  }

  protected deleteCategory(category: Category): void {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    this.loading.set(true);
    this.api.deleteCategory(category.id).subscribe({
      next: () => {
        this.notification.notify('Category deleted successfully', 'success');
        this.loadCategories();
      },
      error: () => {
        this.notification.notify('Failed to delete category', 'error');
        this.loading.set(false);
      }
    });
  }

  protected resetForm(): void {
    this.categoryForm.reset({ status: 'Active' });
    this.editingCategory.set(null);
    this.showForm.set(false);
    this.loading.set(false);
  }

  protected get isAdmin(): boolean {
    return this.auth.isAdmin();
  }
}