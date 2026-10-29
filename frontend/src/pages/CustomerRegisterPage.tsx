import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { parseApiError } from '../api/errors';

export const CustomerRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    shipping_address: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear specific field error when the user edits that field
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    // Also clear top-level banner error on user input
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters in length.';
    }
    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required.';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(Object.values(errors).join(' '));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setFieldErrors({});

      // Sanitize optional fields to avoid sending empty strings
      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone_number: formData.phone_number.trim() || undefined,
        shipping_address: formData.shipping_address.trim() || undefined,
      };

      await apiClient.post('/auth/register/customer', payload);

      navigate('/login', {
        state: { message: 'Customer registration successful! Please log in with your credentials.' },
      });
    } catch (err: any) {
      const parsed = parseApiError(
        err,
        'Registration failed. Please review your submission and try again.'
      );

      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);

      // Keep entered non-sensitive form data available, but clear password for security
      setFormData((prev) => ({
        ...prev,
        password: '',
      }));
    } finally {
      setLoading(false);
    }
  };

  const isDuplicateEmail =
    error?.toLowerCase().includes('already exists') ||
    fieldErrors.email?.toLowerCase().includes('already exists');

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create Customer Account</h2>
          <p className="mt-1 text-xs text-slate-500">
            Sign up to browse, track orders, and interact with the catalog
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-xs font-medium space-y-1"
          >
            <div>{error}</div>
            {isDuplicateEmail && (
              <div className="pt-1 text-rose-800">
                Already registered?{' '}
                <Link to="/login" className="font-semibold underline hover:text-rose-950">
                  Sign in to your account
                </Link>
              </div>
            )}
          </div>
        )}

        <form id="customer-register-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="customer-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="customer-fullname"
              type="text"
              name="full_name"
              autoComplete="name"
              required
              value={formData.full_name}
              onChange={handleChange}
              placeholder="Alice Johnson"
              className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                fieldErrors.full_name
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
              }`}
            />
            {fieldErrors.full_name && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.full_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="customer-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              id="customer-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="alice@example.com"
              className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                fieldErrors.email
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
              }`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="customer-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password (min. 8 characters) <span className="text-rose-500">*</span>
            </label>
            <input
              id="customer-password"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                fieldErrors.password
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
              }`}
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="customer-phone" className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Phone (Optional)
            </label>
            <input
              id="customer-phone"
              type="tel"
              name="phone_number"
              autoComplete="tel"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="+1 (555) 012-3456"
              className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                fieldErrors.phone_number
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
              }`}
            />
            {fieldErrors.phone_number && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.phone_number}</p>
            )}
          </div>

          <div>
            <label htmlFor="customer-address" className="block text-xs font-semibold text-slate-700 mb-1">
              Shipping Address (Optional)
            </label>
            <textarea
              id="customer-address"
              name="shipping_address"
              autoComplete="street-address"
              rows={2}
              value={formData.shipping_address}
              onChange={handleChange}
              placeholder="123 Shopping Way, City, State, ZIP"
              className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                fieldErrors.shipping_address
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
              }`}
            />
            {fieldErrors.shipping_address && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.shipping_address}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Complete Customer Registration'}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-sky-600 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
