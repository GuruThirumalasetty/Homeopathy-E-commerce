export type UserRole = 'guest' | 'user' | 'admin' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile_number?: string;
  role: UserRole;
  status?: 'active' | 'inactive';
  referralCode?: string;
  createdAt?: string;
  createdBy?: string | string;
  updatedAt?: string;
  updatedBy?: string | string;
  roles?: string[];
  username?: string;
  password?: string;
  created_by?: string;
  created_on?: string;
  updated_by?: string;
  updated_on?: string;
}

export interface Permission {
  id: number;
  name: string;
  module: string;
  link: string;
  is_nav_visible: number;
  permissions: { create: number; view: number; update: number; delete: number; };
  icon: string;
  role?: string;
}

export interface PermissionEntity {
  id?: number;
  name: string;
  description: string;
  link: string;
  is_nav_visible: number;
  status: number;
  icon: string;
  created_on?: string;
  created_by?: number;
  updated_on?: string;
  updated_by?: number;
}

export interface RolePermission {
  permission_id: number;
  create: boolean;
  view: boolean;
  update: boolean;
  delete: boolean;
}

export interface Role {
  id: any;
  name: string;
  description: string;
  permissions: RolePermission[];
  fullPermissions?: Permission[]; // populated when fetched with permissions
}

