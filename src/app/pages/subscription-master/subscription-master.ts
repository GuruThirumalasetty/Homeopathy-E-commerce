import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormArray
} from '@angular/forms';
import { Router } from '@angular/router';
import { features, Subscription } from '../../core/models/subscription';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

/* ---------------- TYPES ---------------- */

type FeatureForm = FormGroup<{
  id: FormControl<number>;
  name: FormControl<string>;
  status: FormControl<number>;
  mode: FormControl<number>;
}>;

/* ---------------- COMPONENT ---------------- */

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

  /* ---------------- LIFECYCLE ---------------- */

  ngOnInit(): void {
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
      next: subscriptions => this.subscriptions.set(subscriptions || []),
      error: () => {
        this.notifications.notify('Failed to load subscriptions', 'error');
        this.subscriptions.set([]);
      }
    });
  }

  /* ---------------- FORM ---------------- */

  protected readonly subscriptionForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl('book', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    price: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)]
    }),
    discount: new FormControl(0),
    discount_type: new FormControl<'percentage' | 'fixed'>('percentage', { nonNullable: true }),
    duration: new FormControl<'monthly' | 'yearly'>('monthly', {
      nonNullable: true,
      validators: [Validators.required]
    }),

    /* FEATURES */
    features: new FormArray<FeatureForm>([]),

    popular: new FormControl(false, { nonNullable: true })
  });

  /* ---------------- GETTERS ---------------- */

  get features(): FormArray<FeatureForm> {
    return this.subscriptionForm.controls.features;
  }

  get show_pof_type(): boolean {
    return this.subscriptions().some(x => x.type === 'perceptions on homeopathy');
  }

  /* ---------------- FEATURES ---------------- */

  protected addFeature(): void {
    const featureForm: FeatureForm = new FormGroup({
      id: new FormControl(0, { nonNullable: true }),
      name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      status: new FormControl(1, { nonNullable: true }),
      mode: new FormControl(1, { nonNullable: true })
    });

    this.features.push(featureForm);
  }

  protected removeFeature(index: number): void {
    this.features.removeAt(index);
  }

  /* ---------------- SUBMIT ---------------- */

  protected submit(): void {
    if (this.subscriptionForm.invalid) {
      this.subscriptionForm.markAllAsTouched();
      return;
    }

    const formValue = this.subscriptionForm.value;

    const subscriptionData: Omit<Subscription, 'id'> = {
      name: formValue.name ?? '',
      type: formValue.type ?? '',
      description: formValue.description ?? '',
      price: Number(formValue.price),
      discount: Number(formValue.discount) || 0,
      discount_type: formValue.discount_type ?? 'percentage',
      duration: formValue.duration ?? 'monthly',

      features: this.features.value as features[],

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

  /* ---------------- EDIT ---------------- */

  protected editSubscription(subscription: Subscription): void {
    this.editingSubscriptionId.set(subscription.id);
    this.showForm.set(true);

    this.features.clear();

    subscription.features?.forEach(feature => {
      const fg: FeatureForm = new FormGroup({
        id: new FormControl(feature.id, { nonNullable: true }),
        name: new FormControl(feature.name, { nonNullable: true }),
        status: new FormControl(feature.status, { nonNullable: true }),
        mode: new FormControl(feature.mode, { nonNullable: true })
      });

      this.features.push(fg);
    });

    this.subscriptionForm.patchValue({
      name: subscription.name,
      description: subscription.description,
      price: subscription.price,
      discount: subscription.discount || 0,
      discount_type: subscription.discount_type || 'percentage',
      duration: subscription.duration,
      popular: subscription.popular || false,
      type: subscription.type || 'book'
    });
  }

  /* ---------------- DELETE ---------------- */

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

  /* ---------------- RESET ---------------- */

  protected cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.subscriptionForm.reset({
      name: '',
      type: 'book',
      description: '',
      price: 0,
      discount: 0,
      discount_type: 'percentage',
      duration: 'monthly',
      popular: false
    });

    this.features.clear();

    this.editingSubscriptionId.set(null);
    this.showForm.set(false);
  }

  // Helper methods for displaying pricing
  protected getDiscountedPrice(subscription: Subscription): number {
    const { price, discount, discount_type } = subscription;
    if (!discount || discount === 0) return price;

    if (discount_type === 'percentage') {
      return price - (price * discount / 100);
    } else {
      return Math.max(0, price - discount);
    }
  }

  protected getDiscountAmount(subscription: Subscription): number {
    const { price, discount, discount_type } = subscription;
    if (!discount || discount === 0) return 0;

    if (discount_type === 'percentage') {
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
    const discount_type = formValue.discount_type || 'percentage';

    if (!discount || discount === 0) return price;

    if (discount_type === 'percentage') {
      return price - (price * discount / 100);
    } else {
      return Math.max(0, price - discount);
    }
  }

  protected getFormDiscountAmount(): number {
    const formValue = this.subscriptionForm.value;
    const price = formValue.price || 0;
    const discount = formValue.discount || 0;
    const discount_type = formValue.discount_type || 'percentage';

    if (!discount || discount === 0) return 0;

    if (discount_type === 'percentage') {
      return price * discount / 100;
    } else {
      return discount;
    }
  }
}