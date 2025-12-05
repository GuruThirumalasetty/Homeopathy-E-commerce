import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { Permission, RolePermission } from '../../core/models/user';

@Component({
  selector: 'app-role-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-create.html',
  styleUrl: './role-create.scss'
})
export class RoleCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  roleForm: FormGroup;
  permissions: Permission[] = [];
  permissionActions: Map<number, { create: boolean; view: boolean; update: boolean; delete: boolean }> = new Map();
  isEditMode = false;
  roleId: number | null = null;
  isLoading = false;

  constructor() {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit() {
    this.loadPermissions();
    this.checkEditMode();
  }

  checkEditMode() {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEditMode = true;
      this.roleId = id;
      this.loadRole();
    }
  }

  loadPermissions() {
    this.api.getRolePermissions().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
        // Initialize permission actions for each permission
        permissions.forEach(perm => {
          this.permissionActions.set(perm.permission_id, { create: false, view: false, update: false, delete: false });
        });
      },
      error: () => {
        this.notifications.notify('Failed to load permissions', 'error');
      }
    });
  }

  loadRole() {
    if (!this.roleId) return;
    this.isLoading = true;
    this.api.getRolesWithPermissions().subscribe({
      next: (roles) => {
        const role = roles.find(r => r.id === this.roleId);
        if (role) {
          this.roleForm.patchValue({
            name: role.name,
            description: role.description
          });
          // Set permission actions
          role.permissions.forEach(rp => {
            this.permissionActions.set(rp.permission_id, {
              create: rp.create,
              view: rp.view,
              update: rp.update,
              delete: rp.delete
            });
          });
        } else {
          this.notifications.notify('Role not found', 'error');
          this.router.navigate(['/admin/roles']);
        }
        this.isLoading = false;
      },
      error: () => {
        this.notifications.notify('Failed to load role', 'error');
        this.isLoading = false;
      }
    });
  }

  togglePermissionAction(permissionId: number, action: 'create' | 'view' | 'update' | 'delete') {
    const actions = this.permissionActions.get(permissionId);
    if (actions) {
      actions[action] = !actions[action];
    }
  }

  getPermissionAction(permissionId: number, action: 'create' | 'view' | 'update' | 'delete'): boolean {
    return this.permissionActions.get(permissionId)?.[action] || false;
  }

  getSelectedPermissionsCount(): number {
    let count = 0;
    this.permissionActions.forEach(actions => {
      if (actions.create || actions.view || actions.update || actions.delete) {
        count++;
      }
    });
    return count;
  }

  onSubmit() {
    if (this.roleForm.valid && this.getSelectedPermissionsCount() > 0) {
      const rolePermissions: any[] = [];
      this.permissionActions.forEach((actions, permissionId) => {
        if (actions.create || actions.view || actions.update || actions.delete) {
          rolePermissions.push({
            permission_id: permissionId,
            create: actions.create ? 1 : 0,
            view: actions.view ? 1 : 0,
            update: actions.update ? 1 : 0,
            delete: actions.delete ? 1 : 0,
          });
        }
      });

      const roleData = {
        name: this.roleForm.value.name,
        description: this.roleForm.value.description,
        permissions: rolePermissions
      };

      const apiCall = this.isEditMode && this.roleId
        ? this.api.updateRole(this.roleId, roleData)
        : this.api.createRole(roleData);

      apiCall.subscribe({
        next: () => {
          this.notifications.notify(`Role ${this.isEditMode ? 'updated' : 'created'} successfully`, 'success');
          this.router.navigate(['/admin/roles']);
        },
        error: () => {
          this.notifications.notify(`Failed to ${this.isEditMode ? 'update' : 'create'} role`, 'error');
        }
      });
    } else {
      this.notifications.notify('Please fill all fields and select at least one permission action', 'warning');
    }
  }

  cancel() {
    this.router.navigate(['/admin/roles']);
  }
}