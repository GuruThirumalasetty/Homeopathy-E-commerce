import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Address } from '../../core/models/address';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { common_response } from '../../core/models/common_response';
import { NotificationService } from '../../core/services/notification.service';

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
  private readonly notification = inject(NotificationService);

  addresses = signal<Address[]>([]);
  showForm = signal(false);
  user = signal(this.auth.user());
  editingAddress = signal<Address | null>(null);

  addressForm: FormGroup = this.fb.group({
    address: ['', Validators.required],
    street: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    zip_code: ['', Validators.required],
    country: ['India', Validators.required],
    phone_number: [this.user()!.mobile_number || '', Validators.required],
    set_as_default: [false]
  });

  constructor() {
    this.loadAddresses();
  }

  loadAddresses() {
    const user = this.auth.user();
    if (user) {
      this.api.getAddresses(user.id).subscribe({
        next: (response: common_response) => {
          if(response.status_code == 200){
            const addresses = response.data || [];
            this.addresses.set(addresses);
          }
          else{
            this.notification.notify(response.message);
            this.addresses.set([])
          }
          
        },
        error: () => this.addresses.set([])
      });
    }
  }

  addAddress() {
    this.editingAddress.set(null);
    this.addressForm.reset({ phone: this.user()!.mobile_number ,country: 'India', isDefault: false });
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
        user_id: user.id,
        set_as_default: formValue.set_as_default ? 1 : 0,
        id: this.editingAddress()?.id || this.generateId()
      };

      if (this.editingAddress()) {
        this.api.updateAddress(addressData).subscribe({
          next: (response: common_response) => {
            if(response.status_code == 200){
              this.loadAddresses();
              this.cancelEdit();
              this.notification.notify('Address updated succesfully.','success');
            }
            else{
              this.notification.notify(response.message);
            }
          }
        });
      } else {
        this.api.createAddress(addressData).subscribe({
          next: (response: common_response) => {
            if(response.status_code == 200){
              this.loadAddresses();
              this.cancelEdit();
              this.notification.notify('Address updated succesfully.','success');
            }
            else{
              this.notification.notify(response.message);
            }
          }
        });
      }
    }
  }

  deleteAddress(address: Address) {
    if (confirm('Are you sure you want to delete this address?')) {
      this.api.deleteAddress({ ...address, status: 0 }).subscribe({
        next: () => {
          this.notification.notify('Address deleted succesfully.','success');
          this.loadAddresses();
        }
      });
    }
  }

  setDefault(address: Address) {
    // First, unset all defaults
    // Set this as default
    this.api.updateAddress({ ...address, set_as_default: 1 }).subscribe({
      next: (response: common_response) => {
        if(response.status_code == 200){
          this.notification.notify('Address set as default successfully.', 'success');
          this.loadAddresses()
        }
        else{
          this.notification.notify('Failed to set address as default. Please try again.')
        }
      },
      error:(error)=>{
        console.log(error);
        this.notification.notify(error.message || 'Unable to update address. Please check your connection and try again.', 'error');
      }
    });
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}