import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  roles?: UserRole[];
  requireApprovedVendor?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  roles,
  requireApprovedVendor = false,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization
  if (roles && !roles.includes(user.role)) {
    // Redirect to default view for their actual role
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'VENDOR') return <Navigate to="/vendor/onboarding-status" replace />;
    return <Navigate to="/products" replace />;
  }

  // Check vendor approval requirement
  if (requireApprovedVendor) {
    if (user.role !== 'VENDOR') {
      return <Navigate to="/products" replace />;
    }
    if (user.vendor_profile?.status !== 'APPROVED') {
      return <Navigate to="/vendor/onboarding-status" replace />;
    }
  }

  return children;
};
