'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CatalogTemplate } from '@/lib/types';

export default function AdminCatalogPage() {
  const [items, setItems] = useState<CatalogTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [category, setCategory] = useState('CMS');
  const [yaml, setYaml] = useState('version: "3.8"\nservices:\n  app:\n    image: nginx:alpine');

  function loadCatalog() {
    setLoading(true);
    api.catalog.list()
      .then((res) => setItems(res.templates))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadCatalog, []);

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    setCreating(true);

    try {
      await api.catalog.create(slug, {
        name: name.trim(),
        slogan: slogan.trim(),
        category,
        yaml,
      });
      setName('');
      setSlogan('');
      setShowAddModal(false);
      loadCatalog();
    } catch (err: any) {
      alert(`Failed to create template: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteTemplate(slug: string) {
    if (!confirm(`Are you sure you want to delete template '${slug}'?`)) return;
    try {
      await api.catalog.delete(slug);
      loadCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Admin Portal
            </span>
            <span className="text-xs text-text-faint">• Live Database</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">App Catalog Manager</h1>
          <p className="text-xs text-text-muted mt-1">
            Manage public storefront availability, create custom Docker Compose catalog templates, and modify template specs directly in the database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-xs font-bold text-white shadow-lg shadow-amber-500/25 transition-all"
          >
            + Create New Template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {error}
        </div>
      ) : (
        /* Catalog Items Table */
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-sm font-bold text-white">Catalog Library ({items.length} Templates)</h2>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.slug}
                className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📦</span>
                  <div>
                    <p className="text-xs font-bold text-white">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-amber-400 uppercase font-semibold">{item.category}</span>
                      <span className="text-[10px] text-text-muted font-mono">• {item.slug}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteTemplate(item.slug)}
                    className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Add Catalog Template
            </h3>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="Directus Headless CMS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Slogan / Description</label>
                <input
                  type="text"
                  placeholder="Open source data platform & headless CMS"
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#121324] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="CMS">CMS</option>
                  <option value="Database">Database</option>
                  <option value="Automation">Automation</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Monitoring">Monitoring</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Docker Compose YAML</label>
                <textarea
                  rows={4}
                  value={yaml}
                  onChange={(e) => setYaml(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-xs font-bold text-white shadow-lg shadow-amber-500/25 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
