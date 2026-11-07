import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Column 1: Marketplace Brand & Architecture */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-base shadow-xs">
                S
              </div>
              <span className="text-base font-extrabold text-slate-900 tracking-tight">
                Shop<span className="text-blue-600">Sense</span>
              </span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Multi-vendor B2B platform engineered for commercial retail hardware, sensing systems, and smart electronic shelf integration.
            </p>
            <div className="text-[11px] text-slate-400 space-y-1 pt-1">
              <p>&bull; Direct INR (₹) Invoicing</p>
              <p>&bull; PostgreSQL Row-Level Stock Reservation</p>
              <p>&bull; Verified Vendor Onboarding Workflow</p>
            </div>
          </div>

          {/* Column 2: Commercial Product Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Retail Hardware
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/products?category=Barcode%20%26%20QR%20Scanners" className="hover:text-blue-600 transition-colors">
                  Barcode & QR Scanners
                </Link>
              </li>
              <li>
                <Link to="/products?category=RFID%20Tags%20%26%20Smart%20Readers" className="hover:text-blue-600 transition-colors">
                  RFID & Smart Readers
                </Link>
              </li>
              <li>
                <Link to="/products?category=Electronic%20Shelf%20Labels%20(ESL)" className="hover:text-blue-600 transition-colors">
                  Electronic Shelf Labels (ESL)
                </Link>
              </li>
              <li>
                <Link to="/products?category=Point%20of%20Sale%20(POS)%20Terminals" className="hover:text-blue-600 transition-colors">
                  Point of Sale (POS) Terminals
                </Link>
              </li>
              <li>
                <Link to="/products?category=Footfall%20%26%20Customer%20Tracking" className="hover:text-blue-600 transition-colors">
                  Footfall & Tracking Nodes
                </Link>
              </li>
              <li>
                <Link to="/products?category=Inventory%20Counting%20Scales" className="hover:text-blue-600 transition-colors">
                  Inventory Counting Scales
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Seller Operations & Procurement */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Procurement & Sellers
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/products" className="hover:text-blue-600 transition-colors">
                  Browse Full Catalog
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-blue-600 transition-colors">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link to="/register/vendor" className="hover:text-blue-600 transition-colors font-semibold text-blue-600">
                  Apply as a Marketplace Vendor &rarr;
                </Link>
              </li>
              <li>
                <Link to="/vendor/onboarding-status" className="hover:text-blue-600 transition-colors">
                  Vendor Onboarding Status
                </Link>
              </li>
              <li>
                <Link to="/register/customer" className="hover:text-blue-600 transition-colors">
                  Customer Registration
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 transition-colors">
                  Sign In to Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Platform Operations & Administration */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Platform & Governance
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/orders" className="hover:text-blue-600 transition-colors">
                  Order History & Tracking
                </Link>
              </li>
              <li>
                <Link to="/my-segment" className="hover:text-blue-600 transition-colors">
                  Customer Tier & Perks
                </Link>
              </li>
              <li>
                <Link to="/vendor/dashboard" className="hover:text-blue-600 transition-colors">
                  Vendor Operations Portal
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-blue-600 transition-colors">
                  Admin Governance Console
                </Link>
              </li>
            </ul>
            <div className="pt-2 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-700">Platform Status:</span> Operational
            </div>
          </div>
        </div>

        {/* Bottom Sub-footer */}
        <div className="pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-500 text-[11px]">
          <div>
            &copy; {new Date().getFullYear()} ShopSense Marketplace. All commercial rights reserved.
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/products" className="hover:text-slate-900">Hardware Catalog</Link>
            <span>&bull;</span>
            <Link to="/cart" className="hover:text-slate-900">Procurement Cart</Link>
            <span>&bull;</span>
            <Link to="/login" className="hover:text-slate-900">Portal Access</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
