import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { parseApiError } from '../api/errors';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

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
      <div className="max-w-xl w-full space-y-6">
        <Card className="border-slate-200/80 shadow-md">
          <CardContent className="p-8 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100">
                Vendor Onboarding
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Apply to Sell on ShopSense
              </h2>
              <p className="text-xs text-slate-500">
                Submit your store details to join our retail analytics and hardware ecosystem
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-medium space-y-1"
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

            <form id="vendor-register-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  1. Account Credentials
                </h3>
                <div className="space-y-3">
                  <Input
                    label="Applicant Full Name *"
                    id="vendor-fullname"
                    type="text"
                    name="full_name"
                    autoComplete="name"
                    required
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="e.g. Robert Vance"
                    error={fieldErrors.full_name}
                  />

                  <Input
                    label="Login Email *"
                    id="vendor-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="robert@store.com"
                    error={fieldErrors.email}
                  />

                  <Input
                    label="Password (min. 8 characters) *"
                    id="vendor-password"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    error={fieldErrors.password}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  2. Store & Business Information
                </h3>
                <div className="space-y-3">
                  <Input
                    label="Store / Business Name *"
                    id="vendor-storename"
                    type="text"
                    name="store_name"
                    autoComplete="organization"
                    required
                    value={formData.store_name}
                    onChange={handleChange}
                    placeholder="e.g. Vance Sensors & Analytics"
                    error={fieldErrors.store_name}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Business Email (Optional)"
                      id="vendor-business-email"
                      type="email"
                      name="business_email"
                      autoComplete="off"
                      value={formData.business_email}
                      onChange={handleChange}
                      placeholder="sales@vance.com"
                      error={fieldErrors.business_email}
                    />

                    <Input
                      label="Business Phone (Optional)"
                      id="vendor-business-phone"
                      type="tel"
                      name="business_phone"
                      autoComplete="tel"
                      value={formData.business_phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 345-6789"
                      error={fieldErrors.business_phone}
                    />
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

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-2.5"
                  disabled={loading}
                  isLoading={loading}
                >
                  Submit Vendor Application
                </Button>
              </div>
            </form>

            <div className="pt-3 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Already applied?{' '}
                <Link to="/login" className="font-semibold text-sky-600 hover:text-sky-700 hover:underline">
                  Sign In to Check Status
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
