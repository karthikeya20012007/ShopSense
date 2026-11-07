import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { apiClient } from '../api/client';
import type {
  InventorySummary,
  LowStockAlertItem,
  ReplenishmentItem,
  InventoryTurnover,
  StockMovementItem,
  ProductDemandForecast,
  Product,
} from '../types';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

interface InventoryDashboardProps {
  isAdmin?: boolean;
}

export const InventoryDashboardView: React.FC<InventoryDashboardProps> = ({ isAdmin = false }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlertItem[]>([]);
  const [replenishment, setReplenishment] = useState<ReplenishmentItem[]>([]);
  const [turnover, setTurnover] = useState<InventoryTurnover | null>(null);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [movementTotal, setMovementTotal] = useState<number>(0);
  const [movementPage, setMovementPage] = useState<number>(1);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('');

  // Forecasting states
  const [forecastProductList, setForecastProductList] = useState<Product[]>([]);
  const [selectedForecastProductId, setSelectedForecastProductId] = useState<string>('');
  const [forecast, setForecast] = useState<ProductDemandForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [forecastHorizon, setForecastHorizon] = useState<number>(14);

  // Sub-tabs inside inventory
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'replenishment' | 'movements' | 'forecasting'>('overview');

  const baseEndpoint = isAdmin ? '/inventory' : '/inventory/vendor';

  const formatPrice = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, alertsRes, repRes, turnoverRes, movementsRes] = await Promise.all([
        apiClient.get<InventorySummary>(`${baseEndpoint}/summary`),
        apiClient.get<{ items: LowStockAlertItem[] }>(`${baseEndpoint}/low-stock`),
        apiClient.get<{ items: ReplenishmentItem[] }>(`${baseEndpoint}/replenishment?demand_window_days=30`),
        apiClient.get<InventoryTurnover>(`${baseEndpoint}/turnover?period_days=90`),
        apiClient.get<{ items: StockMovementItem[]; total: number }>(
          `${baseEndpoint}/movements?page=${movementPage}&page_size=10${movementTypeFilter ? `&movement_type=${movementTypeFilter}` : ''}`
        ),
      ]);

      setSummary(summaryRes.data);
      setLowStockAlerts(alertsRes.data.items || []);
      setReplenishment(repRes.data.items || []);
      setTurnover(turnoverRes.data);
      setMovements(movementsRes.data.items || []);
      setMovementTotal(movementsRes.data.total || 0);

      // Load products for forecast dropdown
      const prodRes = await apiClient.get<{ items: Product[] }>('/products?page=1&page_size=50');
      const prods = prodRes.data.items || [];
      setForecastProductList(prods);
      if (prods.length > 0 && !selectedForecastProductId) {
        setSelectedForecastProductId(prods[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load inventory intelligence metrics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchForecast = async (productId: string, horizon: number) => {
    if (!productId) return;
    try {
      setForecastLoading(true);
      const res = await apiClient.get<ProductDemandForecast>(
        `${baseEndpoint}/forecast?product_id=${productId}&forecast_horizon_days=${horizon}`
      );
      setForecast(res.data);
    } catch {
      setForecast(null);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [movementPage, movementTypeFilter]);

  useEffect(() => {
    if (selectedForecastProductId && activeSubTab === 'forecasting') {
      fetchForecast(selectedForecastProductId, forecastHorizon);
    }
  }, [selectedForecastProductId, forecastHorizon, activeSubTab]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 p-6">
        <CardContent className="space-y-3">
          <p className="font-bold text-rose-800 text-sm">Inventory Service Notice</p>
          <p className="text-xs text-rose-700">{error}</p>
          <Button variant="danger" size="sm" onClick={fetchInventoryData}>
            Retry Inventory Query
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'overview'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📊</span>
            <span>Inventory Health & Alerts</span>
          </button>
          <button
            onClick={() => setActiveSubTab('replenishment')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'replenishment'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📦</span>
            <span>Replenishment Planner</span>
          </button>
          <button
            onClick={() => setActiveSubTab('movements')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'movements'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📝</span>
            <span>Audit Ledger ({movementTotal})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('forecasting')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeSubTab === 'forecasting'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📈</span>
            <span>Demand Forecasting</span>
          </button>
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={fetchInventoryData}
          className="self-start sm:self-auto"
        >
          🔄 Refresh
        </Button>
      </div>

      {/* KPI Cards (Always visible) */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Active Catalog
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900">{summary.total_products}</div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Configured Products</span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Units In Stock
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {summary.total_units_in_stock.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Physical On-Hand</span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Valuation Value
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                ₹{formatPrice(summary.total_inventory_cost_value)}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge
                  variant={
                    summary.valuation_status === 'COMPLETE'
                      ? 'success'
                      : summary.valuation_status === 'PARTIAL'
                      ? 'warning'
                      : 'default'
                  }
                  size="sm"
                >
                  {summary.valuation_status}
                </Badge>
                <span className="text-[10px] text-slate-500 font-medium">
                  {summary.cost_coverage_percentage}% coverage
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Low Stock Alerts
              </span>
              <div
                className={`text-xl sm:text-2xl font-extrabold ${
                  summary.low_stock_products_count > 0 ? 'text-amber-600' : 'text-slate-900'
                }`}
              >
                {summary.low_stock_products_count}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Stock &le; Reorder Point</span>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Out of Stock
              </span>
              <div
                className={`text-xl sm:text-2xl font-extrabold ${
                  summary.out_of_stock_products_count > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {summary.out_of_stock_products_count}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Zero inventory units</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 1: Overview & Turnover */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Turnover Card */}
          {turnover && (
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                    Inventory Velocity ({turnover.period_days}-Day Evaluation)
                  </span>
                  <h3 className="text-xl font-extrabold mt-0.5">Turnover Performance</h3>
                </div>
                <Badge variant="info" size="md">
                  Status: {turnover.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-700/60">
                <div>
                  <span className="text-xs text-slate-400 block">Recognized COGS</span>
                  <span className="text-lg font-extrabold text-white">
                    ₹{formatPrice(turnover.cost_of_goods_sold)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Avg Inventory Units</span>
                  <span className="text-lg font-extrabold text-white">
                    {turnover.average_inventory_units ? Number(turnover.average_inventory_units).toFixed(1) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Turnover Ratio</span>
                  <span className="text-lg font-extrabold text-sky-400">
                    {turnover.turnover_ratio ? `${turnover.turnover_ratio}x` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Days to Turn</span>
                  <span className="text-lg font-extrabold text-emerald-400">
                    {turnover.turnover_period_days ? `${turnover.turnover_period_days} days` : 'N/A'}
                  </span>
                </div>
              </div>
              {turnover.notes && (
                <p className="text-xs text-slate-400 mt-4 italic">{turnover.notes}</p>
              )}
            </div>
          )}

          {/* Low Stock Alerts Table */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Low-Stock & Stockout Alerts</h3>
                  <p className="text-xs text-slate-500">Products operating at or below configured safety thresholds</p>
                </div>
                <Badge variant={lowStockAlerts.length > 0 ? 'warning' : 'success'} size="md">
                  {lowStockAlerts.length} Attention Needed
                </Badge>
              </div>

              {lowStockAlerts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  ✅ All inventory levels currently exceed their configured reorder thresholds.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Current Stock</th>
                        <th className="py-2.5 px-3">Reorder Point</th>
                        <th className="py-2.5 px-3">Safety Stock</th>
                        <th className="py-2.5 px-3">Lead Time</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lowStockAlerts.map((item) => (
                        <tr key={item.product_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-900">{item.title}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">{item.sku}</td>
                          <td className="py-3 px-3 text-slate-500">{item.category || 'General'}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{item.current_stock}</td>
                          <td className="py-3 px-3 text-slate-600">{item.reorder_level}</td>
                          <td className="py-3 px-3 text-slate-600">{item.safety_stock}</td>
                          <td className="py-3 px-3 text-slate-600">{item.lead_time_days} days</td>
                          <td className="py-3 px-3">
                            <Badge variant={item.is_out_of_stock ? 'danger' : 'warning'} size="sm">
                              {item.is_out_of_stock ? 'OUT OF STOCK' : 'LOW STOCK'}
                            </Badge>
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

      {/* SUB-TAB 2: Replenishment Recommendations */}
      {activeSubTab === 'replenishment' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Replenishment Recommendations</h3>
                <p className="text-xs text-slate-500">
                  Formula: max(0, daily_demand &times; lead_time + safety_stock - current_stock)
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">Evaluated across 30-day demand window</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Stock</th>
                    <th className="py-2.5 px-3">Daily Demand</th>
                    <th className="py-2.5 px-3">Lead Time</th>
                    <th className="py-2.5 px-3">Safety Stock</th>
                    <th className="py-2.5 px-3">Suggested Reorder</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {replenishment.map((item) => (
                    <tr key={item.product_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.title}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">{item.current_stock}</td>
                      <td className="py-3 px-3 text-slate-600">{item.estimated_daily_demand.toFixed(2)} /d</td>
                      <td className="py-3 px-3 text-slate-600">{item.lead_time_days}d</td>
                      <td className="py-3 px-3 text-slate-600">{item.safety_stock}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-black text-sm ${
                            item.suggested_replenishment_qty > 0 ? 'text-sky-600' : 'text-slate-400'
                          }`}
                        >
                          +{item.suggested_replenishment_qty} units
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            item.status === 'REPLENISHMENT_RECOMMENDED'
                              ? 'warning'
                              : item.status === 'OUT_OF_STOCK'
                              ? 'danger'
                              : item.status === 'INSUFFICIENT_DATA'
                              ? 'purple'
                              : 'success'
                          }
                          size="sm"
                        >
                          {item.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs">{item.recommendation_notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SUB-TAB 3: Stock Movement Audit Ledger */}
      {activeSubTab === 'movements' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Stock Movement Audit Ledger</h3>
                <p className="text-xs text-slate-500">Immutable ledger of all stock decrements, restocks, and adjustments</p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 font-semibold">Filter Type:</label>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => {
                    setMovementTypeFilter(e.target.value);
                    setMovementPage(1);
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">All Movement Types</option>
                  <option value="CHECKOUT_DECREMENT">CHECKOUT_DECREMENT</option>
                  <option value="CANCELLATION_RESTOCK">CANCELLATION_RESTOCK</option>
                  <option value="PURCHASE_RESTOCK">PURCHASE_RESTOCK</option>
                  <option value="MANUAL_ADJUSTMENT">MANUAL_ADJUSTMENT</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Movement Type</th>
                    <th className="py-2.5 px-3">Change</th>
                    <th className="py-2.5 px-3">Previous</th>
                    <th className="py-2.5 px-3">New Stock</th>
                    <th className="py-2.5 px-3">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{m.product_title || m.product_id}</td>
                      <td className="py-3 px-3">
                        <Badge variant="default" size="sm" className="font-mono text-[10px]">
                          {m.movement_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-bold ${m.change_quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.change_quantity > 0 ? `+${m.change_quantity}` : m.change_quantity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{m.previous_stock}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{m.new_stock}</td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">{m.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                Showing page {movementPage} of {Math.ceil(movementTotal / 10) || 1} ({movementTotal} total records)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={movementPage <= 1}
                  onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={movementPage >= Math.ceil(movementTotal / 10)}
                  onClick={() => setMovementPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SUB-TAB 4: Demand Forecasting */}
      {activeSubTab === 'forecasting' && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Baseline Demand Forecasting</h3>
                <p className="text-xs text-slate-500">
                  Predicts future units demand with time-ordered 80/20 train/test holdout evaluation
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedForecastProductId}
                  onChange={(e) => setSelectedForecastProductId(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  {forecastProductList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>

                <select
                  value={forecastHorizon}
                  onChange={(e) => setForecastHorizon(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value={7}>7-Day Horizon</option>
                  <option value={14}>14-Day Horizon</option>
                  <option value={30}>30-Day Horizon</option>
                </select>
              </div>
            </div>

            {forecastLoading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Computing demand projection...</span>
              </div>
            ) : forecast ? (
              <div className="space-y-6">
                {/* Metrics Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Methodology</span>
                    <span className="text-sm font-bold text-slate-900">{forecast.methodology}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Daily Avg Projected</span>
                    <span className="text-sm font-bold text-sky-600">{forecast.average_daily_demand.toFixed(2)} units</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Holdout WMAPE</span>
                    <span className="text-sm font-bold text-slate-900">
                      {forecast.evaluation_wmape !== null && forecast.evaluation_wmape !== undefined
                        ? `${(forecast.evaluation_wmape * 100).toFixed(1)}%`
                        : 'N/A (Sparse/Short)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Accuracy Metric</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {forecast.evaluation_accuracy !== null && forecast.evaluation_accuracy !== undefined
                        ? `${forecast.evaluation_accuracy.toFixed(1)}%`
                        : 'Baseline Applied'}
                    </span>
                  </div>
                </div>

                {/* Chart */}
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast.daily_forecasts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => d.slice(5)}
                        stroke="#94a3b8"
                        fontSize={11}
                      />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        formatter={(val: any) => [`${Number(val).toFixed(2)} units`, 'Predicted Demand']}
                        labelFormatter={(lbl) => `Date: ${lbl}`}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          color: '#fff',
                          borderRadius: '0.75rem',
                          border: 'none',
                          fontSize: '0.75rem',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted_demand"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#0284c7' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {forecast.notes && (
                  <p className="text-xs text-slate-500 italic">{forecast.notes}</p>
                )}
              </div>
            ) : (
              <EmptyState
                icon="📈"
                title="No forecast selected"
                description="Select a catalog product above to view projected sales demand and historical baseline patterns."
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
