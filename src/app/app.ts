import { Component, inject, OnInit, signal } from '@angular/core';
import { NgFor, SlicePipe, UpperCasePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { navLinks } from './app.routes';
import { NotificationCenterComponent } from './shared/components/notification-center/notification-center';
import { LoadingSpinnerComponent } from './shared/components/loading-spinner/loading-spinner';
import { AppStateService } from './core/services/app-state.service';
import { AuthService } from './core/services/auth.service';
import { ApiService } from './core/services/api.service';
import { common_response } from './core/models/common_response';
import { NotificationService } from './core/services/notification.service';
import { Permission } from './core/models/user';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgFor, NotificationCenterComponent, LoadingSpinnerComponent, SlicePipe, UpperCasePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly links = navLinks;
  private readonly app_state = inject(AppStateService);
  private readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notification = inject(NotificationService);
  protected readonly cartCount = this.app_state.cartCount;
  protected readonly user = this.authService.user;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  isSideNavExpanded = false;
  expandedByButton = false;

  protected navigation_data = signal<Permission[]>([]);

  ngOnInit(): void {
    this.get_admin_permissions();
  }
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

get_admin_permissions(){
  this.api.getPermissions().subscribe({
    next: (response: common_response)=>{
      if(response.status_code == 200){
        this.navigation_data.set(response.data || []);
      }
      else{
        this.notification.notify(response.message);
        this.navigation_data.set([]);
      }
    }
  })
}

protected readonly adminNavigationData: Permission[] = [
  {
    id: 1,
    module: 'Admin',
    name: 'Home',
    link: '/home',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    id: 1,
    module: 'Admin',
    name: 'Admin Access',
    link: '/admin',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    id: 1,
    module: 'Admin',
    name: 'Products',
    link: '/products',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    id: 1,
    module: 'Admin',
    name: 'Dashboard',
    link: '/dashboard',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    id: 1,
    module: 'Admin',
    name: 'Orders',
    link: '/admin/orders',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    id: 1,
    module: 'Admin',
    name: 'Events',
    link: '/admin/events',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    id: 1,
    module: 'Admin',
    name: 'Transactions',
    link: '/transactions',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  },
  {
    id: 1,
    module: 'Admin',
    name: 'Subscriptions',
    link: '/admin/subscriptions',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'admin',
    role: 'admin'
  }
];

protected readonly userNavigationData: Permission[] = [
  {
    id: 1,
    module: 'User',
    name: 'Home',
    link: '/home',
    is_nav_visible: 1,
    permissions: { create: 0, view: 1, update: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  },
  {
    id: 2,
    module: 'User',
    name: 'Products',
    link: '/products',
    is_nav_visible: 1,
    permissions: { create: 0, view: 1, update: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  },
  {
    id: 1,
    module: 'User',
    name: 'Dashboard',
    link: '/dashboard',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'user',
    role: 'user'
  },
  {
    id: 1,
    module: 'User',
    name: 'My Orders',
    link: '/orders',
    is_nav_visible: 1,
    permissions: { create: 0, view: 1, update: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  },
  {
    id: 1,
    module: 'User',
    name: 'My Addresses',
    link: '/addresses',
    is_nav_visible: 1,
    permissions: { create: 1, view: 1, update: 1, delete: 1 },
    icon: 'user',
    role: 'user'
  },
  {
    id: 1,
    module: 'User',
    name: 'My Transactions',
    link: '/transactions',
    is_nav_visible: 1,
    permissions: { create: 0, view: 1, update: 0, delete: 0 },
    icon: 'user',
    role: 'user'
  }
];


  logout(): void {
    this.authService.logout();
  }
}
