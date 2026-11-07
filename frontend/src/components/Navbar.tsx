import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { StatusBadge } from './StatusBadge';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems, resetCartOnLogout } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    resetCartOnLogout();
    await logout();
    navigate('/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/products');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
      {/* Top Utility Notice Bar */}
      <div className="bg-slate-50 text-slate-500 text-[11px] py-1 px-4 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto flex justify-between items-center font-medium">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="text-slate-700 font-semibold">ShopSense B2B</span>
            <span className="text-slate-400">|</span>
            <span>Commercial Electronics & Retail Technology Marketplace</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-500">
            <span>Direct Vendor Invoicing</span>
            <span className="text-slate-300">•</span>
            <span>Transactional Inventory Allocation</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-4 sm:gap-6">
          {/* LEFT: ShopSense Logo & Brand Identity */}
          <Link to="/" className="flex items-center space-x-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-xs group-hover:bg-blue-700 transition-colors">
              S
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">
                Shop<span className="text-blue-600">Sense</span>
              </span>
              <span className="text-[10px] tracking-wider uppercase font-semibold text-slate-500 mt-0.5">
                Commercial Tech
              </span>
            </div>
          </Link>

          {/* CENTER: One Prominent Catalog Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-2xl relative hidden md:block"
          >
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 text-sm pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search barcode scanners, RFID readers, POS terminals, sensors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm rounded-lg pl-10 pr-20 py-2 border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* RIGHT: Primary Navigation Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Catalog Link */}
            <Link
              to="/products"
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                isActive('/products') || isActive('/')
                  ? 'text-blue-600 bg-blue-50/80'
                  : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              Catalog
            </Link>

            {/* Role-Specific Navigation Links */}
            {user?.role === 'CUSTOMER' && (
              <>
                <Link
                  to="/orders"
                  className={`hidden lg:inline-block px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                    isActive('/orders')
                      ? 'text-blue-600 bg-blue-50/80'
                      : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                  }`}
                >
                  My Orders
                </Link>
                <Link
                  to="/my-segment"
                  className={`hidden lg:inline-block px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                    isActive('/my-segment')
                      ? 'text-blue-600 bg-blue-50/80'
                      : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                  }`}
                >
                  Tier & Perks
                </Link>
              </>
            )}

            {user?.role === 'VENDOR' && (
              <>
                <Link
                  to="/vendor/onboarding-status"
                  className={`hidden lg:inline-block px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                    isActive('/vendor/onboarding-status')
                      ? 'text-blue-600 bg-blue-50/80'
                      : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                  }`}
                >
                  Status
                </Link>
                {user.vendor_profile?.status === 'APPROVED' && (
                  <Link
                    to="/vendor/dashboard"
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-2xs transition-colors"
                  >
                    Vendor Portal
                  </Link>
                )}
              </>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-colors"
              >
                Admin Console
              </Link>
            )}

            {/* Shopping Cart Button */}
            <Link
              to="/cart"
              className="relative p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200/90 shadow-2xs"
              title="Shopping Cart"
            >
              <span className="text-base">🛒</span>
              <span className="hidden sm:inline text-xs font-bold text-slate-800">Cart</span>
              {totalItems > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-xs">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            {/* User Session or Guest Actions */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="text-right hidden xl:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                    {user.full_name}
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <StatusBadge status={user.role} size="sm" />
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <Link
                  to="/login"
                  className="text-xs font-bold text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register/customer"
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors"
                >
                  Register
                </Link>
                <Link
                  to="/register/vendor"
                  className="hidden sm:inline-block px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Become a Vendor
                </Link>
              </div>
            )}

            {/* Mobile Navigation Drawer Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Toggle navigation drawer"
            >
              <span className="text-lg font-bold">☰</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar in Header when collapsed */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <span className="absolute left-3 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search catalog products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-slate-900 placeholder:text-slate-400 text-xs rounded-lg pl-8 pr-16 py-2 border border-slate-300 focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="absolute right-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-md"
            >
              Go
            </button>
          </form>
        </div>

        {/* Mobile Responsive Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 py-3 space-y-2 text-xs font-semibold bg-white">
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
              <>
                <Link
                  to="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  My Orders
                </Link>
                <Link
                  to="/my-segment"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  Tier & Perks
                </Link>
              </>
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
                    className="block px-3 py-2 text-blue-600 font-bold bg-blue-50 rounded-lg"
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
                className="block px-3 py-2 text-slate-900 font-bold bg-slate-100 rounded-lg"
              >
                Admin Governance Console
              </Link>
            )}

            {!isAuthenticated && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  Sign In
                </Link>
                <Link
                  to="/register/customer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-blue-600 font-bold hover:bg-blue-50 rounded-lg"
                >
                  Create Customer Account
                </Link>
                <Link
                  to="/register/vendor"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Apply as a Vendor
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
