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
  cost_price?: string | number | null;
  reorder_level?: number | null;
  safety_stock?: number | null;
  lead_time_days?: number | null;
  category_id?: string | null;
  image_url?: string | null;
  rating?: number | null;
  review_count?: number | null;
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

// ============================================================================
// Milestone 2 — Inventory Intelligence Types
// ============================================================================

export type StockMovementType =
  | 'CHECKOUT_DECREMENT'
  | 'CANCELLATION_RESTOCK'
  | 'PURCHASE_RESTOCK'
  | 'MANUAL_ADJUSTMENT'
  | 'WAREHOUSE_TRANSFER';

export interface InventorySummary {
  total_products: number;
  total_units_in_stock: number;
  total_inventory_cost_value?: string | number | null;
  cost_coverage_percentage: number;
  low_stock_products_count: number;
  out_of_stock_products_count: number;
  valuation_status: 'COMPLETE' | 'PARTIAL' | 'ZERO_VALUATION' | 'UNAVAILABLE';
}

export interface LowStockAlertItem {
  product_id: string;
  title: string;
  sku: string;
  category?: string | null;
  current_stock: number;
  reorder_level: number;
  safety_stock: number;
  lead_time_days: number;
  vendor_id: string;
  store_name?: string | null;
  is_out_of_stock: boolean;
}

export interface LowStockAlertsResponse {
  items: LowStockAlertItem[];
  total_alerts: number;
  out_of_stock_count: number;
}

export interface ReplenishmentItem {
  product_id: string;
  title: string;
  sku: string;
  vendor_id: string;
  current_stock: number;
  reorder_level: number;
  safety_stock: number;
  lead_time_days: number;
  estimated_daily_demand: number;
  suggested_replenishment_qty: number;
  demand_window_days: number;
  sales_history_days: number;
  total_units_sold_in_window: number;
  status: 'REPLENISHMENT_RECOMMENDED' | 'SUFFICIENT_STOCK' | 'INSUFFICIENT_DATA' | 'OUT_OF_STOCK';
  recommendation_notes: string;
}

export interface ReplenishmentResponse {
  items: ReplenishmentItem[];
  total_items: number;
  demand_window_days: number;
}

export interface InventoryTurnover {
  period_days: number;
  cost_of_goods_sold?: string | number | null;
  average_inventory_units?: string | number | null;
  average_inventory_value?: string | number | null;
  turnover_ratio?: string | number | null;
  turnover_period_days?: number | null;
  status: 'CALCULATED' | 'INSUFFICIENT_COST_DATA' | 'ZERO_AVERAGE_INVENTORY' | 'NO_SALES';
  notes: string;
}

export interface StockMovementItem {
  id: string;
  product_id: string;
  product_title?: string | null;
  warehouse_id?: string | null;
  warehouse_name?: string | null;
  change_quantity: number;
  previous_stock: number;
  new_stock: number;
  movement_type: StockMovementType;
  reference_order_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface StockMovementHistoryResponse {
  items: StockMovementItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ForecastDataPoint {
  date: string;
  predicted_demand: number;
}

export interface ProductDemandForecast {
  product_id: string;
  product_title: string;
  forecast_horizon_days: number;
  historical_window_days: number;
  daily_forecasts: ForecastDataPoint[];
  total_predicted_demand: number;
  average_daily_demand: number;
  historical_daily_avg: number;
  methodology: string;
  evaluation_wmape?: number | null;
  evaluation_accuracy?: number | null;
  status: string;
  notes: string;
}

// ============================================================================
// Milestone 2 — Customer Analytics & K-Means Types
// ============================================================================

export interface CustomerAnalyticsSummary {
  total_customers: number;
  active_purchasing_customers: number;
  inactive_customers: number;
  total_recognized_spend: string | number;
  overall_average_order_value: string | number;
  average_orders_per_active_customer: number;
  observation_window_days: number;
  reference_date: string;
}

export interface CustomerRFMItem {
  customer_id: string;
  recency_days?: number | null;
  frequency: number;
  monetary_spend: string | number;
  average_order_value: string | number;
  first_order_date?: string | null;
  last_order_date?: string | null;
  segment_label?: string | null;
}

export interface CustomerRFMListResponse {
  items: CustomerRFMItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  observation_window_days: number;
}

export interface ClusterProfileItem {
  cluster_id: number;
  segment_label: string;
  description: string;
  customer_count: number;
  percentage_of_total: number;
  centroid_recency_days: number;
  centroid_frequency: number;
  centroid_monetary: number;
  centroid_average_order_value: number;
  recommended_action: string;
}

export interface CandidateKScore {
  k: number;
  inertia: number;
  silhouette_score?: number | null;
  davies_bouldin_index?: number | null;
}

export interface CustomerSegmentationResponse {
  status: string;
  observation_window_days: number;
  reference_date: string;
  total_customers_analyzed: number;
  eligible_purchasers_count: number;
  selected_k: number;
  selection_rationale: string;
  silhouette_score?: number | null;
  davies_bouldin_index?: number | null;
  calinski_harabasz_score?: number | null;
  stability_score?: number | null;
  target_accuracy_evaluation: string;
  feature_set: string[];
  segments: ClusterProfileItem[];
  diagnostics?: CandidateKScore[] | null;
}

export interface CustomerMySegment {
  customer_id: string;
  recency_days?: number | null;
  frequency: number;
  monetary_spend: string | number;
  average_order_value: string | number;
  segment_label: string;
  segment_description: string;
  recommended_action: string;
}

// ============================================================================
// Milestone 2 — Recommendations Types
// ============================================================================

export interface RecommendedProductItem {
  product_id: string;
  title: string;
  sku: string;
  price: string | number;
  category: string;
  vendor_id: string;
  score: number;
  recommendation_reason: string;
  stock_quantity: number;
}

export interface ProductRecommendationsResponse {
  scenario: 'PERSONALIZED' | 'SIMILAR_PRODUCTS' | 'POPULAR_BESTSELLERS' | 'COLD_START_FALLBACK';
  total_returned: number;
  items: RecommendedProductItem[];
  reference_product_id?: string | null;
  notes: string;
}

export interface RecommendationEvaluation {
  k: number;
  train_orders_count: number;
  test_orders_count: number;
  evaluated_customers_count: number;
  hybrid_exact_hit_rate: number;
  hybrid_exact_precision: number;
  hybrid_category_hit_rate: number;
  popularity_exact_hit_rate: number;
  popularity_category_hit_rate: number;
  lift_over_popularity: number;
  methodology: string;
  target_relevance_analysis: string;
}

