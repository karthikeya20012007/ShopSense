import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import type { Product, ProductListResponse } from '../types';
import { ProductCard } from '../components/ProductCard';
import { ProductImage } from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { RecommendationsSection } from '../components/RecommendationsSection';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import {
  CATEGORY_LOCAL_ASSETS,
} from '../utils/productImages';

interface CategoryCardItem {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  tag: string;
}

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || '';

  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'name'>('newest');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Synchronize URL search parameters if navigated from navbar search or category links
  useEffect(() => {
    const urlQuery = searchParams.get('search') || '';
    const urlCat = searchParams.get('category') || '';
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
      setPage(1);
    }
    if (urlCat !== selectedCategory) {
      setSelectedCategory(urlCat);
      setPage(1);
    }
  }, [searchParams]);

  // The 4 wide showcase pillars featured directly beneath the hero copy
  const wideHeroShowcase = [
    {
      category: 'Barcode & QR Scanners',
      tag: 'Scanning Systems',
      title: 'Optical 2D Imaging Engines',
      subtitle: 'Cordless, handheld & in-counter laser readers',
      image: CATEGORY_LOCAL_ASSETS['Barcode & QR Scanners'],
    },
    {
      category: 'RFID Tags & Smart Readers',
      tag: 'RFID Infrastructure',
      title: 'UHF Portals & Gateways',
      subtitle: 'Multi-channel fixed antennas and asset tags',
      image: CATEGORY_LOCAL_ASSETS['RFID Tags & Smart Readers'],
    },
    {
      category: 'Electronic Shelf Labels (ESL)',
      tag: 'Shelf Displays',
      title: 'Wireless E-Paper Pricing',
      subtitle: 'Sub-GHz mesh dynamic tri-color price tags',
      image: CATEGORY_LOCAL_ASSETS['Electronic Shelf Labels (ESL)'],
    },
    {
      category: 'Point of Sale (POS) Terminals',
      tag: 'POS Terminals',
      title: 'Enterprise Touchstations',
      subtitle: 'All-in-one dual-touch commercial workstations',
      image: CATEGORY_LOCAL_ASSETS['Point of Sale (POS) Terminals'],
    },
  ];

  // 8 Supported commercial product categories
  const supportedCategories: CategoryCardItem[] = [
    {
      id: 'Barcode & QR Scanners',
      name: 'Barcode & QR Scanners',
      subtitle: 'Handheld, cordless & in-counter 2D imagers',
      image: CATEGORY_LOCAL_ASSETS['Barcode & QR Scanners'],
      tag: 'Scanners',
    },
    {
      id: 'RFID Tags & Smart Readers',
      name: 'RFID & Smart Readers',
      subtitle: 'UHF multi-portals, fixed antennas & asset tags',
      image: CATEGORY_LOCAL_ASSETS['RFID Tags & Smart Readers'],
      tag: 'RFID',
    },
    {
      id: 'Electronic Shelf Labels (ESL)',
      name: 'Electronic Shelf Labels',
      subtitle: 'Dynamic tri-color e-paper price displays',
      image: CATEGORY_LOCAL_ASSETS['Electronic Shelf Labels (ESL)'],
      tag: 'E-Paper',
    },
    {
      id: 'Point of Sale (POS) Terminals',
      name: 'POS Terminals',
      subtitle: 'Dual-screen touch workstations & systems',
      image: CATEGORY_LOCAL_ASSETS['Point of Sale (POS) Terminals'],
      tag: 'Workstations',
    },
    {
      id: 'Footfall & Customer Tracking',
      name: 'Footfall & Tracking Nodes',
      subtitle: '3D stereoscopic vision & people counters',
      image: CATEGORY_LOCAL_ASSETS['Footfall & Customer Tracking'],
      tag: 'AI Telemetry',
    },
    {
      id: 'Inventory Counting Scales',
      name: 'Inventory Counting Scales',
      subtitle: 'High-precision digital piece-weighing units',
      image: CATEGORY_LOCAL_ASSETS['Inventory Counting Scales'],
      tag: 'Scales',
    },
    {
      id: 'Cash Drawers & Receipt Printers',
      name: 'Receipt Printers & Drawers',
      subtitle: 'High-speed thermal printers & heavy drawers',
      image: CATEGORY_LOCAL_ASSETS['Cash Drawers & Receipt Printers'],
      tag: 'Peripherals',
    },
    {
      id: 'IoT Environmental Sensors',
      name: 'IoT Environmental Sensors',
      subtitle: 'Temperature, humidity & cold-chain monitors',
      image: CATEGORY_LOCAL_ASSETS['IoT Environmental Sensors'],
      tag: 'Sensors',
    },
  ];

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('query', searchQuery.trim());
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);
      params.append('page', page.toString());
      params.append('page_size', '12');

      const response = await apiClient.get<ProductListResponse>(`/products?${params.toString()}`);
      setProducts(response.data.items || []);
      setTotalPages(response.data.total_pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load public product catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, page]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setPage(1);
    setSearchParams(searchQuery ? { search: searchQuery, category: catId } : { category: catId });

    // Smooth scroll down to catalog section
    const catalogElement = document.getElementById('catalog');
    if (catalogElement) {
      catalogElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setInStockOnly(false);
    setSortBy('newest');
    setSearchParams({});
    setPage(1);
  };

  // Client-side sorting and stock filters on current page
  const processedProducts = useMemo(() => {
    let list = [...products];

    if (inStockOnly) {
      list = list.filter((p) => p.stock_quantity > 0);
    }

    if (sortBy === 'price-asc') {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [products, inStockOnly, sortBy]);

  return (
    <div className="bg-white min-h-screen">
      {/* ========================================================================= */}
      {/* 1. FULL-WIDTH VERTICALLY STRUCTURED HERO SECTION                          */}
      {/* ========================================================================= */}
      <section className="bg-slate-50/70 border-b border-slate-200 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Top Hero Text Container: Clear, centered, professional commercial heading */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 uppercase tracking-wider">
              B2B Commercial Electronics & Retail Systems
            </span>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Enterprise Retail Hardware & Smart Sensing Infrastructure
            </h1>

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
              Direct supplier procurement of industrial 2D barcode scanners, RFID readers, electronic shelf labels, and POS workstations with transactional inventory allocation.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href="#catalog"
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Explore Products &darr;
              </a>
              <a
                href="#categories"
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-white hover:text-blue-600 font-semibold text-xs transition-colors"
              >
                Browse Categories &rarr;
              </a>
            </div>
          </div>

          {/* Wide Visual Hardware Showcase: 4 Core Pillars spanning full width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {wideHeroShowcase.map((card, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectCategory(card.category)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-xs transition-all p-4 flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  <ProductImage
                    src={card.image}
                    alt={card.title}
                    product={{ category: card.category, title: card.title }}
                    aspectRatio="auto"
                    containerClassName="w-full h-36 rounded-lg mb-3 border border-slate-100 p-2 bg-slate-50"
                    priority={true}
                  />
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                    {card.tag}
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-snug mt-1">
                    {card.subtitle}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                  <span>View Equipment</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SECTION A — SHOP BY CATEGORY                                           */}
      {/* ========================================================================= */}
      <section id="categories" className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Shop by Category
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Commercial-grade retail electronics organized by functional domain
            </p>
          </div>
          {selectedCategory && (
            <button
              onClick={() => handleSelectCategory('')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View All Categories
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {supportedCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;

            return (
              <div
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`rounded-xl border p-4 transition-all flex flex-col justify-between group cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-100 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs'
                }`}
              >
                <div>
                  <ProductImage
                    src={cat.image}
                    alt={cat.name}
                    product={{ category: cat.id, title: cat.name }}
                    aspectRatio="auto"
                    containerClassName="w-full h-28 rounded-lg mb-3 border border-slate-100 p-2 bg-slate-50"
                  />
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                    {cat.tag}
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                    {cat.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-snug mt-1">
                    {cat.subtitle}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                  <span>Browse catalog</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SECTION B — FEATURED PRODUCTS (MARKETPLACE CATALOG)                     */}
      {/* ========================================================================= */}
      <section id="catalog" className="bg-slate-50/70 border-t border-slate-200 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header & Active Filters Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Featured Products
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {totalCount} items
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authentic retail hardware models available for commercial procurement
              </p>
            </div>

            {/* Filter & Sort Controls */}
            <div className="flex flex-wrap items-center gap-3 text-xs w-full sm:w-auto justify-end">
              {/* In-Stock Only Switch */}
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-semibold select-none bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span>In-stock only</span>
              </label>

              {/* Sort Dropdown */}
              <select
                id="catalog-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-800 font-semibold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 shadow-2xs"
              >
                <option value="newest">Sort: Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name (A–Z)</option>
              </select>

              {(selectedCategory || searchQuery || inStockOnly) && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200"
                >
                  Clear Filters ✕
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Pills Bar */}
          {(selectedCategory || searchQuery) && (
            <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
              <span className="text-slate-400 font-medium">Active filters:</span>
              {selectedCategory && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 font-semibold shadow-2xs">
                  <span>Category: {selectedCategory}</span>
                  <button
                    onClick={() => handleSelectCategory('')}
                    className="text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 font-semibold shadow-2xs">
                  <span>Search: "{searchQuery}"</span>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchParams(selectedCategory ? { category: selectedCategory } : {});
                    }}
                    className="text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Product Grid Area */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <CardSkeleton key={n} />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 bg-rose-50 border border-rose-200 rounded-xl text-center text-rose-700 text-xs">
              <p className="font-bold mb-1">Failed to load product catalog</p>
              <p className="mb-4">{error}</p>
              <Button variant="danger" size="sm" onClick={fetchProducts}>
                Retry Catalog
              </Button>
            </div>
          ) : processedProducts.length === 0 ? (
            <EmptyState
              icon="🏷️"
              title="No commercial hardware found"
              description="No catalog products match your active search or category filters. Try clearing filters to view all products."
              actionLabel="View All Products"
              onAction={handleClearFilters}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {processedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6 text-xs text-slate-500">
              <span>
                Page <span className="font-bold text-slate-900">{page}</span> of{' '}
                <span className="font-bold text-slate-900">{totalPages}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                >
                  &larr; Previous
                </button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-slate-400">...</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 rounded-md font-semibold text-xs ${
                            page === p
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECTION D — POPULAR & PERSONALIZED RECOMMENDATIONS                      */}
      {/* ========================================================================= */}
      <section className="bg-white border-t border-slate-200 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Personalized recommendations for authenticated customer */}
          {user?.role === 'CUSTOMER' && (
            <RecommendationsSection
              variant="for-me"
              title="Recommended for Your Store Setup"
              subtitle="Personalized hardware suggestions calculated from your purchasing profile"
              limit={4}
            />
          )}

          {/* Popular marketplace recommendations */}
          <RecommendationsSection
            variant="popular"
            title="Marketplace Bestsellers"
            subtitle="Top-procured commercial sensors and hardware across all vendor catalogs"
            limit={4}
          />
        </div>
      </section>
    </div>
  );
};
