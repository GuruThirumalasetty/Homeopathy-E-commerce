export interface Address {
  id: string;
  user_id: string;
  address: string; // e.g., Home, Office
  phone_number: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  set_as_default?: number;
  status: number;
  created_on?: string;
  created_by?: number;
  updated_on?: string;
  updated_by?: number;
}