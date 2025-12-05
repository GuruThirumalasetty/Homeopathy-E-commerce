export type ProductType = 'book' | 'video';

export interface Product {
  id: number;
  title: string;
  author?: string;
  instructor?: string;
  price: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  shipping_charges ?: number;
  tax ?: number;
  image: string;
  rating: number;
  type: ProductType;
  category: string; // deprecated, use categoryId and categoryName
  categoryId?: string;
  categoryName?: string;
  description: string;
  quantity ?: any;
  stock_quantity ?: any;
  previewPages?: string[];
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
  title?: string;
  author?: string;
  instructor?: string;
  price?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  image?: string;
  rating?: number;
  productType?: ProductType;
  category?: string;
  description?: string;
  stock_quantity?: number;

  // Subscription fields (when type === 'subscription')
  subscriptionId?: number;
  name?: string;
  duration?: 'monthly' | 'yearly';
  benefits?: string[];
  limitations?: string[];
  popular?: boolean;
  planType?: string; // the type of subscription plan (e.g., 'book', 'video')
}

