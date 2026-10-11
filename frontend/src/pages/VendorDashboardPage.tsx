import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { VendorProfile, Product } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const VendorDashboardPage: React.FC = () => {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New product form modal/state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Hardware',
    sku: '',
    stock_quantity: 10,
    is_published: true,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadVendorData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, productsRes] = await Promise.all([
        apiClient.get<VendorProfile>('/vendors/me/profile'),
        apiClient.get<Product[]>('/vendors/me/products'),
      ]);

      setProfile(profileRes.data);
      setProducts(productsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load vendor dashboard details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendorData();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.title.trim() || !newProduct.price) {
      setCreateError('Title and Price are required.');
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError(null);

      await apiClient.post('/vendors/me/products', {
        ...newProduct,
        price: parseFloat(newProduct.price),
      });

      setShowAddModal(false);
      setNewProduct({
        title: '',
        description: '',
        price: '',
        category: 'Hardware',
        sku: '',
        stock_quantity: 10,
        is_published: true,
      });

      // Reload products list
      const productsRes = await apiClient.get<Product[]>('/vendors/me/products');
      setProducts(productsRes.data);
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Failed to create product.');
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading vendor operations...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
          <p className="text-sm font-semibold mb-2">Vendor Access Error</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Vendor Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{profile.store_name}</h1>
            <StatusBadge status={profile.status} />
          </div>
          <p className="text-xs text-slate-500">
            Store ID: <span className="font-mono text-slate-700">{profile.id}</span> • Contact:{' '}
            <span className="text-slate-700">{profile.business_email || 'Not specified'}</span>
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
        >
          + Add New Product
        </button>
      </div>

      {/* Store Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
          Store Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-400 block mb-1">HQ Address:</span>
            <p className="text-slate-800">{profile.business_address || 'Not specified'}</p>
          </div>
          <div>
            <span className="font-semibold text-slate-400 block mb-1">Phone Contact:</span>
            <p className="text-slate-800">{profile.business_phone || 'Not specified'}</p>
          </div>
          <div>
            <span className="font-semibold text-slate-400 block mb-1">Business Description:</span>
            <p className="text-slate-800 leading-relaxed">
              {profile.business_description || 'No store description provided.'}
            </p>
          </div>
        </div>
      </div>

      {/* Vendor Product Catalog */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Store Products</h2>
            <p className="text-xs text-slate-500">
              Manage items published to the ShopSense public catalog
            </p>
          </div>
          <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
            {products.length} Products
          </span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
            <span className="text-3xl block mb-2">🏷️</span>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">No products added yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Click the button below to publish your first device or accessory.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700"
            >
              + Create First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ${typeof p.price === 'number' ? p.price.toFixed(2) : parseFloat(p.price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.stock_quantity} units</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          p.is_published
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {p.is_published ? 'Published' : 'Draft / Unpublished'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Product</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                  placeholder="e.g. Ultra-Wide RFID Shelf Portal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="199.99"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Sensors">Sensors</option>
                    <option value="POS Accessories">POS Accessories</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Software">Software</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU / Model Code</label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="e.g. RFID-PORT-900"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Stock Units</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.stock_quantity}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, stock_quantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Key features, compatibility, specs..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_published"
                  checked={newProduct.is_published}
                  onChange={(e) => setNewProduct({ ...newProduct, is_published: e.target.checked })}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="is_published" className="font-semibold text-slate-700">
                  Publish immediately to Public Catalog
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50"
                >
                  {createLoading ? 'Publishing...' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
