import React from 'react';
import type { VendorStatus, AccountStatus, OrderStatus, UserRole } from '../types';

interface StatusBadgeProps {
  status: VendorStatus | AccountStatus | OrderStatus | UserRole | string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'md' }) => {
  let badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  const s = String(status || '').toUpperCase();

  switch (s) {
    case 'APPROVED':
    case 'ACTIVE':
    case 'COMPLETED':
    case 'COMPLETE':
      badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      break;

    case 'PENDING':
    case 'PARTIAL':
      badgeStyles = 'bg-amber-50 text-amber-800 border-amber-200';
      dotColor = 'bg-amber-500';
      break;

    case 'REJECTED':
    case 'DISABLED':
    case 'CANCELLED':
    case 'UNAVAILABLE':
      badgeStyles = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      break;

    case 'REFUNDED':
      badgeStyles = 'bg-purple-50 text-purple-700 border-purple-200';
      dotColor = 'bg-purple-500';
      break;

    case 'ADMIN':
      badgeStyles = 'bg-slate-900 text-sky-300 border-slate-800';
      dotColor = 'bg-sky-400';
      break;

    case 'VENDOR':
      badgeStyles = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      break;

    case 'CUSTOMER':
      badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
      break;

    default:
      badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
  }

  const sizeClass = size === 'sm' ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold border ${sizeClass} ${badgeStyles} ${className}`}
    >
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
};
