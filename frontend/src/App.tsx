import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './components/ui/Toast';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

import { HomePage } from './pages/HomePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { LoginPage } from './pages/LoginPage';
import { CustomerRegisterPage } from './pages/CustomerRegisterPage';
import { VendorRegisterPage } from './pages/VendorRegisterPage';
import { VendorOnboardingStatusPage } from './pages/VendorOnboardingStatusPage';
import { VendorDashboardPage } from './pages/VendorDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CustomerSegmentPage } from './pages/CustomerSegmentPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <BrowserRouter>
          <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            <Navbar />

            <main className="flex-1">
              <Routes>
                {/* Public Catalog and Cart Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<HomePage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register/customer" element={<CustomerRegisterPage />} />
                <Route path="/register/vendor" element={<VendorRegisterPage />} />

                {/* Customer Routes */}
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute roles={['CUSTOMER']}>
                      <OrderHistoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-segment"
                  element={
                    <ProtectedRoute roles={['CUSTOMER']}>
                      <CustomerSegmentPage />
                    </ProtectedRoute>
                  }
                />

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

            <Footer />
          </div>
        </BrowserRouter>
      </ToastProvider>
    </CartProvider>
  </AuthProvider>
  );
};

export default App;
