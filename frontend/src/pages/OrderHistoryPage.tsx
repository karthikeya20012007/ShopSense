import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Order } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ProductImage } from '../components/ProductImage';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

export const OrderHistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<Order[]>('/orders/me');
      setOrders(res.data || []);
      if (res.data && res.data.length > 0) {
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

  const handleCancelOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setCancellingId(orderId);
      await apiClient.patch(`/orders/${orderId}/status`, { status: 'CANCELLED' });
      toast.success('Order cancelled successfully. Stock has been restored.', 'Order Updated');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to cancel order.', 'Error');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse" />
        <div className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Your Procurement Orders</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track past transactions, itemized sensor details, and inventory allocation
          </p>
        </div>
        <Link
          to="/products"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
        >
          + Continue Shopping
        </Link>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center shadow-2xs">
          <p className="text-sm font-bold mb-1">Error Loading Orders</p>
          <p className="text-xs mb-4">{error}</p>
          <Button onClick={fetchOrders} size="sm" variant="danger">
            Retry Loading
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No procurement orders found"
          description="You have not placed any orders yet. Discover our verified sensors, optical barcode scanners, and POS hardware."
          actionLabel="Browse Products"
          onAction={() => window.location.assign('/products')}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const formattedTotal =
              typeof order.total_amount === 'number'
                ? order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : parseFloat(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const isPending = order.status === 'PENDING';

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-150 hover:border-slate-300"
              >
                {/* Order Summary Header Bar */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        #{order.id.slice(0, 8)}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-slate-400">
                      Placed on {new Date(order.created_at).toLocaleString('en-IN')} •{' '}
                      <span className="text-slate-600 font-semibold">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-5 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Order Total
                      </span>
                      <span className="text-base font-black text-slate-900">₹{formattedTotal}</span>
                    </div>

                    {isPending && (
                      <Button
                        size="xs"
                        variant="outline"
                        isLoading={cancellingId === order.id}
                        onClick={(e) => handleCancelOrder(order.id, e)}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        Cancel Order
                      </Button>
                    )}

                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-md hover:bg-slate-100"
                      aria-label="Expand order details"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded Line Items */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Purchased Line Items
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Order ID: <span className="font-mono text-slate-600 select-all">{order.id}</span>
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-400 border-b border-slate-200/80 pb-2">
                          <tr>
                            <th className="pb-2 font-semibold">Product</th>
                            <th className="pb-2 font-semibold">Supplier Store</th>
                            <th className="pb-2 font-semibold text-right">Unit Price</th>
                            <th className="pb-2 font-semibold text-center">Qty</th>
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
                              <tr key={item.id} className="text-slate-700 hover:bg-white/80 transition-colors">
                                <td className="py-3 flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white rounded-lg border border-slate-200/80 p-1 shrink-0 overflow-hidden">
                                    <ProductImage
                                      product={{ id: item.product_id, title: item.product_title || '' }}
                                      aspectRatio="square"
                                      fit="contain"
                                    />
                                  </div>
                                  <span className="font-bold text-slate-900 leading-tight">
                                    {item.product_title || `Hardware (${item.product_id.slice(0, 8)})`}
                                  </span>
                                </td>
                                <td className="py-3 text-slate-500 font-medium">
                                  {item.store_name || 'Marketplace Vendor'}
                                </td>
                                <td className="py-3 text-right text-slate-800">₹{unitPrice}</td>
                                <td className="py-3 text-center font-bold text-slate-900">{item.quantity}</td>
                                <td className="py-3 font-bold text-slate-900 text-right">₹{lineSubtotal}</td>
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
