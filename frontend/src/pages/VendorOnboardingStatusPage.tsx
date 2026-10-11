import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import type { VendorOnboardingStatusResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const VendorOnboardingStatusPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [statusData, setStatusData] = useState<VendorOnboardingStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<VendorOnboardingStatusResponse>(
        '/vendors/me/onboarding-status'
      );
      setStatusData(res.data);
      // Refresh current user in AuthContext so badges and status are synchronized
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to retrieve onboarding status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Checking onboarding status...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vendor Application Status</h1>
            <p className="text-xs text-slate-500 mt-1">
              Store Account: <span className="font-semibold text-slate-800">{statusData?.store_name}</span>
            </p>
          </div>
          {statusData && <StatusBadge status={statusData.status} className="text-sm px-3 py-1" />}
        </div>

        {error ? (
          <div className="mt-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-medium">
            {error}
          </div>
        ) : statusData ? (
          <div className="mt-6 space-y-6">
            {/* Status-specific banner */}
            {statusData.status === 'PENDING' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start space-x-4">
                <span className="text-3xl text-amber-500">⏳</span>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 mb-1">
                    Application Under Administrative Review
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed mb-3">
                    {statusData.message}
                  </p>
                  <p className="text-xs text-amber-700 italic">
                    Note: Access to the vendor product management dashboard will automatically unlock once an administrator approves your store.
                  </p>
                </div>
              </div>
            )}

            {statusData.status === 'APPROVED' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start space-x-4">
                <span className="text-3xl text-emerald-500">🎉</span>
                <div>
                  <h3 className="text-sm font-bold text-emerald-900 mb-1">
                    Store Application Approved!
                  </h3>
                  <p className="text-xs text-emerald-800 leading-relaxed mb-4">
                    {statusData.message}
                  </p>
                  <button
                    onClick={() => navigate('/vendor/dashboard')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    Go to Vendor Dashboard →
                  </button>
                </div>
              </div>
            )}

            {statusData.status === 'REJECTED' && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start space-x-4">
                <span className="text-3xl text-rose-500">🛑</span>
                <div>
                  <h3 className="text-sm font-bold text-rose-900 mb-1">
                    Application Not Approved
                  </h3>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    {statusData.message}
                  </p>
                </div>
              </div>
            )}

            {/* Application Summary Card */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                Application Record
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                <div>
                  <span className="text-slate-400 block font-medium">Vendor ID:</span>
                  <span className="font-mono text-slate-700 break-all">{statusData.vendor_id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Applicant Account:</span>
                  <span className="text-slate-700">{user?.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Submitted Date:</span>
                  <span className="text-slate-700">
                    {new Date(statusData.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Current Authorization:</span>
                  <span className="font-semibold text-slate-700">{statusData.status}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                onClick={fetchStatus}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                🔄 Refresh Status
              </button>

              <Link
                to="/products"
                className="text-xs font-semibold text-sky-600 hover:text-sky-800"
              >
                Browse Public Catalog
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
