import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { apiClient } from '../api/client';
import type {
  VendorProfile,
  Product,
  VendorOverviewMetrics,
  VendorRevenueTrendPoint,
  ProductPerformanceItem,
  VendorOrder,
} from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { InventoryDashboardView } from '../components/InventoryDashboardView';
import { ProductImage } from '../components/ProductImage';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

type VendorTab = 'analytics' | 'inventory' | 'products' | 'orders' | 'profile';

export const VendorDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<VendorTab>('analytics');

  // Vendor Profile State
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics State
  const [metrics, setMetrics] = useState<VendorOverviewMetrics | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<VendorRevenueTrendPoint[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceItem[]>([]);
  const [dateRangeDays, setDateRangeDays] = useState<number>(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Add/Edit Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Hardware',
    sku: '',
    stock_quantity: 10,
    is_published: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Orders State
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Store Profile Edit State
  const [profileForm, setProfileForm] = useState({
    store_name: '',
    business_email: '',
    business_phone: '',
    business_address: '',
    business_description: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const loadVendorData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, metricsRes, productsRes] = await Promise.all([
        apiClient.get<VendorProfile>('/vendors/me/profile'),
        apiClient.get<VendorOverviewMetrics>('/analytics/vendor/overview'),
        apiClient.get<Product[]>('/vendors/me/products'),
      ]);

      setProfile(profileRes.data);
      setMetrics(metricsRes.data);
      setProducts(productsRes.data);

      setProfileForm({
        store_name: profileRes.data.store_name || '',
        business_email: profileRes.data.business_email || '',
        business_phone: profileRes.data.business_phone || '',
        business_address: profileRes.data.business_address || '',
        business_description: profileRes.data.business_description || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load vendor dashboard details.');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const endDate = new Date().toISOString().split('T')[0];
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - dateRangeDays);
      const startDate = startDateObj.toISOString().split('T')[0];

      const [trendRes, perfRes] = await Promise.all([
        apiClient.get<VendorRevenueTrendPoint[]>(
          `/analytics/vendor/revenue?start_date=${startDate}&end_date=${endDate}`
        ),
        apiClient.get<ProductPerformanceItem[]>('/analytics/vendor/products'),
      ]);

      setRevenueTrend(trendRes.data);
      setProductPerformance(perfRes.data);
    } catch {
      // Ignore
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadVendorOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await apiClient.get<VendorOrder[]>('/orders/vendor/me');
      setVendorOrders(res.data);
    } catch {
      // Ignore
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadVendorData();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    } else if (activeTab === 'orders') {
      loadVendorOrders();
    }
  }, [activeTab, dateRangeDays]);

  // Product Add / Edit
  const openAddModal = () => {
    setEditingProductId(null);
    setProductForm({
      title: '',
      description: '',
      price: '',
      category: 'Hardware',
      sku: '',
      stock_quantity: 10,
      is_published: true,
    });
    setFormError(null);
    setShowProductModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProductId(p.id);
    setProductForm({
      title: p.title,
      description: p.description || '',
      price: typeof p.price === 'number' ? p.price.toString() : p.price,
      category: p.category,
      sku: p.sku || '',
      stock_quantity: p.stock_quantity,
      is_published: p.is_published,
    });
    setFormError(null);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.title.trim() || !productForm.price) {
      setFormError('Title and Price are required.');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const priceNum = parseFloat(productForm.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setFormError('Price must be greater than zero.');
        return;
      }

      const payload = {
        title: productForm.title.trim(),
        description: productForm.description.trim() || null,
        price: priceNum,
        category: productForm.category.trim(),
        sku: productForm.sku.trim() || null,
        stock_quantity: Math.max(0, parseInt(productForm.stock_quantity.toString()) || 0),
        is_published: productForm.is_published,
      };

      if (editingProductId) {
        await apiClient.patch(`/vendors/me/products/${editingProductId}`, payload);
      } else {
        await apiClient.post('/vendors/me/products', payload);
      }

      setShowProductModal(false);

      // Refresh products and metrics
      const [prodRes, metRes] = await Promise.all([
        apiClient.get<Product[]>('/vendors/me/products'),
        apiClient.get<VendorOverviewMetrics>('/analytics/vendor/overview'),
      ]);
      setProducts(prodRes.data);
      setMetrics(metRes.data);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to save product.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      setDeleteError(null);
      await apiClient.delete(`/vendors/me/products/${productId}`);
      setDeletingProductId(null);

      // Refresh products
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      const metRes = await apiClient.get<VendorOverviewMetrics>('/analytics/vendor/overview');
      setMetrics(metRes.data);
    } catch (err: any) {
      setDeleteError(
        err.response?.data?.detail || 'Failed to delete product. It may be linked to customer orders.'
      );
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      setProfileSuccess(false);

      const res = await apiClient.patch<VendorProfile>('/vendors/me/profile', profileForm);
      setProfile(res.data);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      alert('Failed to update store profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const formatPrice = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-40 rounded-3xl bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Card className="border-rose-200 bg-rose-50/50 p-8 text-center">
          <CardContent className="space-y-4">
            <span className="text-4xl block">⚠️</span>
            <h3 className="text-base font-bold text-slate-900">Vendor Operations Access Error</h3>
            <p className="text-sm text-slate-600">{error || 'Unable to retrieve vendor account data.'}</p>
            <Button variant="primary" onClick={loadVendorData}>
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Vendor Store Header */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🏪</span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{profile.store_name}</h1>
                <StatusBadge status={profile.status} />
              </div>
              <p className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Store ID: <span className="font-mono text-slate-100">{profile.id.slice(0, 8)}...</span>
                </span>
                <span>&bull;</span>
                <span>
                  Email: <span className="text-slate-100">{profile.business_email || 'Not configured'}</span>
                </span>
                {profile.business_phone && (
                  <>
                    <span>&bull;</span>
                    <span>Phone: {profile.business_phone}</span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={openAddModal}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold"
              >
                + Add Product
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 p-3 bg-slate-50 border-t border-slate-200 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>📊</span>
            <span>Sales Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>📦</span>
            <span>Inventory Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>🏷️</span>
            <span>Products ({products.length})</span>
            {metrics && metrics.low_stock_count > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold ml-1">
                {metrics.low_stock_count} Low Stock
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>🧾</span>
            <span>Store Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>⚙️</span>
            <span>Store Profile</span>
          </button>
        </div>
      </Card>

      {deleteError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex justify-between items-center">
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="text-rose-400 hover:text-rose-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: Inventory Intelligence */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && <InventoryDashboardView isAdmin={false} />}

      {/* ========================================================================= */}
      {/* TAB 1: Sales Analytics */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Recognized Revenue
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  ₹{formatPrice(metrics?.recognized_revenue)}
                </div>
                <span className="text-xs text-emerald-600 font-semibold block mt-1 flex items-center gap-1">
                  <span>✓</span> From completed orders
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Units Sold
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {metrics?.total_units_sold ?? 0}
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  Across {metrics?.completed_order_count ?? 0} completed orders
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Store Products
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {metrics?.total_products ?? 0}
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  Active in catalog
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Inventory Alerts
                </span>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold ${
                    (metrics?.low_stock_count ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {metrics?.low_stock_count ?? 0}
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  Items with &le; 5 units in stock
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Trend Area Chart */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Store Revenue Trend</h2>
                  <p className="text-xs text-slate-500">
                    Daily recognized revenue generated by your products in completed orders
                  </p>
                </div>

                <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setDateRangeDays(days)}
                      className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                        dateRangeDays === days
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Last {days}d
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-64 w-full pt-4">
                {analyticsLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : revenueTrend.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                    <span className="text-2xl mb-1">📉</span>
                    <span>No completed sales transactions in this period</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend}>
                      <defs>
                        <linearGradient id="vendorRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(val) => `₹${val}`}
                      />
                      <Tooltip
                        formatter={(value: any) => [`₹${formatPrice(value)}`, 'Revenue']}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          color: '#fff',
                          borderRadius: '0.75rem',
                          border: 'none',
                          fontSize: '0.75rem',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#vendorRevGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Sales Performance Table */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Product Sales Performance
              </h3>
              {productPerformance.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No product sales recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="pb-3 px-3">Product Title</th>
                        <th className="pb-3 px-3">Category</th>
                        <th className="pb-3 px-3">Price</th>
                        <th className="pb-3 px-3">Current Stock</th>
                        <th className="pb-3 px-3">Units Sold</th>
                        <th className="pb-3 px-3 text-right">Recognized Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productPerformance.map((p) => (
                        <tr key={p.product_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-900">{p.title}</td>
                          <td className="py-3 px-3 text-slate-500">{p.category}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">₹{formatPrice(p.price)}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                (p.current_stock ?? 0) <= 5
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {p.current_stock} units
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-semibold">{p.units_sold}</td>
                          <td className="py-3 px-3 font-bold text-emerald-600 text-right">
                            ₹{formatPrice(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Product Management */}
      {/* ========================================================================= */}
      {activeTab === 'products' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Manage Store Products</h2>
                <p className="text-xs text-slate-500">
                  Add, edit, inspect inventory levels, or toggle publication in the public catalog
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  id="vendor-product-search"
                  name="search"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 flex-1 sm:w-56"
                />
                <Button variant="primary" onClick={openAddModal} className="shrink-0 text-xs">
                  + Add Product
                </Button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState
                icon="🏷️"
                title="No products found"
                description="Click the button below to add your first product or adjust search criteria."
                actionLabel="+ Add New Product"
                onAction={openAddModal}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                              <ProductImage product={p} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">{p.title}</span>
                              {p.sku && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  SKU: {p.sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="default" size="sm">
                            {p.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          ₹{formatPrice(p.price)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              p.stock_quantity <= 5
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'text-slate-700 font-medium'
                            }`}
                          >
                            {p.stock_quantity} units
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={p.is_published ? 'success' : 'warning'} size="sm">
                            {p.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => openEditModal(p)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => setDeletingProductId(p.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Store Orders (Vendor-Scoped) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Store Orders</h2>
                <p className="text-xs text-slate-500">
                  Customer transactions containing items sold by your store (isolated to your line items)
                </p>
              </div>
              <Badge variant="default" size="md">
                {vendorOrders.length} Orders
              </Badge>
            </div>

            {ordersLoading ? (
              <div className="min-h-[20vh] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : vendorOrders.length === 0 ? (
              <EmptyState
                icon="🧾"
                title="No customer orders received yet"
                description="Orders containing products sold by your store will appear here automatically upon checkout."
              />
            ) : (
              <div className="space-y-4">
                {vendorOrders.map((vo) => (
                  <div
                    key={vo.order_id}
                    className="border border-slate-200 rounded-xl overflow-hidden text-xs"
                  >
                    <div className="bg-slate-50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200">
                      <div>
                        <span className="font-mono font-bold text-slate-900">
                          Order #{vo.order_id.slice(0, 8)}...
                        </span>
                        <span className="text-slate-400 block text-[11px] mt-0.5">
                          Placed on {new Date(vo.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge status={vo.status} />
                        <span className="font-extrabold text-slate-900 text-sm">
                          ₹{formatPrice(vo.vendor_items_total)}
                        </span>
                      </div>
                    </div>

                    {/* Items in this order */}
                    <div className="p-4 divide-y divide-slate-100">
                      {vo.items.map((item) => (
                        <div key={item.id} className="py-2.5 flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {item.product_title || 'Store Product'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Quantity: {item.quantity} &times; ₹{formatPrice(item.unit_price)}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900">
                            ₹{formatPrice(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Store Profile */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <Card className="border-slate-200/80 shadow-xs max-w-2xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Store Profile & Settings</h2>
              <p className="text-xs text-slate-500">
                Update your public store details and contact information
              </p>
            </div>

            {profileSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                ✓ Store profile updated successfully!
              </div>
            )}

            <form id="vendor-profile-form" onSubmit={handleUpdateProfile} autoComplete="off" className="space-y-4 text-xs">
              <Input
                label="Store Name"
                id="vendor-profile-storename"
                name="store_name"
                type="text"
                autoComplete="organization"
                required
                value={profileForm.store_name}
                onChange={(e) => setProfileForm({ ...profileForm, store_name: e.target.value })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Email"
                  id="vendor-profile-email"
                  name="business_email"
                  type="email"
                  autoComplete="off"
                  value={profileForm.business_email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, business_email: e.target.value })
                  }
                />
                <Input
                  label="Phone Number"
                  id="vendor-profile-phone"
                  name="business_phone"
                  type="text"
                  autoComplete="tel"
                  value={profileForm.business_phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, business_phone: e.target.value })
                  }
                />
              </div>

              <Input
                label="Business HQ Address"
                id="vendor-profile-address"
                name="business_address"
                type="text"
                autoComplete="street-address"
                value={profileForm.business_address}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, business_address: e.target.value })
                }
              />

              <div>
                <label htmlFor="vendor-profile-description" className="block text-xs font-semibold text-slate-700 mb-1">
                  Store Description
                </label>
                <textarea
                  id="vendor-profile-description"
                  name="business_description"
                  rows={3}
                  value={profileForm.business_description}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, business_description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={profileSaving}
                  isLoading={profileSaving}
                  variant="primary"
                >
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* Product Add / Edit Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={editingProductId ? 'Edit Product' : 'Add New Product'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-medium">
              {formError}
            </div>
          )}

          <form id="vendor-product-form" onSubmit={handleSaveProduct} autoComplete="off" className="space-y-3 text-xs">
            <Input
              label="Product Title"
              id="modal-product-title"
              name="title"
              type="text"
              autoComplete="off"
              required
              value={productForm.title}
              onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
              placeholder="e.g. Dual-Beam Thermal People Counter"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Price (₹ INR)"
                id="modal-product-price"
                name="price"
                type="number"
                step="0.01"
                autoComplete="off"
                required
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                placeholder="4999.00"
              />

              <div>
                <label htmlFor="modal-product-category" className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  id="modal-product-category"
                  name="category"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Hardware">Hardware</option>
                  <option value="Sensors">Sensors</option>
                  <option value="POS Accessories">POS Accessories</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Software">Software</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="SKU Code"
                id="modal-product-sku"
                name="sku"
                type="text"
                autoComplete="off"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                placeholder="e.g. SENS-TC-200"
              />

              <Input
                label="Stock Units"
                id="modal-product-stock"
                name="stock_quantity"
                type="number"
                min="0"
                autoComplete="off"
                value={productForm.stock_quantity.toString()}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    stock_quantity: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <label htmlFor="modal-product-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                id="modal-product-desc"
                name="description"
                rows={2}
                value={productForm.description}
                onChange={(e) =>
                  setProductForm({ ...productForm, description: e.target.value })
                }
                placeholder="Key features, specs, mounting options..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="modal_is_published"
                checked={productForm.is_published}
                onChange={(e) =>
                  setProductForm({ ...productForm, is_published: e.target.checked })
                }
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="modal_is_published" className="font-semibold text-slate-700">
                Publish to Public Catalog
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowProductModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formLoading}
                isLoading={formLoading}
              >
                {editingProductId ? 'Update Product' : 'Publish Product'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* Delete Confirmation Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(deletingProductId)}
        onClose={() => setDeletingProductId(null)}
        title="Delete Product?"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <span className="text-4xl block">🗑️</span>
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete this product? If customer orders reference this item, the database foreign-key constraint will disallow deletion and you should unpublish it instead.
          </p>

          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingProductId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deletingProductId && handleDeleteProduct(deletingProductId)}
            >
              Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
