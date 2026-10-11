import React from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const formattedPrice =
    typeof product.price === 'number'
      ? product.price.toFixed(2)
      : parseFloat(product.price).toFixed(2);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="h-44 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative p-4">
        <span className="text-4xl text-slate-400">📦</span>
        <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-semibold bg-white/90 text-slate-700 shadow-xs">
          {product.category}
        </span>
        {product.store_name && (
          <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-xs font-medium bg-slate-900/80 text-white truncate max-w-[80%]">
            {product.store_name}
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 text-base line-clamp-1 mb-1">
            {product.title}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
            {product.description || 'No detailed specifications provided.'}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Price</span>
            <span className="text-lg font-bold text-slate-900">${formattedPrice}</span>
          </div>

          <Link
            to={`/products/${product.id}`}
            className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-xs transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};
