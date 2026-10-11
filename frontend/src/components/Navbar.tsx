import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './StatusBadge';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
                S
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Shop<span className="text-sky-600">Sense</span>
              </span>
            </Link>

            <nav className="hidden md:flex space-x-6 text-sm font-medium">
              <Link
                to="/products"
                className="text-slate-600 hover:text-sky-600 transition-colors"
              >
                Product Catalog
              </Link>

              {user?.role === 'VENDOR' && (
                <>
                  <Link
                    to="/vendor/onboarding-status"
                    className="text-slate-600 hover:text-sky-600 transition-colors"
                  >
                    Onboarding Status
                  </Link>
                  {user.vendor_profile?.status === 'APPROVED' && (
                    <Link
                      to="/vendor/dashboard"
                      className="text-slate-600 hover:text-sky-600 transition-colors"
                    >
                      Vendor Dashboard
                    </Link>
                  )}
                </>
              )}

              {user?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className="text-slate-600 hover:text-sky-600 transition-colors font-semibold"
                >
                  Admin Console
                </Link>
              )}
            </nav>
          </div>

          {/* User actions */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800">{user.full_name}</div>
                  <div className="flex items-center space-x-1.5 justify-end">
                    <StatusBadge status={user.role} />
                    {user.vendor_profile && (
                      <StatusBadge status={user.vendor_profile.status} />
                    )}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register/customer"
                  className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-sm"
                >
                  Register
                </Link>
                <Link
                  to="/register/vendor"
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Become a Vendor
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
