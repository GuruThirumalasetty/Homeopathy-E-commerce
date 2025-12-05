export type UserRole = 'guest' | 'user' | 'admin';

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
  permission_id: number;
  permission_name: string;
  module: string;
  router_link: string;
  isNavVisible: number;
  permissions: { create: number; view: number; update: number; delete: number; };
  icon: string;
  id: string;
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

