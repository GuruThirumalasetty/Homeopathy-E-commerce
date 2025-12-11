import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';

interface Customer {
  id: string;
  name: string;
  email: string;
  mobile_number?: string;
  registrationDate: string;
  created_on: string;
  last_login?: string;
  status: 'active' | 'inactive' | 'suspended';
  totalOrders: number;
  totalSpent: number;
  role: string;
  createdAt: string;
  updatedAt: string;
  isEmailVerified: boolean;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
  orders?: any[];
}

interface CustomerProfile {
  id: string;
  personalInfo: {
    name: string;
    email: string;
    mobile_number?: string;
    status: string;
    registrationDate: string;
    lastLogin?: string;
    emailVerified: boolean;
  };
  address: {
    city?: string;
    state?: string;
    country?: string;
    fullAddress?: string;
  };
  statistics: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate?: string;
    registrationAge: string;
  };
  recentOrders: Array<{
    id: string;
    date: string;
    amount: number;
    status: string;
    items: number;
  }>;
  auditLog: Array<{
    timestamp: string;
    action: string;
    details: string;
    performedBy: string;
  }>;
}

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-customers.html',
  styleUrls: ['./admin-customers.scss']
})
export class AdminCustomersComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly authService = inject(AuthService);
  private readonly apiService = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  // Form controls
  searchForm: FormGroup;

  // Signals for state management
  private readonly customersSubject = signal<Customer[]>([]);
  private readonly isLoadingSubject = signal<boolean>(false);
  private readonly selectedCustomerSubject = signal<Customer | null>(null);
  private readonly showProfileModalSubject = signal<boolean>(false);

  // Computed values
  readonly allCustomers = computed(() => this.customersSubject());
  
  readonly filteredCustomers = computed(() => {
    let customers = this.allCustomers();
    
    // Apply search filter
    const searchTerm = this.searchForm.get('search')?.value?.toLowerCase()?.trim();
    if (searchTerm) {
      customers = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.email.toLowerCase().includes(searchTerm) ||
        customer.id.toLowerCase().includes(searchTerm) ||
        (customer.mobile_number && customer.mobile_number.includes(searchTerm))
      );
    }

    return customers;
  });

  readonly isLoading = this.isLoadingSubject.asReadonly();
  readonly selectedCustomer = this.selectedCustomerSubject.asReadonly();
  readonly showProfileModal = this.showProfileModalSubject.asReadonly();

  // Accessibility and internationalization
  readonly locale = 'en-US';
  readonly currency = 'INR';

  constructor() {
    this.searchForm = this.fb.group({
      search: ['']
    });
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Main data loading
  private loadCustomers(): void {
    this.isLoadingSubject.set(true);

    this.apiService.getUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (users) => {
        const customers = this.transformUsersToCustomers(users);
        this.customersSubject.set(customers);
        this.isLoadingSubject.set(false);
      },
      error: (error) => {
        console.error('Error loading customers:', error);
        this.isLoadingSubject.set(false);
      }
    });
  }

  // Data transformation
  private transformUsersToCustomers(users: any[]): Customer[] {
    return users
      .filter(user => user.role === 'customer' || !user.role || user.role === 'user')
      .map(user => ({
        id: user.id?.toString() || '',
        name: user.name || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
        email: user.email || '',
        mobile_number: user.mobile_number || user.phone || '',
        registrationDate: user.registrationDate || user.created_on || user.createdAt || new Date().toISOString(),
        created_on: user.created_on || user.createdAt || new Date().toISOString(),
        last_login: user.last_login || user.lastLogin,
        status: this.mapUserStatus(user.status) as 'active' | 'inactive' | 'suspended',
        totalOrders: this.calculateTotalOrders(user),
        totalSpent: this.calculateTotalSpent(user),
        role: user.role || 'customer',
        createdAt: user.createdAt || user.created_on || new Date().toISOString(),
        updatedAt: user.updatedAt || new Date().toISOString(),
        isEmailVerified: user.isEmailVerified || user.emailVerified || false,
        address: {
          city: user.address?.city || user.city,
          state: user.address?.state || user.state,
          country: user.address?.country || user.country
        },
        orders: user.orders || []
      }));
  }

  private mapUserStatus(userStatus: any): string {
    if (!userStatus) return 'active';
    const status = userStatus.toLowerCase();
    if (['active', 'verified', 'confirmed'].includes(status)) return 'active';
    if (['inactive', 'pending'].includes(status)) return 'inactive';
    if (['suspended', 'blocked', 'disabled'].includes(status)) return 'suspended';
    return 'active';
  }

  private calculateTotalOrders(user: any): number {
    if (user.orders && Array.isArray(user.orders)) {
      return user.orders.length;
    }
    if (user.totalOrders !== undefined) {
      return user.totalOrders;
    }
    return 0;
  }

  private calculateTotalSpent(user: any): number {
    if (user.orders && Array.isArray(user.orders)) {
      return user.orders.reduce((total: number, order: any) => {
        return total + (order.total || order.amount || 0);
      }, 0);
    }
    if (user.totalSpent !== undefined) {
      return user.totalSpent;
    }
    return 0;
  }

  // Profile modal
  onCustomerClick(customer: Customer): void {
    this.selectedCustomerSubject.set(customer);
    this.showProfileModalSubject.set(true);
  }

  closeProfileModal(): void {
    this.showProfileModalSubject.set(false);
    this.selectedCustomerSubject.set(null);
  }

  // Utility methods
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString(this.locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString(this.locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  }

  formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency: this.currency
      }).format(amount);
    } catch {
      return `₹${amount.toFixed(2)}`;
    }
  }

  formatAge(registrationDate: string): string {
    try {
      const now = new Date();
      const regDate = new Date(registrationDate);
      const diffTime = Math.abs(now.getTime() - regDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 30) {
        return `${diffDays} days`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''}`;
      }
    } catch {
      return 'N/A';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
      case 'verified':
      case 'confirmed':
        return 'status-badge status-active';
      case 'inactive':
      case 'pending':
        return 'status-badge status-inactive';
      case 'suspended':
      case 'blocked':
      case 'disabled':
        return 'status-badge status-suspended';
      default:
        return 'status-badge';
    }
  }

  getCustomerProfile(customer: Customer): CustomerProfile {
    return {
      id: customer.id,
      personalInfo: {
        name: customer.name,
        email: customer.email,
        mobile_number: customer.mobile_number,
        status: customer.status,
        registrationDate: customer.registrationDate,
        lastLogin: customer.last_login,
        emailVerified: customer.isEmailVerified
      },
      address: {
        city: customer.address?.city,
        state: customer.address?.state,
        country: customer.address?.country
      },
      statistics: {
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        averageOrderValue: customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0,
        lastOrderDate: this.getLastOrderDate(customer),
        registrationAge: this.formatAge(customer.registrationDate)
      },
      recentOrders: this.getRecentOrders(customer),
      auditLog: this.getCustomerAuditLog(customer)
    };
  }

  private getLastOrderDate(customer: Customer): string | undefined {
    if (customer.orders && customer.orders.length > 0) {
      const lastOrder = customer.orders
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      return lastOrder.createdAt;
    }
    return undefined;
  }

  private getRecentOrders(customer: Customer): Array<{id: string; date: string; amount: number; status: string; items: number}> {
    if (!customer.orders || customer.orders.length === 0) {
      return [];
    }
    
    return customer.orders
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((order: any) => ({
        id: order.id,
        date: order.createdAt,
        amount: order.total || order.amount || 0,
        status: order.status || 'unknown',
        items: order.items?.length || 0
      }));
  }

  private getCustomerAuditLog(customer: Customer): Array<{timestamp: string; action: string; details: string; performedBy: string}> {
    // In a real implementation, fetch from audit service
    return [
      {
        timestamp: customer.registrationDate,
        action: 'customer_registered',
        details: 'Customer account created',
        performedBy: 'System'
      }
    ];
  }

  // Performance optimization
  trackByCustomerId(index: number, customer: Customer): string {
    return customer.id;
  }
}