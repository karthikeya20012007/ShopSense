import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { HomePage } from './pages/HomePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { LoginPage } from './pages/LoginPage';
import { CustomerRegisterPage } from './pages/CustomerRegisterPage';
import { VendorRegisterPage } from './pages/VendorRegisterPage';
import { VendorOnboardingStatusPage } from './pages/VendorOnboardingStatusPage';
import { VendorDashboardPage } from './pages/VendorDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
          <Navbar />

          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<HomePage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register/customer" element={<CustomerRegisterPage />} />
              <Route path="/register/vendor" element={<VendorRegisterPage />} />

              {/* Vendor Routes */}
              <Route
                path="/vendor/onboarding-status"
                element={
                  <ProtectedRoute roles={['VENDOR']}>
                    <VendorOnboardingStatusPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/dashboard"
                element={
                  <ProtectedRoute roles={['VENDOR']} requireApprovedVendor={true}>
                    <VendorDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['ADMIN']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span>ShopSense Platform • Milestone 1 (Auth, Onboarding, Catalog Foundation)</span>
              <span>Secure Multi-Vendor Architecture</span>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
