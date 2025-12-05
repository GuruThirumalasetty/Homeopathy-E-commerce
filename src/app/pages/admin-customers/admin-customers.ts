import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { User } from '../../core/models/user';

interface SimpleCustomer extends User {
  registrationDate?: string;
}

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-customers.html',
  styleUrl: './admin-customers.scss'
})
export class AdminCustomersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Core data signals
  protected readonly allCustomers = signal<SimpleCustomer[]>([]);
  protected readonly filteredCustomers = signal<SimpleCustomer[]>([]);
  protected readonly isLoading = signal(true);

  // Search form
  protected readonly searchForm: FormGroup;

  constructor() {
    this.searchForm = this.fb.group({
      search: ['']
    });

    // Listen for search form changes
    this.searchForm.valueChanges.subscribe(() => {
      this.applySearchFilter();
    });
  }

  ngOnInit(): void {
    this.checkAdminAccess();
    this.loadCustomers();
  }

  private checkAdminAccess(): void {
    const user = this.authService.user();
    if (!user || user.role !== 'admin') {
      this.notifications.notify('Access denied. Admin privileges required.', 'error');
      this.router.navigate(['/dashboard']);
      return;
    }
  }

  private loadCustomers(): void {
    this.isLoading.set(true);
    
    this.api.getUsers().subscribe({
      next: (users) => {
        // Filter only users with 'user' role (customers in this system)
        const customers = (users || []).filter(user => user.role === 'customer');
        
        const simpleCustomers: SimpleCustomer[] = customers.map(user => ({
          ...user,
          registrationDate: user.createdAt
        }));

        this.allCustomers.set(simpleCustomers);
        this.filteredCustomers.set(simpleCustomers);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.notifications.notify('Failed to load customer data', 'error');
      }
    });
  }

  private applySearchFilter(): void {
    const searchTerm = this.searchForm.value.search?.toLowerCase() || '';
    
    if (!searchTerm) {
      this.filteredCustomers.set(this.allCustomers());
      return;
    }

    const filtered = this.allCustomers().filter(customer => 
      customer.name.toLowerCase().includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm) ||
      customer.id.toLowerCase().includes(searchTerm)
    );

    this.filteredCustomers.set(filtered);
  }

  protected formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}