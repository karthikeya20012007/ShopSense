import React, { useState, useEffect } from 'react';
import {
  getProductImage,
  getCategoryFallbackImage,
  CATEGORY_SVG_FALLBACKS,
} from '../utils/productImages';

interface ProductImageProps {
  product?: {
    id?: string;
    title?: string;
    category?: string;
    sku?: string | null;
    image_url?: string | null;
  };
  src?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: '4/3' | 'square' | '16/9' | 'auto';
  fit?: 'contain' | 'cover';
  zoomOnHover?: boolean;
  priority?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  product,
  src,
  alt,
  className = '',
  containerClassName = '',
  aspectRatio = '4/3',
  fit = 'contain',
  zoomOnHover = true,
  priority = false,
}) => {
  const primarySrc = src || getProductImage(product);
  const [currentSrc, setCurrentSrc] = useState<string>(primarySrc);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [fallbackStep, setFallbackStep] = useState<number>(0);

  // Synchronize when incoming props change
  useEffect(() => {
    const nextSrc = src || getProductImage(product);
    setCurrentSrc(nextSrc);
    setStatus('loading');
    setFallbackStep(0);
  }, [src, product?.id, product?.image_url, product?.category, product?.title, product?.sku]);

  const handleLoad = () => {
    setStatus('loaded');
  };

  const handleError = () => {
    // Step 0 -> Step 1: Try locally bundled static category SVG asset (/images/products/*.svg)
    if (fallbackStep === 0) {
      const localAsset = getCategoryFallbackImage(product?.category, false);
      if (localAsset && localAsset !== currentSrc) {
        setFallbackStep(1);
        setCurrentSrc(localAsset);
        setStatus('loading');
        return;
      }
    }

    // Step 1 -> Step 2: Try inline Vector SVG Data URI for the specific category
    if (fallbackStep <= 1) {
      const inlineFallback = getCategoryFallbackImage(product?.category, true);
      if (inlineFallback && inlineFallback !== currentSrc) {
        setFallbackStep(2);
        setCurrentSrc(inlineFallback);
        setStatus('loading');
        return;
      }
    }

    // Step 2 -> Step 3: Try baseline Default SVG Data URI
    if (fallbackStep === 2) {
      const defaultInline = CATEGORY_SVG_FALLBACKS['Default'];
      if (defaultInline && defaultInline !== currentSrc) {
        setFallbackStep(3);
        setCurrentSrc(defaultInline);
        setStatus('loading');
        return;
      }
    }

    // Terminate to prevent infinite loops; fallback to robust JSX vector graphic
    setFallbackStep(4);
    setStatus('error');
  };

  const aspectClass =
    aspectRatio === '4/3'
      ? 'aspect-[4/3]'
      : aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === '16/9'
      ? 'aspect-video'
      : '';

  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  const zoomClass = zoomOnHover ? 'group-hover:scale-105 transition-transform duration-300 ease-out' : '';

  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-50 flex items-center justify-center ${aspectClass} ${containerClassName}`}
    >
      {/* Loading Shimmer Skeleton (shown while loading to prevent CLS and avoid flash of unstyled content) */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 animate-pulse pointer-events-none z-10" />
      )}

      {/* Actual Product / Hardware Image */}
      {status !== 'error' ? (
        <img
          src={currentSrc}
          alt={alt || product?.title || 'ShopSense Hardware Product'}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full p-2 ${fitClass} ${zoomClass} transition-opacity duration-200 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${className}`}
        />
      ) : (
        /* Ultimate graceful JSX fallback: renders crisp vector representation with zero broken-image artifacts */
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-slate-400 bg-slate-50 select-none">
          <svg className="w-10 h-10 mb-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center line-clamp-1">
            {product?.category || 'Retail Hardware'}
          </span>
        </div>
      )}
    </div>
  );
};
