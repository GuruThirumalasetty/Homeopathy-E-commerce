import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const navLinks = [
  { path: 'home', label: 'Home' },
  { path: 'products', label: 'Products' },
  { path: 'about', label: 'About' },
  { path: 'contact', label: 'Contact' },
  { path: 'dashboard', label: 'Dashboard' },
  { path: 'admin', label: 'Admin' }
];

export const routes: Routes = [
   {
     path: '',
     title: 'Homeopathy | Natural Healing',
     canActivate: [loginGuard],
    //  loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent)
     loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent)
   },
   {
     path: 'login',
     title: 'Homeopathy | Login',
     canActivate: [loginGuard],
     loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
   },
   {
     path: 'signup',
     title: 'Homeopathy | Sign Up',
     canActivate: [loginGuard],
     loadComponent: () => import('./pages/signup/signup').then(m => m.SignupComponent)
   },
   {
     path: 'home',
     title: 'Homeopathy | Home',
     canActivate: [authGuard],
     loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent)
   },
  {
    path: 'products',
    title: 'Homeopathy | Products',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/products/products').then(m => m.ProductsComponent)
  },
  {
    path: 'about',
    title: 'Homeopathy | About',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'contact',
    title: 'Homeopathy | Contact',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent)
  },
  {
    path: 'product/:id',
    title: 'Homeopathy | Product Detail',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/product-detail/product-detail').then(m => m.ProductDetailComponent)
  },
  {
    path: 'cart',
    title: 'Homeopathy | Cart',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cart/cart').then(m => m.CartComponent)
  },
  {
    path: 'checkout',
    title: 'Homeopathy | Checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/checkout/checkout').then(m => m.CheckoutComponent)
  },
  {
    path: 'orders',
    title: 'Homeopathy | Orders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/orders').then(m => m.OrdersComponent)
  },
  {
    path: 'order/:id',
    title: 'Homeopathy | Order Details',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/order-detail/order-detail').then(m => m.OrderDetailComponent)
  },
  {
    path: 'order-tracking',
    title: 'Homeopathy | Order Tracking',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/order-tracking/order-tracking').then(m => m.OrderTrackingComponent)
  },
  {
    path: 'payment',
    title: 'Homeopathy | Payment',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/payment/payment').then(m => m.PaymentComponent)
  },
  {
    path: 'success',
    title: 'Homeopathy | Success',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/success/success').then(m => m.SuccessComponent)
  },
  {
    path: 'failure',
    title: 'Homeopathy | Failure',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/failure/failure').then(m => m.FailureComponent)
  },
  {
    path: 'dashboard',
    title: 'Homeopathy | Dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent)
  },
  {
    path: 'admin',
    title: 'Homeopathy | Admin',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent)
  },
  {
    path: 'admin/orders',
    title: 'Homeopathy | Admin Orders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/admin-orders/admin-orders').then(m => m.AdminOrdersComponent)
  },
  {
    path: 'admin/products',
    title: 'Homeopathy | Admin Products',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin-products/admin-products').then(m => m.AdminProductsComponent)
  },
  {
    path: 'admin/users',
    title: 'Homeopathy | Admin Users',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/admin-users/admin-users').then(m => m.AdminUsersComponent)
  },
  {
    path: 'admin/categories',
    title: 'Homeopathy | Admin Categories',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/admin-categories/admin-categories').then(m => m.AdminCategoriesComponent)
  },
  {
    path: 'admin/user/:id',
    title: 'Homeopathy | Admin User Info',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/admin-user-info/admin-user-info.component').then(m => m.AdminUserInfoComponent)
  },
  {
    path: 'admin/subscriptions',
    title: 'Homeopathy | Subscription Management',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/subscription-master/subscription-master').then(m => m.SubscriptionMasterComponent)
  },
  {
    path: 'admin/roles',
    title: 'Homeopathy | Roles Management',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/admin-roles/admin-roles').then(m => m.AdminRolesComponent)
  },
  {
    path: 'admin/roles/create',
    title: 'Homeopathy | Create Role',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/role-create/role-create').then(m => m.RoleCreateComponent)
  },
  {
    path: 'admin/roles/:id/edit',
    title: 'Homeopathy | Edit Role',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/role-create/role-create').then(m => m.RoleCreateComponent)
  },
  {
    path: 'admin/role-mapping',
    title: 'Homeopathy | Create User with Role Mapping',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/role-mapping/role-mapping.component').then(m => m.RoleMappingComponent)
  },
  {
    path: 'admin/role-mapping/:id',
    title: 'Homeopathy | Edit User Role Mapping',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/role-mapping/role-mapping.component').then(m => m.RoleMappingComponent)
  },
  {
    path: 'profile',
    title: 'Homeopathy | Profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile').then(m => m.ProfileComponent)
  },
  {
    path: 'transactions',
    title: 'Homeopathy | Transactions',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/transactions/transactions').then(m => m.TransactionsComponent)
  },
  {
    path: 'addresses',
    title: 'Homeopathy | Addresses',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/addresses/addresses').then(m => m.AddressesComponent)
  },
  {
    path: 'admin/events',
    title: 'Homeopathy | Events',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/event-admin-dashboard/event-admin-dashboard').then(m => m.EventAdminDashboardComponent)
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full'
  }
];
