export type ProductType = 'book' | 'video';

export interface Product {
  id: number;
  name: string;
  code?: string;
  contributor_name?: string;
  instructor?: string;
  price: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
  shipping_charges ?: number;
  tax ?: number;
  image: string;
  images?: any;
  rating: number;
  type: ProductType;
  // category: string; // deprecated, use categoryId and categoryName
  category_id?: number;
  category_name?: string;
  description: string;
  quantity ?: any;
  stock_quantity ?: any;
  status?: number;
  previewPages?: string[];
  files_list ?: any;
  videoUrl?: string;
}

export interface CartItem {
  // Common fields
  quantity: number;
  serverId?: string;
  itemPrice?: number; // original price
  discountAmount?: number;
  purchasePrice?: number; // final price after discount
  shipping_charges?: number;
  tax?: number;
  taxAmount?: number;
  finalPrice?: number; // final price including shipping and tax
  type: 'book' | 'video' | 'subscription'; // distinguish between product and subscription

  // Product fields (when type !== 'subscription')
  id?: number;
  name?: string;
  code?: string;
  contributor_name?: string;
  instructor?: string;
  price?: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
  image?: string;
  rating?: number;
  productType?: ProductType;
  category?: string;
  description?: string;
  stock_quantity?: number;
  files_list?: any;

  // Subscription fields (when type === 'subscription')
  subscriptionId?: number;
  duration?: 'monthly' | 'yearly';
  benefits?: string[];
  limitations?: string[];
  popular?: boolean;
  planType?: string; // the type of subscription plan (e.g., 'book', 'video')
}

