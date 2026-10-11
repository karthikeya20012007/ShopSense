import React from 'react';
import type { VendorStatus, AccountStatus } from '../types';

interface StatusBadgeProps {
  status: VendorStatus | AccountStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  let badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
      badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case 'PENDING':
      badgeStyles = 'bg-amber-50 text-amber-700 border-amber-200';
      break;
    case 'REJECTED':
    case 'DISABLED':
      badgeStyles = 'bg-rose-50 text-rose-700 border-rose-200';
      break;
    default:
      badgeStyles = 'bg-slate-50 text-slate-700 border-slate-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyles} ${className}`}
    >
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-75" />
      {status}
    </span>
  );
};
