import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class SignupComponent {
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly signupForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    mobile_number: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(10)] })
  });

  protected readonly isLoading = signal(false);

  submit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const { name, email, password, mobile_number } = this.signupForm.value;

    this.authService.register(name ?? '', email ?? '', password ?? '', mobile_number ?? '').subscribe(success => {
      if (success) {
        this.notifications.notify('Account created successfully!', 'success');
        this.router.navigate(['/']);
      } else {
        this.notifications.notify('Email already registered', 'error');
      }
      this.isLoading.set(false);
    }, () => {
      this.notifications.notify('Registration failed', 'error');
      this.isLoading.set(false);
    });
  }
}
