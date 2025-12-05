export interface Address {
  id: string;
  userId: string;
  name: string; // e.g., Home, Office
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}