import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Order } from '../types';

export const OrderHistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<Order[]>('/orders/me');
      setOrders(res.data);
      if (res.data.length > 0) {
        setExpandedOrderId(res.data[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to retrieve order history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedOrderId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Orders</h1>
          <p className="text-xs text-slate-500">
            View past transactions, line-item details, and inventory reservation status
          </p>
        </div>
        <Link
          to="/products"
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
        >
          + Continue Shopping
        </Link>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
          <p className="text-sm font-semibold mb-2">Error Loading Orders</p>
          <p className="text-xs">{error}</p>
          <button
            onClick={fetchOrders}
            className="mt-4 px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <span className="text-4xl block mb-2">🧾</span>
          <h2 className="text-base font-semibold text-slate-800 mb-1">No orders yet</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            You have not placed any orders yet. Discover high-precision sensors and hardware devices in our catalog.
          </p>
          <Link
            to="/products"
            className="px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const formattedTotal =
              typeof order.total_amount === 'number'
                ? order.total_amount.toFixed(2)
                : parseFloat(order.total_amount).toFixed(2);

            const getStatusBadge = (status: string) => {
              switch (status) {
                case 'COMPLETED':
                  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                case 'CANCELLED':
                  return 'bg-rose-50 text-rose-700 border-rose-200';
                case 'REFUNDED':
                  return 'bg-purple-50 text-purple-700 border-purple-200';
                default:
                  return 'bg-amber-50 text-amber-700 border-amber-200';
              }
            };

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-shadow hover:shadow-sm"
              >
                {/* Order Summary Bar */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        #{order.id.slice(0, 8)}...
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Placed on {new Date(order.created_at).toLocaleString()} •{' '}
                      <span className="text-slate-600 font-medium">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Order Total</span>
                      <span className="text-base font-extrabold text-slate-900">
                        ₹{formattedTotal}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded Line Items Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Order Line Items
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-400 border-b border-slate-200 pb-2">
                          <tr>
                            <th className="pb-2 font-semibold">Item</th>
                            <th className="pb-2 font-semibold">Vendor Store</th>
                            <th className="pb-2 font-semibold">Unit Price</th>
                            <th className="pb-2 font-semibold">Qty</th>
                            <th className="pb-2 font-semibold text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {order.items.map((item) => {
                            const unitPrice =
                              typeof item.unit_price === 'number'
                                ? item.unit_price.toFixed(2)
                                : parseFloat(item.unit_price).toFixed(2);
                            const lineSubtotal =
                              typeof item.subtotal === 'number'
                                ? item.subtotal.toFixed(2)
                                : parseFloat(item.subtotal).toFixed(2);

                            return (
                              <tr key={item.id} className="text-slate-700">
                                <td className="py-2.5 font-semibold text-slate-900">
                                  {item.product_title || `Product (${item.product_id.slice(0, 8)})`}
                                </td>
                                <td className="py-2.5 text-slate-500">
                                  {item.store_name || 'Marketplace Vendor'}
                                </td>
                                <td className="py-2.5">₹{unitPrice}</td>
                                <td className="py-2.5">{item.quantity}</td>
                                <td className="py-2.5 font-bold text-slate-900 text-right">
                                  ₹{lineSubtotal}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
