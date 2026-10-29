export type UserRole = 'ADMIN' | 'VENDOR' | 'CUSTOMER';
export type AccountStatus = 'ACTIVE' | 'DISABLED';
export type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export interface CustomerProfile {
  id: string;
  user_id: string;
  phone_number?: string | null;
  shipping_address?: string | null;
  created_at: string;
}

export interface VendorProfile {
  id: string;
  user_id: string;
  store_name: string;
  business_email?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
  business_description?: string | null;
  status: VendorStatus;
  created_at: string;
  updated_at: string;
  applicant_email?: string | null;
  applicant_name?: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string;
  vendor_profile?: VendorProfile | null;
  customer_profile?: CustomerProfile | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  id: string;
  vendor_id: string;
  title: string;
  description?: string | null;
  price: string | number;
  category: string;
  sku?: string | null;
  stock_quantity: number;
  is_published: boolean;
  created_at: string;
  store_name?: string | null;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface VendorOnboardingStatusResponse {
  vendor_id: string;
  store_name: string;
  status: VendorStatus;
  message: string;
  created_at: string;
}

// Shopping Cart
export interface CartItem {
  product: Product;
  quantity: number;
}

// Orders
export interface OrderItem {
  id: string;
  product_id: string;
  product_title?: string | null;
  vendor_id: string;
  store_name?: string | null;
  quantity: number;
  unit_price: string | number;
  subtotal: string | number;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: string | number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface VendorOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title?: string | null;
  quantity: number;
  unit_price: string | number;
  subtotal: string | number;
  created_at: string;
}

export interface VendorOrder {
  order_id: string;
  customer_id: string;
  status: OrderStatus;
  created_at: string;
  vendor_items_total: string | number;
  items: VendorOrderItem[];
}

export interface CheckoutItemRequest {
  product_id: string;
  quantity: number;
}

export interface CheckoutRequest {
  items: CheckoutItemRequest[];
}

// Analytics
export interface AdminOverviewMetrics {
  total_revenue: string | number;
  completed_orders_count: number;
  total_orders_count: number;
  total_vendors_count: number;
  approved_vendors_count: number;
  pending_vendors_count: number;
  rejected_vendors_count: number;
  total_products_count: number;
  published_products_count: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: string | number;
  order_count: number;
}

export interface VendorPerformanceItem {
  vendor_id: string;
  store_name: string;
  revenue: string | number;
  items_sold: number;
  order_count: number;
}

export interface ProductPerformanceItem {
  product_id: string;
  title: string;
  category: string;
  units_sold: number;
  revenue: string | number;
  current_stock?: number | null;
  price?: string | number | null;
  is_published?: boolean | null;
  is_low_stock?: boolean | null;
}

export interface CategoryPerformanceItem {
  category: string;
  units_sold: number;
  revenue: string | number;
}

export interface AdminProductsAnalyticsResponse {
  top_products: ProductPerformanceItem[];
  category_breakdown: CategoryPerformanceItem[];
}

export interface VendorOverviewMetrics {
  vendor_id: string;
  store_name: string;
  recognized_revenue: string | number;
  completed_order_count: number;
  total_order_count: number;
  total_products: number;
  low_stock_count: number;
  total_units_sold: number;
}

export interface VendorRevenueTrendPoint {
  date: string;
  revenue: string | number;
  units_sold: number;
}
