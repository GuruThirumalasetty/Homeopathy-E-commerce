import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { User, UserRole } from '../../core/models/user';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss'
})
export class AdminUsersComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly users = signal<User[]>([]);
  protected readonly isCreating = signal(false);
  protected readonly editingUser = signal<User | null>(null);

  protected readonly userForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    mobile_number: [''],
    role: ['user' as UserRole, Validators.required],
    status: ['active', Validators.required]
  });

  protected readonly roles: UserRole[] = ['guest', 'user', 'admin'];
  protected readonly statuses = ['active', 'inactive'];

  constructor() {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.api.getUsers().subscribe({
      next: (list) => this.users.set(list.filter(x=>x.role != 'customer') || []),
      error: () => {
        this.notifications.notify('Failed to load users', 'error');
        this.users.set([]);
      }
    });
  }

  protected startCreate(): void {
    this.isCreating.set(true);
    this.editingUser.set(null);
    this.userForm.reset({
      name: '',
      email: '',
      mobile_number: '',
      role: 'customer',
      status: 'active'
    });
  }

  protected startEdit(user: User): void {
    this.isCreating.set(false);
    this.editingUser.set(user);
    this.userForm.patchValue({
      name: user.name,
      email: user.email,
      mobile_number: user.mobile_number || '',
      role: user.role,
      status: user.status || 'active'
    });
  }

  protected cancelEdit(): void {
    this.isCreating.set(false);
    this.editingUser.set(null);
    this.userForm.reset();
  }

  protected saveUser(): void {
    if (this.userForm.invalid) {
      this.notifications.notify('Please fill in all required fields correctly', 'warning');
      return;
    }

    const formValue = this.userForm.value;

    if (this.isCreating()) {
      this.api.createUser(formValue).subscribe({
        next: () => {
          this.notifications.notify('User created successfully', 'success');
          this.loadUsers();
          this.cancelEdit();
        },
        error: () => this.notifications.notify('Failed to create user', 'error')
      });
    } else if (this.editingUser()) {
      this.api.updateUser(this.editingUser()!.id, formValue).subscribe({
        next: () => {
          this.notifications.notify('User updated successfully', 'success');
          this.loadUsers();
          this.cancelEdit();
        },
        error: () => this.notifications.notify('Failed to update user', 'error')
      });
    }
  }

  protected deleteUser(user: User): void {
    if (!confirm(`Are you sure you want to delete user "${user.name}"? This action cannot be undone.`)) {
      return;
    }

    this.api.deleteUser(user.id).subscribe({
      next: () => {
        this.notifications.notify('User deleted successfully', 'success');
        this.loadUsers();
      },
      error: () => this.notifications.notify('Failed to delete user', 'error')
    });
  }

  protected navigateToRoleMapping(user: User): void {
    this.router.navigate(['/admin/role-mapping', user.id]);
  }

  protected hasRolesAssigned(user: User): boolean {
    return !!(user.roles && user.roles.length > 0);
  }
}
