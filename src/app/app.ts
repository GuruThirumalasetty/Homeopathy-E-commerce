import { Component, inject } from '@angular/core';
import { NgFor, SlicePipe, UpperCasePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { navLinks } from './app.routes';
import { NotificationCenterComponent } from './shared/components/notification-center/notification-center';
import { LoadingSpinnerComponent } from './shared/components/loading-spinner/loading-spinner';
import { AppStateService } from './core/services/app-state.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgFor, NotificationCenterComponent, LoadingSpinnerComponent, SlicePipe, UpperCasePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly links = navLinks;
  private readonly appState = inject(AppStateService);
  private readonly authService = inject(AuthService);
  protected readonly cartCount = this.appState.cartCount;
  protected readonly user = this.authService.user;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  isSideNavExpanded = false;
  expandedByButton = false;

toggleSidebar() {
  this.isSideNavExpanded = !this.isSideNavExpanded;
  this.expandedByButton = this.isSideNavExpanded;
}

hoverEnter() {
  if (!this.expandedByButton) {
    this.isSideNavExpanded = true;
  }
}

hoverLeave() {
  if (!this.expandedByButton) {
    this.isSideNavExpanded = false;
  }
}

get navigationData() {
  const user = this.user();
  if (user?.role === 'admin') {
    return this.adminNavigationData;
  }
  return this.userNavigationData;
}

protected readonly adminNavigationData = [
  {
    module: 'Admin',
    page: 'Home',
    router_link: '/home',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    module: 'Admin',
    page: 'Admin Access',
    router_link: '/admin',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    module: 'Admin',
    page: 'Products',
    router_link: '/products',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    module: 'Admin',
    page: 'Dashboard',
    router_link: '/dashboard',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    module: 'Admin',
    page: 'Orders',
    router_link: '/admin/orders',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    module: 'Admin',
    page: 'Events',
    router_link: '/admin/events',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    module: 'Admin',
    page: 'Transactions',
    router_link: '/transactions',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  }
];

protected readonly userNavigationData = [
  {
    module: 'User',
    page: 'Home',
    router_link: '/home',
    isNavVisible: 1,
    permissions: { create: 0, view: 1, edit: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  },
  {
    module: 'User',
    page: 'Products',
    router_link: '/products',
    isNavVisible: 1,
    permissions: { create: 0, view: 1, edit: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  },
  {
    module: 'User',
    page: 'Dashboard',
    router_link: '/dashboard',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'user',
    role: 'user'
  },
  {
    module: 'User',
    page: 'My Orders',
    router_link: '/orders',
    isNavVisible: 1,
    permissions: { create: 0, view: 1, edit: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  },
  {
    module: 'User',
    page: 'My Addresses',
    router_link: '/addresses',
    isNavVisible: 1,
    permissions: { create: 1, view: 1, edit: 1, delete: 1 },
    icon: 'user',
    role: 'user'
  },
  {
    module: 'User',
    page: 'My Transactions',
    router_link: '/transactions',
    isNavVisible: 1,
    permissions: { create: 0, view: 1, edit: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  }
];


  logout(): void {
    this.authService.logout();
  }
}
