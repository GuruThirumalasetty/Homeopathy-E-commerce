import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly user = this.authService.user;
  protected readonly isEditMode = signal(false);
  protected readonly isChangePasswordMode = signal(false);
  protected readonly isLoading = signal(false);

  protected editForm: FormGroup;
  protected passwordForm: FormGroup;

  constructor() {
    const currentUser = this.authService.user();
    
    this.editForm = this.fb.group({
      name: [currentUser?.name || '', [Validators.required, Validators.minLength(2)]],
      email: [currentUser?.email || '', [Validators.required, Validators.email]],
      mobile_number: [currentUser?.mobile_number || '', [Validators.required, Validators.maxLength(10)]]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  toggleEditMode(): void {
    // Toggle edit mode and ensure change-password mode is disabled when entering edit
    const entering = !this.isEditMode();
    this.isEditMode.set(entering);
    if (entering) {
      this.isChangePasswordMode.set(false);
    } else {
      this.resetEditForm();
    }
  }

  togglePasswordMode(): void {
    // Toggle change-password mode and ensure edit mode is disabled when entering password change
    const entering = !this.isChangePasswordMode();
    this.isChangePasswordMode.set(entering);
    if (entering) {
      this.isEditMode.set(false);
    } else {
      this.passwordForm.reset();
    }
  }

  saveProfile(): void {
    if (this.editForm.invalid) {
      this.notifications.notify('Please fix the errors in the form', 'error');
      return;
    }

    this.isLoading.set(true);

    try {
      const { name, email, mobile_number } = this.editForm.value;
      const currentUser = this.authService.user();

      if (!currentUser) {
        this.notifications.notify('User not found', 'error');
        this.isLoading.set(false);
        return;
      }

      // Update user profile
      this.authService.updateUserProfile(currentUser.id, { name, email, mobile_number }).subscribe(success => {
        if (success) {
          this.notifications.notify('Profile updated successfully', 'success');
          this.isEditMode.set(false);
        } else {
          this.notifications.notify('Failed to update profile', 'error');
        }
      }, () => {
        this.notifications.notify('Failed to update profile', 'error');
      });
    } catch (error) {
      this.notifications.notify('Failed to update profile', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.notifications.notify('Please fix the errors in the form', 'error');
      return;
    }

    this.isLoading.set(true);

    try {
      const { currentPassword, newPassword } = this.passwordForm.value;
      const currentUser = this.authService.user();

      if (!currentUser) {
        this.notifications.notify('User not found', 'error');
        this.isLoading.set(false);
        return;
      }

      // Client-side guard: new password must be different from current
      if (currentPassword === newPassword) {
        this.notifications.notify('New password must be different from current password', 'error');
        this.isLoading.set(false);
        return;
      }

      // Verify current password and change password
      this.authService.changePassword(currentUser.email, currentPassword, newPassword).subscribe(success => {
        if (success) {
          this.notifications.notify('Password changed successfully. Please login again with your new password.', 'success');
          this.isChangePasswordMode.set(false);
          this.passwordForm.reset();
          setTimeout(() => this.authService.logout(), 1500);
        } else {
          this.notifications.notify('Current password is incorrect', 'error');
        }
      }, () => {
        this.notifications.notify('Failed to change password', 'error');
      });
    } catch (error) {
      this.notifications.notify('Failed to change password', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  resetEditForm(): void {
    const currentUser = this.authService.user();
    this.editForm.patchValue({
      name: currentUser?.name || '',
      email: currentUser?.email || ''
    });
  }

  logout(): void {
    this.authService.logout();
  }

  private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const current = group.get('currentPassword');
    const newPassword = group.get('newPassword');
    const confirmPassword = group.get('confirmPassword');

    let hasError = false;

    // Password mismatch: new vs confirm
    if (newPassword && confirmPassword) {
      if (newPassword.value !== confirmPassword.value) {
        const prev = confirmPassword.errors || {};
        confirmPassword.setErrors({ ...prev, passwordMismatch: true });
        hasError = true;
      } else {
        if (confirmPassword.errors) {
          const copy = { ...confirmPassword.errors };
          delete copy['passwordMismatch'];
          const keys = Object.keys(copy);
          confirmPassword.setErrors(keys.length ? copy : null);
        }
      }
    }

    // Password same as current: new must differ from current
    if (current && newPassword) {
      if (current.value && newPassword.value && current.value === newPassword.value) {
        const prev = newPassword.errors || {};
        newPassword.setErrors({ ...prev, passwordSame: true });
        hasError = true;
      } else {
        if (newPassword.errors) {
          const copy = { ...newPassword.errors };
          delete copy['passwordSame'];
          const keys = Object.keys(copy);
          newPassword.setErrors(keys.length ? copy : null);
        }
      }
    }

    return hasError ? { passwordValidation: true } : null;
  }
}
