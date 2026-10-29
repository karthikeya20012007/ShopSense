import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { parseApiError } from '../api/errors';

export const VendorRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    store_name: '',
    business_email: '',
    business_phone: '',
    business_address: '',
    business_description: '',
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
    if (!formData.store_name.trim()) {
      errors.store_name = 'Store name is required.';
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
        store_name: formData.store_name.trim(),
        business_email: formData.business_email.trim() || undefined,
        business_phone: formData.business_phone.trim() || undefined,
        business_address: formData.business_address.trim() || undefined,
        business_description: formData.business_description.trim() || undefined,
      };

      await apiClient.post('/auth/register/vendor', payload);

      navigate('/login', {
        state: {
          message:
            'Vendor registration submitted! Your application is in PENDING status. Please sign in to monitor your onboarding progress.',
        },
      });
    } catch (err: any) {
      const parsed = parseApiError(
        err,
        'Failed to submit vendor registration. Please review the details and try again.'
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
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100 mb-2">
            Vendor Onboarding
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Apply to Sell on ShopSense
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Submit your store details to join our retail analytics and hardware ecosystem
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

        <form id="vendor-register-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              1. Account Credentials
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="vendor-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                  Applicant Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="vendor-fullname"
                  type="text"
                  name="full_name"
                  autoComplete="name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Robert Vance"
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
                <label htmlFor="vendor-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Login Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="vendor-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="robert@store.com"
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
                <label htmlFor="vendor-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (min. 8 characters) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="vendor-password"
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
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              2. Store & Business Information
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="vendor-storename" className="block text-xs font-semibold text-slate-700 mb-1">
                  Store / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="vendor-storename"
                  type="text"
                  name="store_name"
                  autoComplete="organization"
                  required
                  value={formData.store_name}
                  onChange={handleChange}
                  placeholder="e.g. Vance Sensors & Analytics"
                  className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                    fieldErrors.store_name
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
                  }`}
                />
                {fieldErrors.store_name && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.store_name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="vendor-business-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Email (Optional)
                  </label>
                  <input
                    id="vendor-business-email"
                    type="email"
                    name="business_email"
                    autoComplete="off"
                    value={formData.business_email}
                    onChange={handleChange}
                    placeholder="sales@vance.com"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                      fieldErrors.business_email
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
                    }`}
                  />
                  {fieldErrors.business_email && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.business_email}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="vendor-business-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Phone (Optional)
                  </label>
                  <input
                    id="vendor-business-phone"
                    type="tel"
                    name="business_phone"
                    autoComplete="tel"
                    value={formData.business_phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 345-6789"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                      fieldErrors.business_phone
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
                    }`}
                  />
                  {fieldErrors.business_phone && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.business_phone}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="vendor-business-address" className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Headquarters / Physical Address (Optional)
                </label>
                <textarea
                  id="vendor-business-address"
                  name="business_address"
                  autoComplete="street-address"
                  rows={2}
                  value={formData.business_address}
                  onChange={handleChange}
                  placeholder="100 Tech Blvd, Suite 200, Austin, TX"
                  className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                    fieldErrors.business_address
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
                  }`}
                />
                {fieldErrors.business_address && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {fieldErrors.business_address}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="vendor-business-description" className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Description / Catalog Category (Optional)
                </label>
                <textarea
                  id="vendor-business-description"
                  name="business_description"
                  autoComplete="off"
                  rows={2}
                  value={formData.business_description}
                  onChange={handleChange}
                  placeholder="Describe your retail analytics hardware, scanners, or IoT devices..."
                  className={`w-full px-3.5 py-2 text-sm rounded-lg border focus:outline-none text-slate-900 bg-white ${
                    fieldErrors.business_description
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-sky-500'
                  }`}
                />
                {fieldErrors.business_description && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {fieldErrors.business_description}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Submitting Application...' : 'Submit Vendor Application'}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Already applied?{' '}
            <Link to="/login" className="font-semibold text-sky-600 hover:underline">
              Sign In to Check Status
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
