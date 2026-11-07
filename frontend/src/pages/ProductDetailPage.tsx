import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { RecommendationsSection } from '../components/RecommendationsSection';
import { ProductImage } from '../components/ProductImage';
import { getCategoryIcon } from '../utils/productImages';
import { useToast } from '../components/ui/Toast';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [addedNotice, setAddedNotice] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'specs' | 'shipping' | 'vendor'>('specs');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<Product>(`/products/${id}`);
        setProduct(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Product could not be retrieved from the catalog.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="aspect-square bg-slate-200 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse" />
            <div className="h-8 bg-slate-200 rounded w-3/4 animate-pulse" />
            <div className="h-6 bg-slate-200 rounded w-1/3 animate-pulse" />
            <div className="h-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-10 bg-slate-200 rounded w-1/2 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
          <span className="text-4xl block mb-3">⚠️</span>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            {error || 'This product does not exist, has been archived, or is currently unpublished.'}
          </p>
          <Link
            to="/products"
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
          >
            ← Return to Marketplace Catalog
          </Link>
        </div>
      </div>
    );
  }

  const formattedPrice =
    typeof product.price === 'number'
      ? product.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : parseFloat(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const categoryIcon = getCategoryIcon(product.category);
  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= (product.reorder_level || 5);

  const handleAddToCart = () => {
    if (product.stock_quantity > 0) {
      addToCart(product, quantity);
      setAddedNotice(true);
      toast.success(`Added ${quantity} unit(s) of "${product.title}" to your cart.`, 'Cart Updated');
      setTimeout(() => setAddedNotice(false), 2000);
    }
  };

  const handleBuyNow = () => {
    if (product.stock_quantity > 0) {
      addToCart(product, quantity);
      navigate('/cart');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <nav className="mb-6 flex items-center space-x-2 text-xs text-slate-500 font-medium overflow-x-auto whitespace-nowrap pb-1">
        <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-blue-600 transition-colors">Catalog</Link>
        <span>/</span>
        <span className="text-slate-400">{product.category}</span>
        <span>/</span>
        <span className="text-slate-900 font-semibold truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Showcase Box */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Visual Column / Gallery */}
          <div className="p-8 sm:p-12 bg-slate-50/50 flex flex-col items-center justify-center relative">
            <div className="w-full max-w-md bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs flex items-center justify-center">
              <ProductImage
                product={product}
                aspectRatio="square"
                fit="contain"
                zoomOnHover={true}
                priority={true}
                containerClassName="bg-transparent"
              />
            </div>

            {/* Badges Overlay */}
            <div className="flex items-center gap-2 mt-4">
              <Badge variant="primary" size="md">
                <span>{categoryIcon}</span>
                <span>{product.category}</span>
              </Badge>
              {product.sku && (
                <span className="font-mono text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                  SKU: {product.sku}
                </span>
              )}
            </div>
          </div>

          {/* Details & Procurement Column */}
          <div className="p-8 sm:p-10 flex flex-col justify-between">
            <div>
              {/* Store & Vendor Identity */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Store:</span>
                  <strong className="text-slate-800 font-bold hover:text-blue-600">
                    {product.store_name || 'Verified Marketplace Vendor'}
                  </strong>
                </div>

                <Badge variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}>
                  {isOutOfStock ? 'Out of Stock' : isLowStock ? `Low Stock (${product.stock_quantity})` : 'In Stock'}
                </Badge>
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-4">
                {product.title}
              </h1>

              {/* Pricing Box */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 mb-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">
                    ₹{formattedPrice}
                  </span>
                  <span className="text-xs text-slate-500">
                    Inclusive of all GST & standard freight
                  </span>
                </div>
                <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                  <span>✓</span>
                  <span>Row-level transactional stock reservation guaranteed</span>
                </p>
              </div>

              {/* Short Description */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Overview
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {product.description || 'Enterprise-grade retail sensor hardware engineered for seamless multi-store integration, real-time inventory synchronization, and rugged POS durability.'}
                </p>
              </div>

              {/* Quantity Selector & Add to Cart Controls */}
              {!isOutOfStock ? (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-700">Select Quantity:</span>
                    <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm transition-colors disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="px-4 py-1.5 text-xs font-bold text-slate-900 min-w-[36px] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
                        disabled={quantity >= product.stock_quantity}
                        className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm transition-colors disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-slate-400">
                      ({product.stock_quantity} units available)
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      onClick={handleAddToCart}
                      variant="outline"
                      size="md"
                      className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50 py-3"
                    >
                      {addedNotice ? '✓ Added to Cart!' : '🛒 Add to Cart'}
                    </Button>
                    <Button
                      onClick={handleBuyNow}
                      variant="primary"
                      size="md"
                      className="flex-1 py-3"
                    >
                      Buy Now & Checkout →
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  <strong>Currently Out of Stock:</strong> This item is awaiting replenishment from the supplier. Check back soon or contact the vendor.
                </div>
              )}
            </div>

            {/* Procurement Safeguard Footer */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>B2B Commercial Invoicing</span>
              <span>Direct Vendor Fulfillment</span>
              <span>Secure Transactions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Specification Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden mb-12">
        <div className="border-b border-slate-100 px-6 flex space-x-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('specs')}
            className={`py-4 border-b-2 transition-colors ${
              activeTab === 'specs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Technical Specifications
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`py-4 border-b-2 transition-colors ${
              activeTab === 'shipping'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Fulfillment & Delivery
          </button>
          <button
            onClick={() => setActiveTab('vendor')}
            className={`py-4 border-b-2 transition-colors ${
              activeTab === 'vendor'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Vendor Verification
          </button>
        </div>

        <div className="p-6 sm:p-8 text-xs text-slate-600">
          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Product ID</span>
                <span className="font-mono text-slate-800">{product.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Catalog SKU</span>
                <span className="font-mono text-slate-800">{product.sku || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Category</span>
                <span className="font-semibold text-slate-800">{product.category}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Availability</span>
                <span className="font-semibold text-slate-800">{product.stock_quantity} units</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Replenishment Lead Time</span>
                <span className="font-semibold text-slate-800">{product.lead_time_days || 7} days</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Reorder Alert Level</span>
                <span className="font-semibold text-slate-800">{product.reorder_level || 15} units</span>
              </div>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-3 max-w-2xl leading-relaxed">
              <h4 className="font-bold text-slate-900">Enterprise Warehouse Delivery</h4>
              <p>
                All ShopSense verified hardware is dispatched directly from regional hubs with real-time tracking. Orders placed before 3:00 PM IST are processed same-day.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-500">
                <li>Metro deliveries: 24 - 48 hours</li>
                <li>Regional tier-2/3 logistics: 3 - 5 business days</li>
                <li>Transit insurance included on all shipments exceeding ₹10,000</li>
              </ul>
            </div>
          )}

          {activeTab === 'vendor' && (
            <div className="space-y-3 max-w-2xl">
              <h4 className="font-bold text-slate-900">Platform Supplier Transparency</h4>
              <p>
                Supplied by <strong className="text-slate-800">{product.store_name || 'Marketplace Seller'}</strong>, an admin-vetted hardware distributor adhering to ShopSense SLA standards and GST invoicing guidelines.
              </p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 mt-2">
                <span className="font-bold text-slate-800 block mb-1">Supplier ID:</span>
                <span className="font-mono text-slate-500 text-[11px] select-all">{product.vendor_id}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Similar Products Hybrid Recommendations */}
      <RecommendationsSection variant="similar" productId={product.id} limit={4} />
    </div>
  );
};
