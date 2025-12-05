import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role, User, Permission, RolePermission } from '../../core/models/user';
import * as CryptoJS from 'crypto-js';

@Component({
  selector: 'app-role-mapping',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './role-mapping.component.html',
  styleUrl: './role-mapping.component.scss'
})
export class RoleMappingComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isEdit = computed(() => {
    const u = this.user();
    let isEdit = !!(u && u.roles && u.roles.length > 0 && u.username && u.password);
    if(isEdit){
      this.form.get('username')?.disable();
      this.form.get('password')?.disable();
      this.form.get('confirmPassword')?.disable();
    }
        return isEdit;
  });
  protected readonly user = signal<User | null>(null);
  protected readonly roles = signal<Role[]>([]);
  protected readonly selectedPermissions = signal<Permission[]>([]);

  protected readonly form: FormGroup;

  protected readonly roleSelections = signal<{ [key: string]: boolean }>({});
  protected readonly expandedRoles: { [key: number]: boolean } = {};

  constructor() {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, this.passwordValidator]],
      confirmPassword: ['', Validators.required]
    }, { validators: [this.passwordMatchValidator, this.atLeastOneRoleValidator] });

    this.route.params.subscribe(params => {
      const userId = params['id'];
      if (userId) {
        this.loadUser(userId);
      }
    });
    this.loadRoles();
  }

  private loadUser(userId: string): void {
    this.api.getUsers().subscribe({
      next: (users) => {
        const user = users.find(u => u.id === userId);
        if (user) {
          this.user.set(user);
          this.form.patchValue({
            username: user.username || user.email // fallback to email if no username
          });
          // Set selected roles
          if (user.roles) {
            this.roleSelections.update(selections => {
              const newSelections = { ...selections };
              user.roles!.forEach(roleId => {
                newSelections[roleId.toString()] = true;
              });
              return newSelections;
            });
          }
          this.updatePermissions();
        } else {
          this.notifications.notify('User not found', 'error');
          this.router.navigate(['/admin/users']);
        }
      },
      error: () => {
        this.notifications.notify('Failed to load user', 'error');
        this.router.navigate(['/admin/users']);
      }
    });
  }

  private loadRoles(): void {
    this.api.getRolesWithPermissions().subscribe({
      next: (roles) => { this.roles.set(roles); this.updatePermissions();},
      error: () => this.notifications.notify('Failed to load roles', 'error')
    });
  }

  protected onRoleChange(roleId: string, checked: boolean): void {
    this.roleSelections.update(selections => ({ ...selections, [roleId]: checked }));
    this.updatePermissions();
  }

  protected toggleRoleExpansion(roleId: number): void {
    this.expandedRoles[roleId] = !this.expandedRoles[roleId];
  }

  private updatePermissions(): void {
    const selections = this.roleSelections();
    const selectedRoleIds = Object.keys(selections).filter(id => selections[id]).map(id => id);
    const selectedRoles = this.roles().filter(role => selectedRoleIds.includes(role.id));
    const permissions = selectedRoles.flatMap(role => role.fullPermissions || []);
    // Remove duplicates
    const uniquePermissions = permissions.filter((perm, index, self) =>
      index === self.findIndex(p => p.id === perm.id)
    );
    this.form.updateValueAndValidity();
    this.selectedPermissions.set(uniquePermissions);
    console.log(this.selectedPermissions());
  }

  private passwordValidator(control: AbstractControl): { [key: string]: any } | null {
    const value = control.value;
    if (!value) return null;
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSpecial = /[#?!@$%^&*-]/.test(value);
    const isValid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecial && value.length >= 8;
    return !isValid ? { invalidPassword: true } : null;
  }

  private passwordMatchValidator(group: AbstractControl): { [key: string]: any } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  private atLeastOneRoleValidator = (group: AbstractControl): { [key: string]: any } | null => {
    const selections = this.roleSelections();
    const selectedRoles = Object.values(selections).filter(selected => selected);
    return selectedRoles.length > 0 ? null : { noRoleSelected: true };
  };

  protected checked_permission(perm: Permission, permissionType: 'create' | 'view' | 'update' | 'delete', rolePermissions: RolePermission[]): boolean {
    return rolePermissions.some(rp => rp.permission_id === perm.permission_id && rp[permissionType]);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.notifications.notify('Please fill in all required fields correctly', 'warning');
      return;
    }

    const selections = this.roleSelections();
    const selectedRoleIds = Object.keys(selections).filter(id => selections[id]);

    const confirmMessage = this.isEdit()
      ? `Are you sure you want to update the roles for user "${this.user()?.name}"?`
      : 'Are you sure you want to create this new user with the selected roles?';

    if (!confirm(confirmMessage)) {
      return;
    }

    // if (this.isEdit()) {
      // Update roles only
      let updateData = {};
      let formValue = this.form.value;
      if(this.isEdit()){// update
        updateData = {
          ...this.user(),
          created_on: new Date().toISOString(),
          // status: 'active' as 'active',
          roles: selectedRoleIds,
          updated_by: 'admin', // assume current admin
          updated_on: new Date().toISOString()
        };
      }
      else{// create
        const hashedPassword = CryptoJS.SHA256(formValue.password).toString();
        updateData = {
          ...this.user(),
          username: formValue.username,
          password: formValue.password,
          hashedPassword: hashedPassword,
          created_by: 'admin', // assume current admin
          created_on: new Date().toISOString(),
          // status: 'active' as 'active',
          roles: selectedRoleIds,
        };
      }
      this.api.updateUser(this.user()!.id, updateData).subscribe({
        next: () => {
          this.notifications.notify('User roles updated successfully', 'success');
          this.router.navigate(['/admin/users']);
        },
        error: () => this.notifications.notify('Failed to update user roles', 'error')
      });
    // } else {
    //   // Create new user
    //   const formValue = this.form.value;
    //   const hashedPassword = CryptoJS.SHA256(formValue.password).toString();
    //   const newUser = {
    //     ...this.user(),
    //     username: formValue.username,
    //     passsword: formValue.password,
    //     hashedPassword: hashedPassword,
    //     roles: selectedRoleIds,
    //     created_by: 'admin', // assume current admin
    //     created_on: new Date().toISOString(),
    //     status: 'active' as 'active'
    //   };
    //   this.api.createUser(newUser).subscribe({
    //     next: () => {
    //       this.notifications.notify('User created successfully', 'success');
    //       this.router.navigate(['/admin/users']);
    //     },
    //     error: () => this.notifications.notify('Failed to create user', 'error')
    //   });
    // }
  }

  protected isPermissionChecked(perm: Permission, permissionType: 'create' | 'view' | 'update' | 'delete'): boolean {
    return perm.permissions[permissionType] === 1;
  }

  protected cancel(): void {
    this.router.navigate(['/admin/users']);
  }
}
