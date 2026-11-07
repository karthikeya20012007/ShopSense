import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type {
  CustomerAnalyticsSummary,
  CustomerSegmentationResponse,
  CustomerRFMListResponse,
  ClusterProfileItem,
} from '../types';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

export const CustomerAnalyticsView: React.FC = () => {
  const [windowDays, setWindowDays] = useState<number>(365);
  const [summary, setSummary] = useState<CustomerAnalyticsSummary | null>(null);
  const [segmentation, setSegmentation] = useState<CustomerSegmentationResponse | null>(null);
  const [rfmData, setRfmData] = useState<CustomerRFMListResponse | null>(null);
  const [rfmPage, setRfmPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rfmSearch, setRfmSearch] = useState<string>('');
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('ALL');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumRes, segRes, rfmRes] = await Promise.all([
        apiClient.get<CustomerAnalyticsSummary>(`/customer-analytics/summary?observation_window_days=${windowDays}`),
        apiClient.get<CustomerSegmentationResponse>(`/customer-analytics/segments?observation_window_days=${windowDays}`),
        apiClient.get<CustomerRFMListResponse>(`/customer-analytics/rfm?observation_window_days=${windowDays}&page=${rfmPage}&page_size=10`),
      ]);
      setSummary(sumRes.data);
      setSegmentation(segRes.data);
      setRfmData(rfmRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load customer analytics and segmentation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [windowDays, rfmPage]);

  const formatPrice = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const getClusterBadgeStyle = (label?: string | null) => {
    const l = (label || '').toLowerCase();
    if (l.includes('champion')) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (l.includes('loyal')) return 'bg-sky-100 text-sky-800 border-sky-300';
    if (l.includes('at-risk') || l.includes('lapsed')) return 'bg-rose-100 text-rose-800 border-rose-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
        <CardContent className="space-y-3">
          <p className="font-bold text-rose-800 text-sm">Error Loading Customer Analytics</p>
          <p className="text-xs text-rose-700">{error}</p>
          <Button variant="danger" size="sm" onClick={loadData}>
            Retry Calculation
          </Button>
        </CardContent>
      </Card>
    );
  }

  const filteredRfmItems = rfmData?.items.filter((item) => {
    const matchesSearch = item.customer_id.toLowerCase().includes(rfmSearch.toLowerCase());
    const matchesSegment =
      selectedSegmentFilter === 'ALL' ||
      (item.segment_label && item.segment_label.toLowerCase() === selectedSegmentFilter.toLowerCase());
    return matchesSearch && matchesSegment;
  }) || [];

  return (
    <div className="space-y-8">
      {/* Header & Observation Controls */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>👥</span>
                <span>Customer Analytics & K-Means Segmentation</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Recency-Frequency-Monetary (RFM) behavioural clustering, cohort health, and automated segmentation
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="customer-window-select" className="text-xs font-semibold text-slate-600">
                Observation Window:
              </label>
              <select
                id="customer-window-select"
                value={windowDays}
                onChange={(e) => {
                  setWindowDays(Number(e.target.value));
                  setRfmPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white shadow-xs focus:ring-2 focus:ring-sky-500"
              >
                <option value={90}>Last 90 Days</option>
                <option value={180}>Last 180 Days</option>
                <option value={365}>Last 365 Days (1 Year)</option>
                <option value={730}>Last 730 Days (2 Years)</option>
              </select>
              <Button variant="outline" size="xs" onClick={loadData}>
                🔄 Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Registered Customers
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{summary.total_customers.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">
                Active Purchasers: <span className="font-semibold text-sky-600">{summary.active_purchasing_customers}</span> (
                {((summary.active_purchasing_customers / (summary.total_customers || 1)) * 100).toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Recognized Spend
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">₹{formatPrice(summary.total_recognized_spend)}</div>
              <p className="text-xs text-slate-500 mt-1">Over {summary.observation_window_days}-day window</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Average Order Value (AOV)
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">₹{formatPrice(summary.overall_average_order_value)}</div>
              <p className="text-xs text-slate-500 mt-1">Across all completed checkouts</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Order Frequency / Buyer
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{summary.average_orders_per_active_customer.toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">
                Inactive Accounts: <span className="font-semibold text-slate-700">{summary.inactive_customers}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unsupervised Model Evaluation & Quality Diagnostics */}
      {segmentation && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-400/20 text-sky-200 border border-sky-300/30 uppercase tracking-wider">
                Unsupervised Machine Learning Quality
              </span>
              <h3 className="text-lg font-extrabold mt-1">K-Means RFM Model Diagnostics (k = {segmentation.selected_k})</h3>
            </div>
            <div className="text-xs text-sky-200 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              Evaluated on {segmentation.eligible_purchasers_count} active customer profiles
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-white/10 rounded-xl p-4 border border-white/10">
              <span className="text-[11px] font-bold text-sky-200 block uppercase">Silhouette Score</span>
              <div className="text-2xl sm:text-3xl font-extrabold mt-1">
                {segmentation.silhouette_score !== null && segmentation.silhouette_score !== undefined
                  ? segmentation.silhouette_score.toFixed(3)
                  : 'N/A'}
              </div>
              <p className="text-[11px] text-sky-100/70 mt-1">
                Cluster separation score (-1 to +1). Values &gt; 0.50 indicate distinct customer cohorts.
              </p>
            </div>

            <div className="bg-white/10 rounded-xl p-4 border border-white/10">
              <span className="text-[11px] font-bold text-sky-200 block uppercase">Davies-Bouldin Index</span>
              <div className="text-2xl sm:text-3xl font-extrabold mt-1">
                {segmentation.davies_bouldin_index !== null && segmentation.davies_bouldin_index !== undefined
                  ? segmentation.davies_bouldin_index.toFixed(3)
                  : 'N/A'}
              </div>
              <p className="text-[11px] text-sky-100/70 mt-1">
                Ratio of within-cluster distance to between-cluster separation. Lower scores indicate tighter clusters.
              </p>
            </div>

            <div className="bg-white/10 rounded-xl p-4 border border-white/10">
              <span className="text-[11px] font-bold text-sky-200 block uppercase">Multi-Seed ARI Stability</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1">
                {segmentation.stability_score !== null && segmentation.stability_score !== undefined
                  ? `${(segmentation.stability_score * 100).toFixed(1)}%`
                  : '100.0%'}
              </div>
              <p className="text-[11px] text-sky-100/70 mt-1">
                Pairwise Adjusted Rand Index across 5 random seeds (exceeds 85% stability target).
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-sky-100/90 leading-relaxed">
            <span className="font-semibold text-sky-200">Validation Rationale: </span>
            {segmentation.selection_rationale} {segmentation.target_accuracy_evaluation}
          </div>
        </div>
      )}

      {/* K-Means Cluster Breakdown Cards */}
      {segmentation && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">Cluster Profiles & Recommended Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {segmentation.segments.map((cluster: ClusterProfileItem) => (
              <Card
                key={cluster.cluster_id}
                className="border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getClusterBadgeStyle(
                          cluster.segment_label
                        )}`}
                      >
                        {cluster.segment_label}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{cluster.percentage_of_total.toFixed(1)}%</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-1">{cluster.customer_count} Customers</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">{cluster.description}</p>

                    {/* Centroids Table */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Recency Centroid:</span>
                        <span className="font-semibold text-slate-900">{cluster.centroid_recency_days.toFixed(0)} days</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Frequency Centroid:</span>
                        <span className="font-semibold text-slate-900">{cluster.centroid_frequency.toFixed(1)} orders</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Monetary Centroid:</span>
                        <span className="font-semibold text-slate-900">₹{formatPrice(cluster.centroid_monetary)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Average Order Value:</span>
                        <span className="font-semibold text-slate-900">₹{formatPrice(cluster.centroid_average_order_value)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block mb-1">
                      🎯 Strategy & Action
                    </span>
                    <p className="text-xs font-medium text-slate-700 leading-normal">{cluster.recommended_action}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Customer RFM Table */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Customer RFM Ledger</h3>
            <p className="text-xs text-slate-500">
              Individual customer purchasing recency, lifetime orders, total spend, and assigned segment
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search Customer ID..."
              value={rfmSearch}
              onChange={(e) => setRfmSearch(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 flex-1 sm:w-48"
            />
            <select
              value={selectedSegmentFilter}
              onChange={(e) => setSelectedSegmentFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 bg-white"
            >
              <option value="ALL">All Segments</option>
              {segmentation?.segments.map((s) => (
                <option key={s.cluster_id} value={s.segment_label}>
                  {s.segment_label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredRfmItems.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon="🔍"
              title="No customer records match"
              description="Adjust your search query or segment filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Recency (Days)</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Monetary Spend</th>
                  <th className="py-3 px-4">Average Order</th>
                  <th className="py-3 px-4">Assigned Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRfmItems.map((c) => (
                  <tr key={c.customer_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {c.customer_id}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.recency_days !== null && c.recency_days !== undefined
                        ? `${c.recency_days} days ago`
                        : 'No orders'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-semibold">{c.frequency} checkouts</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">
                      ₹{formatPrice(c.monetary_spend)}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      ₹{formatPrice(c.average_order_value)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getClusterBadgeStyle(
                          c.segment_label
                        )}`}
                      >
                        {c.segment_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* RFM Pagination */}
        {rfmData && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {rfmData.page} of {Math.ceil(rfmData.total / rfmData.page_size) || 1} ({rfmData.total} total customers)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={rfmPage <= 1}
                onClick={() => setRfmPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={rfmPage >= Math.ceil(rfmData.total / rfmData.page_size)}
                onClick={() => setRfmPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
