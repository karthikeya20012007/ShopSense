import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import type { Order } from '../types';

export const CartPage: React.FC = () => {
  const { items, removeFromCart, updateQuantity, clearCart, cartSubtotal, totalItems } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/cart');
      return;
    }

    if (user?.role !== 'CUSTOMER') {
      setCheckoutError(
        `Your account has role '${user?.role}'. Checkout is currently restricted to customer accounts. Please log in with a customer account.`
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
        ? confirmedOrder.total_amount.toFixed(2)
        : parseFloat(confirmedOrder.total_amount).toFixed(2);

    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>

          <div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
              Status: {confirmedOrder.status}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-3 mb-1">
              Order Placed Successfully!
            </h1>
            <p className="text-xs text-slate-500">
              Inventory has been reserved atomically with row-level database locks.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Reference:</span>
              <span className="font-mono font-bold text-slate-800 select-all">
                {confirmedOrder.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order Placed:</span>
              <span className="text-slate-800">
                {new Date(confirmedOrder.created_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
              <span className="text-slate-700">Total Charged:</span>
              <span className="text-base font-bold text-slate-900">₹{formattedTotal}</span>
            </div>
          </div>

          {/* Ordered Line Items Summary */}
          <div className="border border-slate-100 rounded-xl overflow-hidden text-left text-xs">
            <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-700">
              Order Items ({confirmedOrder.items.length})
            </div>
            <div className="divide-y divide-slate-100">
              {confirmedOrder.items.map((item) => (
                <div key={item.id} className="p-3 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-slate-900">
                      {item.product_title || 'Catalog Product'}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      Store: {item.store_name || 'Marketplace Vendor'} • Qty: {item.quantity} × ₹
                      {typeof item.unit_price === 'number'
                        ? item.unit_price.toFixed(2)
                        : parseFloat(item.unit_price).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">
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
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
            >
              View Order History
            </Link>
            <Link
              to="/products"
              className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs rounded-lg transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shopping Cart</h1>
        <p className="text-xs text-slate-500">
          Review your selected hardware & sensors before placing your order
        </p>
      </div>

      {checkoutError && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs flex justify-between items-center">
          <div>
            <strong className="font-semibold block mb-0.5">Checkout Validation Error:</strong>
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
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <span className="text-5xl block mb-3">🛒</span>
          <h2 className="text-base font-semibold text-slate-800 mb-1">Your cart is empty</h2>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
            You have not added any products to your shopping cart yet. Explore our verified sensor and retail catalog.
          </p>
          <Link
            to="/products"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cart Items ({totalItems})
                </span>
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Clear Cart
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
                    <div key={item.product.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
                          📦
                        </div>
                        <div>
                          <Link
                            to={`/products/${item.product.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-sky-600 block line-clamp-1"
                          >
                            {item.product.title}
                          </Link>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Category: {item.product.category} • Store:{' '}
                            <span className="text-slate-600 font-medium">
                              {item.product.store_name || 'Marketplace'}
                            </span>
                          </span>
                          <span className="text-xs font-bold text-slate-900 mt-1 block">
                            ₹{unitPrice.toFixed(2)} each
                          </span>
                        </div>
                      </div>

                      {/* Quantity & Controls */}
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-4">
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-xs font-semibold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock_quantity}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right min-w-[80px]">
                          <span className="text-xs font-bold text-slate-900 block">
                            ₹{itemSubtotal.toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 text-sm font-bold p-1"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Checkout Summary Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Order Summary
              </h2>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Total Units:</span>
                  <span className="font-semibold text-slate-800">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span>Distinct Items:</span>
                  <span className="font-semibold text-slate-800">{items.length}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-bold text-slate-900">
                  <span>Estimated Total:</span>
                  <span className="text-lg font-extrabold text-sky-700">
                    ₹{cartSubtotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-[11px] text-sky-800 space-y-1">
                <p className="font-semibold">⚡ Server-Authoritative Checkout</p>
                <p className="text-sky-700">
                  Prices, active publication status, and inventory are atomically verified on the PostgreSQL backend during order creation.
                </p>
              </div>

              {isAuthenticated ? (
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || items.length === 0}
                  className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-center space-x-2"
                >
                  {checkoutLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Locking Inventory & Placing Order...</span>
                    </>
                  ) : (
                    <span>Proceed to Order (₹{cartSubtotal.toFixed(2)})</span>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login?redirect=/cart"
                    className="block w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-center rounded-xl font-bold text-xs transition-colors shadow-sm"
                  >
                    Log In as Customer to Checkout
                  </Link>
                  <Link
                    to="/register/customer"
                    className="block w-full py-2 text-slate-600 hover:text-slate-900 text-center text-xs font-semibold"
                  >
                    Don't have an account? Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
