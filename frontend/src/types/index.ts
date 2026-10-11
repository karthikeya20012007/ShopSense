export type UserRole = 'ADMIN' | 'VENDOR' | 'CUSTOMER';
export type AccountStatus = 'ACTIVE' | 'DISABLED';
export type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
