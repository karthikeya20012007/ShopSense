import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../api/errors';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

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
      const parsed = parseApiError(
        err,
        'Failed to sign in. Please verify your credentials.'
      );
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-6">
        <Card className="border-slate-200/80 shadow-md">
          <CardContent className="p-8 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto shadow-md shadow-sky-600/20">
                S
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Sign in to ShopSense
              </h2>
              <p className="text-xs text-slate-500">
                Enterprise Commerce & Smart Sensor Marketplace
              </p>
            </div>

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <form id="login-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                label="Email Address"
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
              />

              <Input
                label="Password"
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-2.5"
                  disabled={loading}
                  isLoading={loading}
                >
                  Sign In
                </Button>
              </div>
            </form>

            <div className="pt-4 border-t border-slate-100 text-center space-y-2">
              <p className="text-xs text-slate-500">
                Need an account?{' '}
                <Link to="/register/customer" className="font-semibold text-sky-600 hover:text-sky-700 hover:underline">
                  Register as Customer
                </Link>
              </p>
              <p className="text-xs text-slate-500">
                Want to sell products?{' '}
                <Link to="/register/vendor" className="font-semibold text-sky-600 hover:text-sky-700 hover:underline">
                  Apply as Vendor
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
