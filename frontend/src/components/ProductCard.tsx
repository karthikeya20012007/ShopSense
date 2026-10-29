import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const formattedPrice =
    typeof product.price === 'number'
      ? product.price.toFixed(2)
      : parseFloat(product.price).toFixed(2);

  const handleQuickAdd = () => {
    if (product.stock_quantity > 0) {
      addToCart(product, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }
  };

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
        <span
          className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[11px] font-semibold ${
            product.stock_quantity > 0
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
        </span>
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

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Price</span>
            <span className="text-lg font-bold text-slate-900">₹{formattedPrice}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <Link
              to={`/products/${product.id}`}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors"
            >
              Details
            </Link>
            <button
              onClick={handleQuickAdd}
              disabled={product.stock_quantity <= 0}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                product.stock_quantity <= 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : added
                  ? 'bg-emerald-600 text-white'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
              }`}
            >
              {added ? '✓ Added' : '+ Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

