import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import type { Order } from '../types';
import { ProductImage } from '../components/ProductImage';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

export const CartPage: React.FC = () => {
  const { items, removeFromCart, updateQuantity, clearCart, cartSubtotal, totalItems } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/cart' } } });
      return;
    }

    if (user?.role !== 'CUSTOMER') {
      setCheckoutError(
        `Your account has role '${user?.role}'. Checkout is reserved for Customer accounts. Please sign in as a Customer to place orders.`
      );
      return;
    }

    if (items.length === 0) return;

    try {
      setCheckoutLoading(true);
      setCheckoutError(null);

      const payload = {
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      };

      const res = await apiClient.post<Order>('/orders/checkout', payload);
      setConfirmedOrder(res.data);
      clearCart();
      toast.success('Your order has been placed and inventory reserved atomically.', 'Checkout Successful');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setCheckoutError(detail);
      } else if (Array.isArray(detail)) {
        setCheckoutError(detail.map((d: any) => d.msg).join(', '));
      } else {
        setCheckoutError('An unexpected error occurred during checkout. Please try again.');
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Order Confirmation State
  if (confirmedOrder) {
    const formattedTotal =
      typeof confirmedOrder.total_amount === 'number'
        ? confirmedOrder.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : parseFloat(confirmedOrder.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-xs">
            ✓
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
              Order Confirmed
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 mb-2">
              Thank You for Your Order!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Your procurement request has been processed and inventory has been locked with atomic row-level guarantees.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 max-w-md mx-auto text-left text-xs space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Order Reference:</span>
              <span className="font-mono font-bold text-slate-800 select-all">
                {confirmedOrder.id}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Order Date:</span>
              <span className="text-slate-800 font-semibold">
                {new Date(confirmedOrder.created_at).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 font-semibold text-sm">
              <span className="text-slate-700">Total Charged:</span>
              <span className="text-base font-extrabold text-slate-900">₹{formattedTotal}</span>
            </div>
          </div>

          {/* Ordered Line Items Summary */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden text-left text-xs shadow-2xs">
            <div className="bg-slate-100/80 px-4 py-2.5 font-bold text-slate-700 border-b border-slate-200/60">
              Order Items ({confirmedOrder.items.length})
            </div>
            <div className="divide-y divide-slate-100">
              {confirmedOrder.items.map((item) => (
                <div key={item.id} className="p-3.5 flex justify-between items-center hover:bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg p-1 shrink-0 overflow-hidden">
                      <ProductImage
                        product={{ id: item.product_id, title: item.product_title || '' }}
                        aspectRatio="square"
                        fit="contain"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block leading-tight">
                        {item.product_title || 'Catalog Product'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Qty: {item.quantity} × ₹
                        {typeof item.unit_price === 'number'
                          ? item.unit_price.toFixed(2)
                          : parseFloat(item.unit_price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 text-sm">
                    ₹
                    {typeof item.subtotal === 'number'
                      ? item.subtotal.toFixed(2)
                      : parseFloat(item.subtotal).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
            <Link
              to="/orders"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
            >
              View Order History →
            </Link>
            <Link
              to="/products"
              className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-lg transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formattedSubtotal = cartSubtotal.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Shopping Cart</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review your selected hardware & sensors before placing your atomic order
        </p>
      </div>

      {checkoutError && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs flex justify-between items-center shadow-2xs">
          <div>
            <strong className="font-bold block mb-0.5">Checkout Notice:</strong>
            {checkoutError}
          </div>
          <button
            onClick={() => setCheckoutError(null)}
            className="text-rose-400 hover:text-rose-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="Your shopping cart is empty"
          description="You have not added any hardware items to your cart yet. Browse our verified inventory of 2D scanners, IoT environmental nodes, and POS terminals."
          actionLabel="Explore Product Catalog"
          onAction={() => navigate('/products')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cart Items ({totalItems})
                </span>
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {items.map((item) => {
                  const unitPrice =
                    typeof item.product.price === 'number'
                      ? item.product.price
                      : parseFloat(item.product.price) || 0;
                  const itemSubtotal = unitPrice * item.quantity;

                  return (
                    <div
                      key={item.product.id}
                      className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-xl border border-slate-200/70 p-2 shrink-0 overflow-hidden flex items-center justify-center">
                          <ProductImage
                            product={item.product}
                            aspectRatio="square"
                            fit="contain"
                          />
                        </div>
                        <div>
                          <Link
                            to={`/products/${item.product.id}`}
                            className="text-sm font-bold text-slate-900 hover:text-blue-600 block line-clamp-1 leading-snug"
                          >
                            {item.product.title}
                          </Link>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Category: {item.product.category} • Store:{' '}
                            <span className="text-slate-600 font-medium">
                              {item.product.store_name || 'Marketplace'}
                            </span>
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 mt-1 block">
                            ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                          </span>
                        </div>
                      </div>

                      {/* Quantity Stepper & Removal */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-xs font-bold text-slate-900 min-w-[28px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                Math.min(item.product.stock_quantity, item.quantity + 1)
                              )
                            }
                            disabled={item.quantity >= item.product.stock_quantity}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900 block">
                            ₹{itemSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Order Summary & Checkout Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Order Summary
              </h2>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({totalItems} items):</span>
                  <span className="font-bold text-slate-900">₹{formattedSubtotal}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Freight & Transit Insurance:</span>
                  <span className="text-emerald-700 font-bold">FREE</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (Included):</span>
                  <span className="text-slate-500 font-medium">Standard 18%</span>
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Order Total:</span>
                  <span className="text-2xl font-black text-slate-900">₹{formattedSubtotal}</span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                isLoading={checkoutLoading}
                variant="primary"
                size="lg"
                className="w-full py-3"
              >
                Proceed to Checkout →
              </Button>

              <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                <p className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Row-level database locks ensure no overselling</span>
                </p>
                <p className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Full invoice available upon confirmation</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
