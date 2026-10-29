import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { StatusBadge } from './StatusBadge';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems, resetCartOnLogout } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    resetCartOnLogout();
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-xl shadow-xs">
                S
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Shop<span className="text-sky-600">Sense</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-6 text-sm font-medium">
              <Link
                to="/products"
                className="text-slate-600 hover:text-sky-600 transition-colors"
              >
                Catalog
              </Link>

              {user?.role === 'CUSTOMER' && (
                <Link
                  to="/orders"
                  className="text-slate-600 hover:text-sky-600 transition-colors"
                >
                  My Orders
                </Link>
              )}

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
                      className="text-slate-600 hover:text-sky-600 transition-colors font-semibold"
                    >
                      Vendor Portal
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

          {/* Right Action Icons & Auth */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Cart Icon Link */}
            <Link
              to="/cart"
              className="relative p-2 text-slate-600 hover:text-sky-600 transition-colors rounded-lg hover:bg-slate-50 flex items-center"
              title="Shopping Cart"
            >
              <span className="text-xl">🛒</span>
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 bg-sky-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            {isAuthenticated && user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900">{user.full_name}</div>
                  <div className="flex items-center space-x-1.5 justify-end mt-0.5">
                    <StatusBadge status={user.role} />
                    {user.vendor_profile && (
                      <StatusBadge status={user.vendor_profile.status} />
                    )}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Link
                  to="/login"
                  className="text-xs sm:text-sm font-medium text-slate-700 hover:text-sky-600 transition-colors px-2 py-1"
                >
                  Sign In
                </Link>
                <Link
                  to="/register/customer"
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
                >
                  Register
                </Link>
                <Link
                  to="/register/vendor"
                  className="hidden sm:inline-block px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Become Vendor
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <span className="text-lg font-bold">☰</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-2 text-xs font-medium">
            <Link
              to="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              Product Catalog
            </Link>
            <Link
              to="/cart"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              Shopping Cart ({totalItems})
            </Link>
            {user?.role === 'CUSTOMER' && (
              <Link
                to="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                My Orders
              </Link>
            )}
            {user?.role === 'VENDOR' && (
              <>
                <Link
                  to="/vendor/onboarding-status"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  Onboarding Status
                </Link>
                {user.vendor_profile?.status === 'APPROVED' && (
                  <Link
                    to="/vendor/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sky-700 font-bold hover:bg-slate-50 rounded-lg"
                  >
                    Vendor Portal
                  </Link>
                )}
              </>
            )}
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sky-700 font-bold hover:bg-slate-50 rounded-lg"
              >
                Admin Console
              </Link>
            )}
            {!isAuthenticated && (
              <Link
                to="/register/vendor"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Become a Vendor
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
