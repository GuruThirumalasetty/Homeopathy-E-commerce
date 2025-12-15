import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { common_response } from '../../core/models/common_response';
import { PermissionEntity } from '../../core/models/user';

@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-permissions.html',
  styleUrl: './admin-permissions.scss'
})
export class AdminPermissionsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly notification = inject(NotificationService);

  protected readonly permissions = signal<PermissionEntity[]>([]);
  protected readonly loading = signal(false);
  protected readonly editingPermission = signal<PermissionEntity | null>(null);
  protected readonly showForm = signal(false);
  protected readonly user = signal(this.auth.user());

  protected readonly permissionForm: FormGroup = this.fb.group({
    id: [0],
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    link: ['', [Validators.required]],
    is_nav_visible: [1],
    status: [1],
    icon: ['', [Validators.required]]
  });

  constructor() {
    this.loadPermissions();
  }

  protected loadPermissions(): void {
    this.loading.set(true);
    this.api.getPermissions().subscribe({
      next: (result: common_response) => {
        this.loading.set(false);
        if (result.status_code == 200) {
          let permissions = result.data || [];
          this.permissions.set(permissions || []);
        } else {
          this.permissions.set([]);
          this.notification.notify(result.message);
        }
      },
      error: () => {
        this.notification.notify('Failed to load permissions', 'error');
        this.loading.set(false);
      }
    });
  }

  protected onSubmit(): void {
    if (this.permissionForm.invalid) return;

    const formValue = this.permissionForm.value;
    const permissionData = {
      id: formValue.id || 0,
      name: formValue.name.trim(),
      description: formValue.description.trim(),
      link: formValue.link.trim(),
      is_nav_visible: formValue.is_nav_visible || 1,
      status: formValue.status || 1,
      icon: formValue.icon.trim(),
      created_by: +this.user()!.id || 0,
      updated_by: +this.user()!.id || 0,
    };

    this.loading.set(true);

    if (this.editingPermission()) {
      // Update
      this.api.updatePermission(permissionData).subscribe({
        next: (responce: common_response) => {
          if (responce.status_code == 200) {
            this.notification.notify(responce.message, 'success');
            this.loadPermissions();
            this.resetForm();
          } else {
            this.notification.notify(responce.message);
          }
        },
        error: () => {
          this.notification.notify('Failed to update permission', 'error');
          this.loading.set(false);
        }
      });
    } else {
      // Create
      this.api.createPermission(permissionData).subscribe({
        next: (responce: common_response) => {
          if (responce.status_code == 200) {
            this.notification.notify(responce.message, 'success');
            this.loadPermissions();
            this.resetForm();
          } else {
            this.notification.notify(responce.message);
          }
        },
        error: () => {
          this.notification.notify('Failed to create permission', 'error');
          this.loading.set(false);
        }
      });
    }
  }

  protected showAddForm(): void {
    this.showForm.set(true);
    this.permissionForm.reset({ is_nav_visible: 1, status: 1 });
    this.editingPermission.set(null);
    this.loading.set(false);
  }

  protected editPermission(permission: PermissionEntity): void {
    this.showForm.set(true);
    this.editingPermission.set(permission);
    this.permissionForm.patchValue({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      link: permission.link,
      is_nav_visible: permission.is_nav_visible,
      status: permission.status,
      icon: permission.icon || ''
    });
  }

  protected deletePermission(permission: PermissionEntity): void {
    if (!confirm(`Are you sure you want to delete "${permission.name}"?`)) return;

    this.loading.set(true);
    this.api.deletePermission(permission).subscribe({
      next: () => {
        this.notification.notify('Permission deleted successfully', 'success');
        this.loadPermissions();
      },
      error: () => {
        this.notification.notify('Failed to delete permission', 'error');
        this.loading.set(false);
      }
    });
  }

  protected resetForm(): void {
    this.permissionForm.reset({ is_nav_visible: 1, status: 1 });
    this.editingPermission.set(null);
    this.showForm.set(false);
    this.loading.set(false);
  }

  protected get isAdmin(): boolean {
    return this.auth.isAdmin();
  }
}