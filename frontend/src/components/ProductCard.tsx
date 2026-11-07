import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { ProductImage } from './ProductImage';
import { getCategoryIcon } from '../utils/productImages';
import { useToast } from './ui/Toast';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [added, setAdded] = useState(false);

  const formattedPrice =
    typeof product.price === 'number'
      ? product.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : parseFloat(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const categoryIcon = getCategoryIcon(product.category);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock_quantity > 0) {
      addToCart(product, 1);
      setAdded(true);
      toast.success(`Added ${product.title} to your cart.`, 'Item Added');
      setTimeout(() => setAdded(false), 1800);
    }
  };

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= (product.reorder_level || 5);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col h-full group overflow-hidden">
      {/* Product Image Stage */}
      <Link
        to={`/products/${product.id}`}
        className="relative block w-full bg-slate-50 border-b border-slate-100/80 overflow-hidden"
      >
        <ProductImage
          product={product}
          aspectRatio="4/3"
          fit="contain"
          containerClassName="p-3"
          zoomOnHover={true}
        />

        {/* Category Pill */}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/95 text-slate-700 shadow-2xs border border-slate-200/70 backdrop-blur-xs flex items-center gap-1">
          <span>{categoryIcon}</span>
          <span className="truncate max-w-[120px]">{product.category}</span>
        </span>

        {/* Stock Badge */}
        <span
          className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[11px] font-semibold shadow-2xs ${
            isOutOfStock
              ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
              : isLowStock
              ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
          }`}
        >
          {isOutOfStock ? 'Out of stock' : isLowStock ? `Only ${product.stock_quantity} left` : 'In stock'}
        </span>
      </Link>

      {/* Product Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Vendor / Store Identity */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="truncate max-w-[170px] font-medium text-slate-500 hover:text-slate-700">
              {product.store_name || 'Marketplace Seller'}
            </span>
            {product.sku && (
              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                {product.sku}
              </span>
            )}
          </div>

          {/* Product Title */}
          <Link
            to={`/products/${product.id}`}
            className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-blue-600 transition-colors mb-1.5"
            title={product.title}
          >
            {product.title}
          </Link>

          {/* Product Description */}
          {product.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
              {product.description}
            </p>
          )}
        </div>

        {/* Action Row */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
              Price
            </span>
            <span className="text-base font-bold text-slate-900 tracking-tight">
              ₹{formattedPrice}
            </span>
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
              disabled={isOutOfStock}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all duration-150 flex items-center gap-1 ${
                isOutOfStock
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : added
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95'
              }`}
            >
              {added ? (
                <>
                  <span>✓</span>
                  <span>Added</span>
                </>
              ) : (
                <>
                  <span>+</span>
                  <span>Add</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
