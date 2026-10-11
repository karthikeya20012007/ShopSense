import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Product } from '../types';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<Product>(`/products/${id}`);
        setProduct(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Product could not be retrieved.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading product specifications...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
          <span className="text-4xl block mb-3">⚠️</span>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-sm text-slate-500 mb-6">
            {error || 'This product does not exist or is currently unavailable.'}
          </p>
          <Link
            to="/products"
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors"
          >
            Back to Public Catalog
          </Link>
        </div>
      </div>
    );
  }

  const formattedPrice =
    typeof product.price === 'number'
      ? product.price.toFixed(2)
      : parseFloat(product.price).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          to="/products"
          className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center space-x-1"
        >
          <span>← Back to Catalog</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Visual Column */}
        <div className="bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-12 min-h-[300px]">
          <span className="text-7xl mb-4">📦</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-700 shadow-xs">
            {product.category}
          </span>
        </div>

        {/* Details Column */}
        <div className="p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Store: {product.store_name || 'Verified Marketplace Vendor'}
              </span>
              {product.sku && (
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  SKU: {product.sku}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-3">{product.title}</h1>

            <div className="flex items-baseline space-x-3 mb-6">
              <span className="text-3xl font-extrabold text-slate-900">${formattedPrice}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  product.stock_quantity > 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {product.stock_quantity > 0
                  ? `In Stock (${product.stock_quantity} units)`
                  : 'Out of Stock'}
              </span>
            </div>

            <div className="border-t border-slate-100 pt-4 mb-6">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Product Description
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.description || 'No detailed specifications provided.'}
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 italic">
              Public Catalog Foundation • Milestone 1. Checkout and payments will be enabled in future milestones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
