import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class AdminComponent {
  protected readonly modules = [
    { title: 'Orders', description: 'Manage customer orders', link: '/admin/orders' },
    { title: 'Products', description: 'Add or edit catalog items', link: '/admin/products' },
    { title: 'Categories', description: 'Manage product categories', link: '/admin/categories' },
    { title: 'Subscriptions', description: 'Manage subscription plans', link: '/admin/subscriptions' },
    { title: 'Roles', description: 'Manage user roles and permissions', link: '/admin/roles' },
    { title: 'Users', description: "View Manus' users", link: '/admin/users' },
    { title: 'Registred Users', description: 'View registered users', link: '/admin/customers' },
    { title: 'Transactions', description: 'Monitor all payments', link: '/transactions' }
  ];
}
