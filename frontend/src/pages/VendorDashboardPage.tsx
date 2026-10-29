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

type VendorTab = 'analytics' | 'products' | 'orders' | 'profile';

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
    const num = typeof val === 'number' ? val : parseFloat(val);
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
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading vendor operations...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
          <p className="text-sm font-semibold mb-2">Vendor Access Error</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Vendor Store Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">{profile.store_name}</h1>
              <StatusBadge status={profile.status} />
            </div>
            <p className="text-xs text-slate-500">
              Vendor Store ID: <span className="font-mono text-slate-700">{profile.id}</span> •
              Contact: <span className="text-slate-700">{profile.business_email || 'Not set'}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex space-x-2 mt-6 pt-6 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📊 Sales Analytics
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-2 ${
              activeTab === 'products'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🏷️ Products ({products.length})</span>
            {metrics && metrics.low_stock_count > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {metrics.low_stock_count} Low Stock
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'orders'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🧾 Store Orders
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'profile'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ⚙️ Store Profile
          </button>
        </div>
      </div>

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
      {/* TAB 1: Sales Analytics */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Recognized Revenue
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                ₹{formatPrice(metrics?.recognized_revenue)}
              </span>
              <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                From completed orders
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Units Sold
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {metrics?.total_units_sold ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Across {metrics?.completed_order_count ?? 0} completed orders
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Store Products
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {metrics?.total_products ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Active in catalog
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Inventory Alerts
              </span>
              <span className={`text-2xl font-extrabold ${
                (metrics?.low_stock_count ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}>
                {metrics?.low_stock_count ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Items with ≤ 5 units in stock
              </span>
            </div>
          </div>

          {/* Revenue Trend Area Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Store Revenue Trend</h2>
                <p className="text-xs text-slate-500">
                  Daily recognized revenue generated by your products in completed orders
                </p>
              </div>

              <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDateRangeDays(days)}
                    className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                      dateRangeDays === days
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
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
                  <span>📉</span>
                  <span>No completed sales transactions in this period</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrend}>
                    <defs>
                      <linearGradient id="vendorRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
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
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0284c7"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#vendorRevGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Product Sales Performance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
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
                  <thead className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="pb-3 px-2">Product Title</th>
                      <th className="pb-3 px-2">Category</th>
                      <th className="pb-3 px-2">Price</th>
                      <th className="pb-3 px-2">Current Stock</th>
                      <th className="pb-3 px-2">Units Sold</th>
                      <th className="pb-3 px-2 text-right">Recognized Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productPerformance.map((p) => (
                      <tr key={p.product_id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-2 font-semibold text-slate-900">{p.title}</td>
                        <td className="py-3 px-2 text-slate-500">{p.category}</td>
                        <td className="py-3 px-2 font-bold text-slate-900">₹{formatPrice(p.price)}</td>
                        <td className="py-3 px-2">
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
                        <td className="py-3 px-2 text-slate-600">{p.units_sold}</td>
                        <td className="py-3 px-2 font-bold text-sky-700 text-right">
                          ₹{formatPrice(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Product Management */}
      {/* ========================================================================= */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Manage Store Products</h2>
              <p className="text-xs text-slate-500">
                Add, edit, inspect inventory levels, or toggle publication in the public catalog
              </p>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <input
                id="vendor-product-search"
                name="search"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 flex-1 sm:w-48"
              />
              <button
                onClick={openAddModal}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 shadow-xs"
              >
                + Add Product
              </button>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
              <span className="text-3xl block mb-2">🏷️</span>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">No products found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Click the button below to add your first product or adjust search criteria.
              </p>
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 shadow-xs"
              >
                + Add New Product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Title</th>
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
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.title}
                        {p.sku && (
                          <span className="block text-[11px] text-slate-400 font-mono">
                            SKU: {p.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{formatPrice(p.price)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            p.stock_quantity <= 5
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'text-slate-700'
                          }`}
                        >
                          {p.stock_quantity} units
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            p.is_published
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {p.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-[11px] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingProductId(p.id)}
                          className="px-2.5 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-[11px] transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Store Orders (Vendor-Scoped) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">Store Orders</h2>
              <p className="text-xs text-slate-500">
                Customer transactions containing items sold by your store (isolated to your line items)
              </p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
              {vendorOrders.length} Orders
            </span>
          </div>

          {ordersLoading ? (
            <div className="min-h-[20vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vendorOrders.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
              <span className="text-3xl block mb-2">🧾</span>
              <p className="text-xs text-slate-500">No customer orders received yet.</p>
            </div>
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
                      <span className="text-slate-400 block text-[11px]">
                        Placed on {new Date(vo.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          vo.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {vo.status}
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        ₹{formatPrice(vo.vendor_items_total)}
                      </span>
                    </div>
                  </div>

                  {/* Items in this order */}
                  <div className="p-4 divide-y divide-slate-100">
                    {vo.items.map((item) => (
                      <div key={item.id} className="py-2 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {item.product_title || 'Store Product'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Quantity: {item.quantity} × ₹{formatPrice(item.unit_price)}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Store Profile */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-2xl">
          <div>
            <h2 className="text-base font-bold text-slate-900">Store Profile & Settings</h2>
            <p className="text-xs text-slate-500">
              Update your public store details and contact information
            </p>
          </div>

          {profileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
              ✓ Store profile updated successfully!
            </div>
          )}

          <form id="vendor-profile-form" onSubmit={handleUpdateProfile} autoComplete="off" className="space-y-4 text-xs">
            <div>
              <label htmlFor="vendor-profile-storename" className="block font-semibold text-slate-700 mb-1">
                Store Name
              </label>
              <input
                id="vendor-profile-storename"
                name="store_name"
                type="text"
                autoComplete="organization"
                required
                value={profileForm.store_name}
                onChange={(e) => setProfileForm({ ...profileForm, store_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="vendor-profile-email" className="block font-semibold text-slate-700 mb-1">
                  Contact Email
                </label>
                <input
                  id="vendor-profile-email"
                  name="business_email"
                  type="email"
                  autoComplete="off"
                  value={profileForm.business_email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, business_email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="vendor-profile-phone" className="block font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="vendor-profile-phone"
                  name="business_phone"
                  type="text"
                  autoComplete="tel"
                  value={profileForm.business_phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, business_phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="vendor-profile-address" className="block font-semibold text-slate-700 mb-1">
                Business HQ Address
              </label>
              <input
                id="vendor-profile-address"
                name="business_address"
                type="text"
                autoComplete="street-address"
                value={profileForm.business_address}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, business_address: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label htmlFor="vendor-profile-description" className="block font-semibold text-slate-700 mb-1">
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
              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
              >
                {profileSaving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Product Add / Edit Modal */}
      {/* ========================================================================= */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingProductId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                {formError}
              </div>
            )}

            <form id="vendor-product-form" onSubmit={handleSaveProduct} autoComplete="off" className="space-y-3 text-xs">
              <div>
                <label htmlFor="modal-product-title" className="block font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  id="modal-product-title"
                  name="title"
                  type="text"
                  autoComplete="off"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  placeholder="e.g. Dual-Beam Thermal People Counter"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-product-price" className="block font-semibold text-slate-700 mb-1">Price (₹ INR)</label>
                  <input
                    id="modal-product-price"
                    name="price"
                    type="number"
                    step="0.01"
                    autoComplete="off"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="4999.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="modal-product-category" className="block font-semibold text-slate-700 mb-1">Category</label>
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
                <div>
                  <label htmlFor="modal-product-sku" className="block font-semibold text-slate-700 mb-1">SKU Code</label>
                  <input
                    id="modal-product-sku"
                    name="sku"
                    type="text"
                    autoComplete="off"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="e.g. SENS-TC-200"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="modal-product-stock" className="block font-semibold text-slate-700 mb-1">Stock Units</label>
                  <input
                    id="modal-product-stock"
                    name="stock_quantity"
                    type="number"
                    min="0"
                    autoComplete="off"
                    value={productForm.stock_quantity}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        stock_quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-product-desc" className="block font-semibold text-slate-700 mb-1">Description</label>
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

              <div className="flex items-center space-x-2 pt-2">
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

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editingProductId ? 'Update Product' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Delete Confirmation Modal */}
      {/* ========================================================================= */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4 text-center">
            <span className="text-3xl block mb-2">🗑️</span>
            <h3 className="text-base font-bold text-slate-900">Delete Product?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete this product? If customer orders reference this item, the database foreign-key constraint will disallow deletion and you should unpublish it instead.
            </p>

            <div className="flex justify-center space-x-3 pt-2">
              <button
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProduct(deletingProductId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
