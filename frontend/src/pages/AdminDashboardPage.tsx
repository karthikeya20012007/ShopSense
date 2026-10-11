import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { VendorProfile } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const AdminDashboardPage: React.FC = () => {
  const [pendingVendors, setPendingVendors] = useState<VendorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPendingVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<VendorProfile[]>('/admin/vendors/pending');
      setPendingVendors(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch pending vendor applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingVendors();
  }, []);

  const handleStatusUpdate = async (vendorId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setActionLoadingId(vendorId);
      setActionMessage(null);

      const res = await apiClient.patch(`/admin/vendors/${vendorId}/status`, { status });
      const updatedStoreName = res.data.store_name;

      setActionMessage({
        type: 'success',
        text: `Application for "${updatedStoreName}" has been successfully marked as ${status}.`,
      });

      // Remove from pending list
      setPendingVendors((prev) => prev.filter((v) => v.id !== vendorId));
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text:
          err.response?.data?.detail ||
          `Failed to update application status to ${status}.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Admin Shell Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-2xl font-bold text-slate-900">Administration Console</h1>
            </div>
            <p className="text-xs text-slate-500">
              Manage marketplace multi-vendor governance and verify store onboarding submissions
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchPendingVendors}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              🔄 Refresh List
            </button>
          </div>
        </div>

        {/* Platform Stat Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Pending Review</span>
            <span className="text-2xl font-bold text-amber-600">{pendingVendors.length}</span>
            <span className="text-slate-500 block text-[11px] mt-0.5">Awaiting decision</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Onboarding Policy</span>
            <span className="text-sm font-bold text-slate-800 block mt-1">Manual Verification</span>
            <span className="text-slate-500 text-[11px]">ADMIN authorization required</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 block font-medium">Access Control</span>
            <span className="text-sm font-bold text-slate-800 block mt-1">Role & State Enforced</span>
            <span className="text-slate-500 text-[11px]">Strict backend authorization</span>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Pending Vendor Applications List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Pending Vendor Applications
            </h2>
            <p className="text-xs text-slate-500">
              Review store details and authorize access to vendor operations
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {pendingVendors.length} Applications Pending
          </span>
        </div>

        {loading ? (
          <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading applications...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-xl text-center text-xs">
            {error}
          </div>
        ) : pendingVendors.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl">
            <span className="text-4xl block mb-2">✅</span>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Queue is clear!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are currently no vendor onboarding applications awaiting administrative review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingVendors.map((vendor) => {
              const isActionInProgress = actionLoadingId === vendor.id;

              return (
                <div
                  key={vendor.id}
                  className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors bg-white shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {vendor.store_name}
                        </h3>
                        <StatusBadge status={vendor.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Applicant:{' '}
                        <span className="font-semibold text-slate-800">
                          {vendor.applicant_name || 'N/A'}
                        </span>{' '}
                        ({vendor.applicant_email || vendor.business_email || 'No email'}) • Submitted:{' '}
                        {new Date(vendor.created_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleStatusUpdate(vendor.id, 'APPROVED')}
                        disabled={isActionInProgress}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center space-x-1"
                      >
                        <span>✓</span>
                        <span>{isActionInProgress ? 'Updating...' : 'Approve Application'}</span>
                      </button>

                      <button
                        onClick={() => handleStatusUpdate(vendor.id, 'REJECTED')}
                        disabled={isActionInProgress}
                        className="px-3.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition-colors disabled:opacity-50 flex items-center space-x-1"
                      >
                        <span>✕</span>
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable Application Specs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs text-slate-600">
                    <div>
                      <span className="font-bold text-slate-400 block uppercase text-[10px] mb-0.5">
                        Business Phone:
                      </span>
                      <span className="text-slate-800 font-medium">
                        {vendor.business_phone || 'None provided'}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 block uppercase text-[10px] mb-0.5">
                        Registered Address:
                      </span>
                      <span className="text-slate-800 font-medium">
                        {vendor.business_address || 'None provided'}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 block uppercase text-[10px] mb-0.5">
                        Business Description:
                      </span>
                      <span className="text-slate-800 font-medium">
                        {vendor.business_description || 'No description entered.'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
