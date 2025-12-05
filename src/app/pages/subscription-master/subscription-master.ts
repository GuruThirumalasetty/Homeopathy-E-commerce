import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from '../../core/models/subscription';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-subscription-master',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './subscription-master.html',
  styleUrl: './subscription-master.scss'
})
export class SubscriptionMasterComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly subscriptions = signal<Subscription[]>([]);
  protected readonly editingSubscriptionId = signal<number | null>(null);
  protected readonly showForm = signal(false);

  ngOnInit(): void {
    // Check if user is admin
    const currentUser = this.auth.user();
    if (!currentUser || currentUser.role !== 'admin') {
      this.notifications.notify('Access denied. Admin privileges required.', 'error');
      this.router.navigate(['/home']);
      return;
    }

    this.loadSubscriptions();
  }

  private loadSubscriptions(): void {
    this.api.getSubscriptions().subscribe({
      next: (subscriptions) => this.subscriptions.set(subscriptions || []),
      error: () => {
        this.notifications.notify('Failed to load subscriptions', 'error');
        this.subscriptions.set([]);
      }
    });
  }

  protected readonly subscriptionForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl('book', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    price: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    discount: new FormControl(0, { validators: [Validators.min(0)] }),
    discountType: new FormControl<'percentage' | 'fixed'>('percentage', { nonNullable: true }),
    duration: new FormControl<'monthly' | 'yearly'>('monthly', { nonNullable: true, validators: [Validators.required] }),
    benefits: new FormArray<FormControl<string>>([]),
    limitations: new FormArray<FormControl<string>>([]),
    popular: new FormControl(false, { nonNullable: true })
  });

  get benefits(): FormArray {
    return this.subscriptionForm.get('benefits') as FormArray;
  }

  get limitations(): FormArray {
    return this.subscriptionForm.get('limitations') as FormArray;
  }

  protected addBenefit(): void {
    this.benefits.push(new FormControl('', { nonNullable: true, validators: [Validators.required] }));
  }

  protected removeBenefit(index: number): void {
    this.benefits.removeAt(index);
  }

  protected addLimitation(): void {
    this.limitations.push(new FormControl('', { nonNullable: true, validators: [Validators.required] }));
  }

  protected removeLimitation(index: number): void {
    this.limitations.removeAt(index);
  }

  protected submit(): void {
    if (this.subscriptionForm.invalid) {
      this.subscriptionForm.markAllAsTouched();
      return;
    }

    const formValue = this.subscriptionForm.value;
    const subscriptionData: Omit<Subscription, 'id'> = {
      name: formValue.name ?? '',
      type : formValue.type || '',
      description: formValue.description ?? '',
      price: Number(formValue.price),
      discount: Number(formValue.discount) || 0,
      discountType: formValue.discountType ?? 'percentage',
      duration: formValue.duration ?? 'monthly',
      benefits: this.benefits.value.filter((b: string) => b.trim()),
      limitations: this.limitations.value.filter((l: string) => l.trim()),
      popular: formValue.popular ?? false
    };

    const editingId = this.editingSubscriptionId();

    if (editingId !== null) {
      this.api.updateSubscription(editingId, subscriptionData).subscribe({
        next: () => {
          this.notifications.notify('Subscription updated successfully!', 'success');
          this.loadSubscriptions();
          this.resetForm();
        },
        error: () => {
          this.notifications.notify('Failed to update subscription', 'error');
        }
      });
    } else {
      this.api.createSubscription(subscriptionData).subscribe({
        next: () => {
          this.notifications.notify('Subscription added successfully!', 'success');
          this.loadSubscriptions();
          this.resetForm();
        },
        error: () => {
          this.notifications.notify('Failed to add subscription', 'error');
        }
      });
    }
  }

  protected editSubscription(subscription: Subscription): void {
    this.editingSubscriptionId.set(subscription.id);
    this.showForm.set(true);

    // Clear existing arrays
    while (this.benefits.length) {
      this.benefits.removeAt(0);
    }
    while (this.limitations.length) {
      this.limitations.removeAt(0);
    }

    // Add benefits
    subscription.benefits.forEach(benefit => {
      this.benefits.push(new FormControl(benefit, { nonNullable: true, validators: [Validators.required] }));
    });

    // Add limitations
    subscription.limitations.forEach(limitation => {
      this.limitations.push(new FormControl(limitation, { nonNullable: true, validators: [Validators.required] }));
    });

    this.subscriptionForm.patchValue({
      name: subscription.name,
      description: subscription.description,
      price: subscription.price,
      discount: subscription.discount || 0,
      discountType: subscription.discountType || 'percentage',
      duration: subscription.duration,
      popular: subscription.popular || false,
      type: subscription.type || 'book',
    });
  }

  protected deleteSubscription(id: number): void {
    if (confirm('Are you sure you want to delete this subscription?')) {
      this.api.deleteSubscription(id).subscribe({
        next: () => {
          this.notifications.notify('Subscription deleted successfully!', 'success');
          this.loadSubscriptions();
        },
        error: () => {
          this.notifications.notify('Failed to delete subscription', 'error');
        }
      });
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.subscriptionForm.reset({
      name: '',
      description: '',
      price: 0,
      discount: 0,
      discountType: 'percentage',
      duration: 'monthly',
      popular: false
    });

    // Clear arrays
    while (this.benefits.length) {
      this.benefits.removeAt(0);
    }
    while (this.limitations.length) {
      this.limitations.removeAt(0);
    }

    this.editingSubscriptionId.set(null);
    this.showForm.set(false);
  }

  // Helper methods for displaying pricing
  protected getDiscountedPrice(subscription: Subscription): number {
    const { price, discount, discountType } = subscription;
    if (!discount || discount === 0) return price;

    if (discountType === 'percentage') {
      return price - (price * discount / 100);
    } else {
      return Math.max(0, price - discount);
    }
  }

  protected getDiscountAmount(subscription: Subscription): number {
    const { price, discount, discountType } = subscription;
    if (!discount || discount === 0) return 0;

    if (discountType === 'percentage') {
      return price * discount / 100;
    } else {
      return discount;
    }
  }

  // Helper methods for form preview
  protected getFormDiscountedPrice(): number {
    const formValue = this.subscriptionForm.value;
    const price = formValue.price || 0;
    const discount = formValue.discount || 0;
    const discountType = formValue.discountType || 'percentage';

    if (!discount || discount === 0) return price;

    if (discountType === 'percentage') {
      return price - (price * discount / 100);
    } else {
      return Math.max(0, price - discount);
    }
  }

  protected getFormDiscountAmount(): number {
    const formValue = this.subscriptionForm.value;
    const price = formValue.price || 0;
    const discount = formValue.discount || 0;
    const discountType = formValue.discountType || 'percentage';

    if (!discount || discount === 0) return 0;

    if (discountType === 'percentage') {
      return price * discount / 100;
    } else {
      return discount;
    }
  }
}