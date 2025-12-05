import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Address } from '../../core/models/address';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-addresses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './addresses.html',
  styleUrl: './addresses.scss'
})
export class AddressesComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  addresses = signal<Address[]>([]);
  showForm = signal(false);
  editingAddress = signal<Address | null>(null);

  addressForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    street: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    zipCode: ['', Validators.required],
    country: ['India', Validators.required],
    phone: [''],
    isDefault: [false]
  });

  constructor() {
    this.loadAddresses();
  }

  loadAddresses() {
    const user = this.auth.user();
    if (user) {
      this.api.getAddresses(user.id).subscribe({
        next: (addresses) => this.addresses.set(addresses),
        error: () => this.addresses.set([])
      });
    }
  }

  addAddress() {
    this.editingAddress.set(null);
    this.addressForm.reset({ country: 'India', isDefault: false });
    this.showForm.set(true);
  }

  editAddress(address: Address) {
    this.editingAddress.set(address);
    this.addressForm.patchValue(address);
    this.showForm.set(true);
  }

  cancelEdit() {
    this.showForm.set(false);
    this.editingAddress.set(null);
  }

  submit() {
    if (this.addressForm.valid) {
      const user = this.auth.user();
      if (!user) return;

      const formValue = this.addressForm.value;
      const addressData: Address = {
        ...formValue,
        userId: user.id,
        id: this.editingAddress()?.id || this.generateId()
      };

      if (this.editingAddress()) {
        this.api.updateAddress(addressData.id, addressData).subscribe({
          next: () => {
            this.loadAddresses();
            this.cancelEdit();
          }
        });
      } else {
        this.api.createAddress(addressData).subscribe({
          next: () => {
            this.loadAddresses();
            this.cancelEdit();
          }
        });
      }
    }
  }

  deleteAddress(address: Address) {
    if (confirm('Are you sure you want to delete this address?')) {
      this.api.deleteAddress(address.id).subscribe({
        next: () => this.loadAddresses()
      });
    }
  }

  setDefault(address: Address) {
    // First, unset all defaults
    this.addresses().forEach(addr => {
      if (addr.id !== address.id && addr.isDefault) {
        this.api.updateAddress(addr.id, { isDefault: false }).subscribe();
      }
    });
    // Set this as default
    this.api.updateAddress(address.id, { isDefault: true }).subscribe({
      next: () => this.loadAddresses()
    });
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}