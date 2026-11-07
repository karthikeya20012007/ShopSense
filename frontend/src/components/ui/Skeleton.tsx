import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle' | 'text';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = {
    rect: 'rounded-lg',
    circle: 'rounded-full',
    text: 'rounded h-3.5 w-full',
  };

  const inlineStyles: React.CSSProperties = {
    width,
    height,
    ...style,
  };

  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 ${variantStyles[variant]} ${className}`}
      style={inlineStyles}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-2xs">
    <Skeleton className="w-full aspect-[4/3] rounded-lg" />
    <div className="space-y-2">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-full" />
    </div>
    <div className="pt-2 flex justify-between items-center">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  </div>
);
