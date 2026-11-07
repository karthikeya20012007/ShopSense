import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { ProductRecommendationsResponse, RecommendedProductItem } from '../types';
import { ProductImage } from './ProductImage';
import { getCategoryIcon } from '../utils/productImages';

interface RecommendationsSectionProps {
  variant: 'for-me' | 'popular' | 'similar';
  productId?: string;
  title?: string;
  subtitle?: string;
  limit?: number;
}

export const RecommendationsSection: React.FC<RecommendationsSectionProps> = ({
  variant,
  productId,
  title,
  subtitle,
  limit = 4,
}) => {
  const [data, setData] = useState<ProductRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);

        let endpoint = '';
        if (variant === 'for-me') {
          endpoint = `/recommendations/for-me?limit=${limit}`;
        } else if (variant === 'popular') {
          endpoint = `/recommendations/popular?limit=${limit}`;
        } else if (variant === 'similar' && productId) {
          endpoint = `/recommendations/products/${productId}/similar?limit=${limit}`;
        }

        if (!endpoint) return;

        const res = await apiClient.get<ProductRecommendationsResponse>(endpoint);
        setData(res.data);
      } catch (err: any) {
        if (variant === 'for-me' && (err.response?.status === 401 || err.response?.status === 403)) {
          setData(null);
        } else {
          setError(err.response?.data?.detail || 'Could not load recommendations.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [variant, productId, limit]);

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center space-x-2 text-slate-400 text-xs">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading tailored product recommendations...</span>
      </div>
    );
  }

  if (error || !data || data.items.length === 0) {
    return null;
  }

  const defaultTitles = {
    'for-me': 'Recommended For You',
    popular: '🔥 Trending Bestsellers',
    similar: '⚡ Frequently Bought Together & Similar Hardware',
  };

  const defaultSubtitles = {
    'for-me': 'Personalized hardware selections based on your order history and category affinity',
    popular: 'Top-selling retail sensors and POS terminals across the marketplace ecosystem',
    similar: 'Engineered item-item similarity combining co-purchasing data and technical specs',
  };

  const sectionTitle = title || defaultTitles[variant];
  const sectionSubtitle = subtitle || defaultSubtitles[variant];

  const formatPrice = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num)
      ? '0.00'
      : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="my-10 pt-8 border-t border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>{sectionTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{sectionSubtitle}</p>
        </div>

        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 flex items-center gap-1.5 shrink-0 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          <span>AI Model: {data.scenario}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.items.map((item: RecommendedProductItem) => {
          const categoryIcon = getCategoryIcon(item.category);

          return (
            <Link
              key={item.product_id}
              to={`/products/${item.product_id}`}
              className="group bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              {/* Product Image */}
              <div className="relative bg-slate-50 border-b border-slate-100/80 overflow-hidden">
                <ProductImage
                  product={{
                    id: item.product_id,
                    title: item.title,
                    category: item.category,
                    sku: item.sku,
                  }}
                  aspectRatio="4/3"
                  fit="contain"
                  containerClassName="p-3"
                  zoomOnHover={true}
                />
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/95 text-slate-700 shadow-2xs border border-slate-200/70 flex items-center gap-1">
                  <span>{categoryIcon}</span>
                  <span className="truncate max-w-[110px]">{item.category}</span>
                </span>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  {/* Recommendation Reason Pill */}
                  <div className="mb-2">
                    <span
                      className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded truncate max-w-full"
                      title={item.recommendation_reason}
                    >
                      {item.recommendation_reason}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors mb-2 leading-snug">
                    {item.title}
                  </h3>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-slate-900">₹{formatPrice(item.price)}</span>
                    <div className="text-[10px]">
                      {item.stock_quantity > 0 ? (
                        <span className="text-emerald-600 font-semibold">In Stock</span>
                      ) : (
                        <span className="text-rose-600 font-semibold">Out of Stock</span>
                      )}
                    </div>
                  </div>

                  <span className="px-3 py-1.5 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs">
                    View →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
