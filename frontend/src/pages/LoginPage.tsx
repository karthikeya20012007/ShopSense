import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success message passed from registration page
  const successMessage = (location.state as any)?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const user = await login(email, password);

      // Role-based post-login navigation
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'VENDOR') {
        if (user.vendor_profile?.status === 'APPROVED') {
          navigate('/vendor/dashboard');
        } else {
          navigate('/vendor/onboarding-status');
        }
      } else {
        // Customer
        const destination = (location.state as any)?.from?.pathname || '/products';
        navigate(destination);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Failed to sign in. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center">
          <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3 shadow-sm">
            S
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sign in to ShopSense
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Access your customer, vendor, or administration account
          </p>
        </div>

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs font-medium">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center space-y-2">
          <p className="text-xs text-slate-500">
            Need an account?{' '}
            <Link to="/register/customer" className="font-semibold text-sky-600 hover:underline">
              Register as Customer
            </Link>
          </p>
          <p className="text-xs text-slate-500">
            Want to sell products?{' '}
            <Link to="/register/vendor" className="font-semibold text-sky-600 hover:underline">
              Apply as Vendor
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
