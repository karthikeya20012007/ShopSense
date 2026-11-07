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
import { InventoryDashboardView } from '../components/InventoryDashboardView';
import { CustomerAnalyticsView } from '../components/CustomerAnalyticsView';
import { RecommendationDiagnosticsView } from '../components/RecommendationDiagnosticsView';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

type AdminTab =
  | 'analytics'
  | 'inventory'
  | 'customers'
  | 'recommendations'
  | 'pending'
  | 'vendors'
  | 'orders';

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
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Marketplace Administration</h1>
              </div>
              <p className="text-xs text-slate-300">
                Platform governance, recognized sales reporting, and vendor onboarding review
              </p>
            </div>

            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                loadAnalytics();
                loadPendingVendors();
                if (activeTab === 'vendors') loadAllVendors();
                if (activeTab === 'orders') loadOrders();
              }}
              className="text-white border-slate-700 hover:bg-slate-800 shrink-0"
            >
              🔄 Refresh Platform Data
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-3 bg-slate-50 border-t border-slate-200 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>📊</span>
            <span>Sales Analytics & KPIs</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>📦</span>
            <span>Inventory Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>👥</span>
            <span>Customer RFM & Clusters</span>
          </button>

          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'recommendations'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>🎯</span>
            <span>ML Recommendations</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>⏳</span>
            <span>Pending Approvals</span>
            {pendingVendors.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold ml-1">
                {pendingVendors.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'vendors'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>🏪</span>
            <span>Vendor Registry</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>🧾</span>
            <span>Marketplace Orders</span>
          </button>
        </div>
      </Card>

      {/* Action Feedback Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex justify-between items-center ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="font-bold ml-4 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: Inventory Intelligence */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && <InventoryDashboardView isAdmin={true} />}

      {/* ========================================================================= */}
      {/* TAB: Customer RFM & Segmentation */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && <CustomerAnalyticsView />}

      {/* ========================================================================= */}
      {/* TAB: ML Recommendations Diagnostics */}
      {/* ========================================================================= */}
      {activeTab === 'recommendations' && <RecommendationDiagnosticsView />}

      {/* ========================================================================= */}
      {/* TAB 1: Sales Analytics */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analyticsError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {analyticsError}
            </div>
          )}

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Marketplace GMV
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  ₹{formatPrice(metrics?.total_revenue)}
                </div>
                <span className="text-xs text-emerald-600 font-semibold block mt-1 flex items-center gap-1">
                  <span>✓</span> Completed sales revenue
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Total Orders
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {metrics?.total_orders_count ?? 0}
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  {metrics?.completed_orders_count ?? 0} Completed checkouts
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Active Vendors
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {metrics?.approved_vendors_count ?? 0}
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  {pendingVendors.length} applications pending
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Active Products
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {metrics?.published_products_count ?? 0}
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  Published in public catalog
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Trend Area Chart */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Platform Revenue Trend</h2>
                  <p className="text-xs text-slate-500">
                    Daily recognized platform gross merchandise value from completed checkouts
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
                    <span>No sales recorded in the selected observation window</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend}>
                      <defs>
                        <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
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
                        fill="url(#adminRevGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tables: Top Vendors & Top Selling Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Vendors */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Top Performing Vendors
                </h3>
                {topVendors.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No vendor sales recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                        <tr>
                          <th className="pb-3 px-2">Store Name</th>
                          <th className="pb-3 px-2">Orders</th>
                          <th className="pb-3 px-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {topVendors.map((v) => (
                          <tr key={v.vendor_id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-2">
                              <span className="font-semibold text-slate-900 block">{v.store_name}</span>
                              <span className="text-[11px] text-slate-400">{v.items_sold} units sold</span>
                            </td>
                            <td className="py-3 px-2 text-slate-600 font-semibold">{v.order_count}</td>
                            <td className="py-3 px-2 font-bold text-emerald-600 text-right">
                              ₹{formatPrice(v.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Top Selling Products
                </h3>
                {!productAnalytics || productAnalytics.top_products.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No product sales recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                        <tr>
                          <th className="pb-3 px-2">Product</th>
                          <th className="pb-3 px-2">Units Sold</th>
                          <th className="pb-3 px-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productAnalytics.top_products.map((p) => (
                          <tr key={p.product_id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-2">
                              <span className="font-semibold text-slate-900 block">{p.title}</span>
                              <span className="text-[11px] text-slate-400">{p.category}</span>
                            </td>
                            <td className="py-3 px-2 text-slate-600 font-semibold">{p.units_sold}</td>
                            <td className="py-3 px-2 font-bold text-emerald-600 text-right">
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Pending Approvals Workbench */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Pending Vendor Applications</h2>
                <p className="text-xs text-slate-500">
                  Review applicant profile, business address, and grant or deny selling privileges
                </p>
              </div>
              <Badge variant="warning" size="md">
                {pendingVendors.length} Pending Review
              </Badge>
            </div>

            {pendingLoading ? (
              <div className="min-h-[20vh] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pendingVendors.length === 0 ? (
              <EmptyState
                icon="✅"
                title="All applications reviewed"
                description="There are currently no new vendor registrations pending administrator review."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingVendors.map((vendor) => (
                  <Card key={vendor.id} className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{vendor.store_name}</h3>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ID: {vendor.id.slice(0, 8)}...
                          </span>
                        </div>
                        <StatusBadge status={vendor.status} />
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 font-medium">Contact Email: </span>
                          <span className="font-semibold text-slate-800">{vendor.business_email || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Phone: </span>
                          <span className="text-slate-800">{vendor.business_phone || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Address: </span>
                          <span className="text-slate-800">{vendor.business_address || 'Not provided'}</span>
                        </div>
                        {vendor.business_description && (
                          <div className="pt-1 text-slate-500 italic">
                            &ldquo;{vendor.business_description}&rdquo;
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button
                          variant="success"
                          size="xs"
                          disabled={actionLoadingId === vendor.id}
                          isLoading={actionLoadingId === vendor.id}
                          onClick={() => handleStatusUpdate(vendor.id, 'APPROVED')}
                          className="flex-1"
                        >
                          Approve Store
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          disabled={actionLoadingId === vendor.id}
                          onClick={() => handleStatusUpdate(vendor.id, 'REJECTED')}
                          className="flex-1"
                        >
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Vendor Registry */}
      {/* ========================================================================= */}
      {activeTab === 'vendors' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Vendor Directory & Registry</h2>
                <p className="text-xs text-slate-500">
                  Global list of registered merchant accounts across all lifecycle states
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs">
                {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setVendorFilterStatus(st)}
                    className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                      vendorFilterStatus === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
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
              <EmptyState
                icon="🏪"
                title="No vendors found"
                description="No vendors match the currently selected lifecycle status."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Store Name</th>
                      <th className="py-3 px-4">Vendor ID</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Applied Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allVendors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{v.store_name}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {v.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {v.business_email || 'No email provided'}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(v.created_at).toLocaleDateString()}
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
      {/* TAB 4: Marketplace Orders */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Marketplace Orders</h2>
                <p className="text-xs text-slate-500">
                  Global transaction ledger across all customers and vendors
                </p>
              </div>
              <Badge variant="default" size="md">
                {orders.length} Total Orders
              </Badge>
            </div>

            {ordersLoading ? (
              <div className="min-h-[20vh] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No marketplace orders recorded"
                description="Orders placed by customers will be aggregated and displayed here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Order Reference</th>
                      <th className="py-3 px-4">Customer ID</th>
                      <th className="py-3 px-4">Items Count</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Placed Date</th>
                      <th className="py-3 px-4 text-right">Update Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          #{o.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {o.customer_id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4 text-slate-600">{o.items.length} line items</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          ₹{formatPrice(o.total_amount)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(o.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <select
                            disabled={updatingOrderId === o.id}
                            value={o.status}
                            onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 disabled:opacity-50"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
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
    </div>
  );
};
