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
  AdminOverviewMetrics,
  RevenueTrendPoint,
  VendorPerformanceItem,
  AdminProductsAnalyticsResponse,
  Order,
} from '../types';
import { StatusBadge } from '../components/StatusBadge';

type AdminTab = 'analytics' | 'pending' | 'vendors' | 'orders';

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

  // Analytics State
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [topVendors, setTopVendors] = useState<VendorPerformanceItem[]>([]);
  const [productAnalytics, setProductAnalytics] = useState<AdminProductsAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [dateRangeDays, setDateRangeDays] = useState<number>(30);

  // Pending Vendors State
  const [pendingVendors, setPendingVendors] = useState<VendorProfile[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // All Vendors State
  const [allVendors, setAllVendors] = useState<VendorProfile[]>([]);
  const [allVendorsLoading, setAllVendorsLoading] = useState(false);
  const [vendorFilterStatus, setVendorFilterStatus] = useState<string>('ALL');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Fetch Analytics Data
  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      const endDate = new Date().toISOString().split('T')[0];
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - dateRangeDays);
      const startDate = startDateObj.toISOString().split('T')[0];

      const [metricsRes, trendRes, vendorsRes, productsRes] = await Promise.all([
        apiClient.get<AdminOverviewMetrics>('/analytics/admin/overview'),
        apiClient.get<RevenueTrendPoint[]>(`/analytics/admin/revenue?start_date=${startDate}&end_date=${endDate}`),
        apiClient.get<VendorPerformanceItem[]>('/analytics/admin/vendors?limit=5'),
        apiClient.get<AdminProductsAnalyticsResponse>('/analytics/admin/products?limit=5'),
      ]);

      setMetrics(metricsRes.data);
      setRevenueTrend(trendRes.data);
      setTopVendors(vendorsRes.data);
      setProductAnalytics(productsRes.data);
    } catch (err: any) {
      setAnalyticsError(err.response?.data?.detail || 'Failed to load marketplace analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch Pending Vendors
  const loadPendingVendors = async () => {
    try {
      setPendingLoading(true);
      const res = await apiClient.get<VendorProfile[]>('/admin/vendors/pending');
      setPendingVendors(res.data);
    } catch {
      // Ignore
    } finally {
      setPendingLoading(false);
    }
  };

  // Fetch All Vendors
  const loadAllVendors = async () => {
    try {
      setAllVendorsLoading(true);
      const url = vendorFilterStatus === 'ALL'
        ? '/admin/vendors'
        : `/admin/vendors?status=${vendorFilterStatus}`;
      const res = await apiClient.get<VendorProfile[]>(url);
      setAllVendors(res.data);
    } catch {
      // Ignore
    } finally {
      setAllVendorsLoading(false);
    }
  };

  // Fetch Marketplace Orders
  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await apiClient.get<Order[]>('/orders/admin/all');
      setOrders(res.data);
    } catch {
      // Ignore
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    loadPendingVendors();
  }, [dateRangeDays]);

  useEffect(() => {
    if (activeTab === 'vendors') {
      loadAllVendors();
    } else if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'pending') {
      loadPendingVendors();
    }
  }, [activeTab, vendorFilterStatus]);

  const handleStatusUpdate = async (vendorId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setActionLoadingId(vendorId);
      setActionMessage(null);

      const res = await apiClient.patch(`/admin/vendors/${vendorId}/status`, { status });
      const updatedStoreName = res.data.store_name;

      setActionMessage({
        type: 'success',
        text: `Application for "${updatedStoreName}" has been successfully marked as ${status}.`,
      });

      setPendingVendors((prev) => prev.filter((v) => v.id !== vendorId));
      loadAnalytics();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.detail || `Failed to update application status to ${status}.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus });
      loadOrders();
      loadAnalytics();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const formatPrice = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-2xl font-bold text-slate-900">Marketplace Administration</h1>
            </div>
            <p className="text-xs text-slate-500">
              Platform governance, recognized sales reporting, and vendor onboarding review
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                loadAnalytics();
                loadPendingVendors();
                if (activeTab === 'vendors') loadAllVendors();
                if (activeTab === 'orders') loadOrders();
              }}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              🔄 Refresh Platform Data
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mt-6 pt-6 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📊 Sales Analytics & KPIs
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-2 ${
              activeTab === 'pending'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>⏳ Pending Approvals</span>
            {pendingVendors.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                {pendingVendors.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'vendors'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🏪 Vendor Registry
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'orders'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📦 Marketplace Orders
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {analyticsError && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium">
          {analyticsError}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: Analytics & KPIs */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Recognized Revenue
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-extrabold text-slate-900">
                  ₹{formatPrice(metrics?.total_revenue)}
                </span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                From completed orders only
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Completed Orders
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {metrics?.completed_orders_count ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Out of {metrics?.total_orders_count ?? 0} total placed orders
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Approved Vendors
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {metrics?.approved_vendors_count ?? 0}
              </span>
              <span className="text-[11px] text-amber-600 font-medium block mt-1">
                {metrics?.pending_vendors_count ?? 0} pending review
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Published Products
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {metrics?.published_products_count ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Across {metrics?.total_products_count ?? 0} total listed items
              </span>
            </div>
          </div>

          {/* Revenue Chart Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Platform Revenue Trend</h2>
                <p className="text-xs text-slate-500">
                  Daily recognized revenue calculated from committed COMPLETED orders
                </p>
              </div>

              {/* Date Filter Range */}
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
                  <span>No completed sales transactions in this period yet</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrend}>
                    <defs>
                      <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#adminRevGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Leaderboards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Vendors */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Top Performing Vendors
              </h3>
              {topVendors.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No vendor sales recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 text-slate-400 font-semibold">
                      <tr>
                        <th className="pb-2">Store</th>
                        <th className="pb-2">Items Sold</th>
                        <th className="pb-2">Orders</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topVendors.map((v) => (
                        <tr key={v.vendor_id}>
                          <td className="py-2.5 font-semibold text-slate-900">{v.store_name}</td>
                          <td className="py-2.5 text-slate-600">{v.items_sold} units</td>
                          <td className="py-2.5 text-slate-600">{v.order_count}</td>
                          <td className="py-2.5 font-bold text-sky-700 text-right">
                            ₹{formatPrice(v.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Top Selling Products
              </h3>
              {(!productAnalytics || productAnalytics.top_products.length === 0) ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No product sales recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 text-slate-400 font-semibold">
                      <tr>
                        <th className="pb-2">Product</th>
                        <th className="pb-2">Category</th>
                        <th className="pb-2">Units Sold</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productAnalytics.top_products.map((p) => (
                        <tr key={p.product_id}>
                          <td className="py-2.5 font-semibold text-slate-900 line-clamp-1">
                            {p.title}
                          </td>
                          <td className="py-2.5 text-slate-500">{p.category}</td>
                          <td className="py-2.5 text-slate-600">{p.units_sold}</td>
                          <td className="py-2.5 font-bold text-sky-700 text-right">
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Pending Vendor Approvals */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pending Vendor Applications
              </h2>
              <p className="text-xs text-slate-500">
                Review store profiles and authorize access to vendor operations
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              {pendingVendors.length} Applications Pending
            </span>
          </div>

          {pendingLoading ? (
            <div className="min-h-[25vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingVendors.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl">
              <span className="text-4xl block mb-2">✅</span>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Queue is clear!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                There are currently no vendor onboarding applications awaiting review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingVendors.map((vendor) => (
                <div key={vendor.id} className="py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-base font-bold text-slate-900">{vendor.store_name}</h3>
                      <StatusBadge status={vendor.status} />
                    </div>
                    <p className="text-xs text-slate-500">
                      Applicant: <span className="text-slate-800 font-medium">{vendor.applicant_name}</span> ({vendor.applicant_email})
                    </p>
                    <p className="text-xs text-slate-600 mt-2 max-w-xl">
                      {vendor.business_description || 'No store description provided.'}
                    </p>
                    <div className="flex gap-4 pt-2 text-[11px] text-slate-400">
                      <span>Address: {vendor.business_address || 'N/A'}</span>
                      <span>Phone: {vendor.business_phone || 'N/A'}</span>
                      <span>Submitted: {new Date(vendor.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end md:self-auto shrink-0">
                    <button
                      disabled={actionLoadingId === vendor.id}
                      onClick={() => handleStatusUpdate(vendor.id, 'APPROVED')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                      {actionLoadingId === vendor.id ? 'Processing...' : 'Approve Application'}
                    </button>
                    <button
                      disabled={actionLoadingId === vendor.id}
                      onClick={() => handleStatusUpdate(vendor.id, 'REJECTED')}
                      className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Vendor Registry (All Vendors) */}
      {/* ========================================================================= */}
      {activeTab === 'vendors' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Registered Marketplace Vendors</h2>
              <p className="text-xs text-slate-500">
                Inspect all vendors registered on the platform across all lifecycle statuses
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[11px]">Filter:</span>
              {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setVendorFilterStatus(st)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    vendorFilterStatus === st
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {allVendorsLoading ? (
            <div className="min-h-[20vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : allVendors.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-12">
              No vendors found matching status filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-semibold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Store Name</th>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{v.store_name}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {v.applicant_name} ({v.applicant_email})
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {v.business_phone || v.business_email || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(v.created_at).toLocaleDateString()}
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
      {/* TAB 4: Marketplace Orders */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">Platform Orders</h2>
              <p className="text-xs text-slate-500">
                Administrative view of customer orders and status governance (revenue recognition)
              </p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
              {orders.length} Orders
            </span>
          </div>

          {ordersLoading ? (
            <div className="min-h-[20vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-12">
              No orders placed in the marketplace yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-semibold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Current Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{o.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{o.items.length} items</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{formatPrice(o.total_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            o.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : o.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {o.status === 'PENDING' && (
                          <>
                            <button
                              disabled={updatingOrderId === o.id}
                              onClick={() => handleUpdateOrderStatus(o.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors disabled:opacity-50"
                              title="Mark as Completed (Recognizes revenue in platform analytics)"
                            >
                              ✓ Complete
                            </button>
                            <button
                              disabled={updatingOrderId === o.id}
                              onClick={() => handleUpdateOrderStatus(o.id, 'CANCELLED')}
                              className="px-2.5 py-1 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded text-[11px] font-semibold transition-colors disabled:opacity-50"
                              title="Cancel order"
                            >
                              ✕ Cancel
                            </button>
                          </>
                        )}
                        {o.status === 'COMPLETED' && (
                          <span className="text-[11px] text-emerald-600 font-semibold">
                            Revenue Recognized
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
