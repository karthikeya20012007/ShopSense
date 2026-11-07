import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import type { VendorOnboardingStatusResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

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
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-4">
        <div className="h-64 rounded-3xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="border-slate-200/80 shadow-md overflow-hidden">
        <CardContent className="p-8 sm:p-10 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Vendor Application Status</h1>
              <p className="text-xs text-slate-500 mt-1">
                Store Account: <span className="font-semibold text-slate-800">{statusData?.store_name}</span>
              </p>
            </div>
            {statusData && <StatusBadge status={statusData.status} size="md" />}
          </div>

          {error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-medium">
              {error}
            </div>
          ) : statusData ? (
            <div className="space-y-6">
              {/* Status-specific banner */}
              {statusData.status === 'PENDING' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                  <span className="text-3xl">⏳</span>
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-amber-900">
                      Application Under Administrative Review
                    </h3>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {statusData.message}
                    </p>
                    <p className="text-xs text-amber-700 italic">
                      Note: Access to the vendor product management dashboard will automatically unlock once an administrator approves your store.
                    </p>
                  </div>
                </div>
              )}

              {statusData.status === 'APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-start gap-4">
                  <span className="text-3xl">🎉</span>
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-emerald-900">
                      Store Application Approved!
                    </h3>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      {statusData.message}
                    </p>
                    <Button
                      variant="success"
                      onClick={() => navigate('/vendor/dashboard')}
                      size="sm"
                    >
                      Go to Vendor Dashboard &rarr;
                    </Button>
                  </div>
                </div>
              )}

              {statusData.status === 'REJECTED' && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-4">
                  <span className="text-3xl">🛑</span>
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
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-xs space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
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
                <Button
                  variant="outline"
                  size="xs"
                  onClick={fetchStatus}
                >
                  🔄 Refresh Status
                </Button>

                <Link
                  to="/products"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                >
                  Browse Public Catalog
                </Link>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
