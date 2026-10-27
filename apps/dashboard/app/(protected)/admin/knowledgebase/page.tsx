'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { KbArticle, KbTargetRole } from '@/lib/types';
import { Card, Button, Spinner, PageHeader, useToast } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function AdminKnowledgeBasePage() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<KbTargetRole | 'ALL'>('ALL');
  
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('deployments');
  const [targetRole, setTargetRole] = useState<KbTargetRole>('customer');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  async function loadArticles() {
    setLoading(true);
    try {
      const data = await api.knowledgebase.list('all', '', filterRole === 'ALL' ? undefined : filterRole, true);
      setArticles(data.articles || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load admin articles', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArticles();
  }, [filterRole]);

  function openCreateModal() {
    setEditingArticle(null);
    setTitle('');
    setCategory('deployments');
    setTargetRole('customer');
    setSummary('');
    setContent('');
    setPublished(true);
    setShowModal(true);
  }

  function openEditModal(article: KbArticle) {
    setEditingArticle(article);
    setTitle(article.title);
    setCategory(article.category);
    setTargetRole(article.targetRole || 'customer');
    setSummary(article.summary);
    setContent(article.content);
    setPublished(article.published);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingArticle) {
        await api.knowledgebase.updateArticle(editingArticle.id, {
          title,
          category,
          targetRole,
          summary,
          content,
          published,
        });
        toast('Article updated successfully!', 'success');
      } else {
        await api.knowledgebase.createArticle({
          title,
          category,
          targetRole,
          summary,
          content,
          published,
        });
        toast('Article created successfully!', 'success');
      }
      setShowModal(false);
      loadArticles();
    } catch (err: any) {
      toast(err.message || 'Failed to save article', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(articleId: string, articleTitle: string) {
    if (!window.confirm(`Delete article "${articleTitle}"?`)) return;
    try {
      await api.knowledgebase.deleteArticle(articleId);
      toast('Article deleted.', 'success');
      loadArticles();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Admin Knowledge Base & Documentation Manager"
          description="Create, edit, target by user persona role, publish, and maintain platform documentation articles across all workspaces."
        />
        <Button
          onClick={openCreateModal}
          className="bg-white text-black hover:bg-neutral-200 font-bold shadow-md"
        >
          + New Documentation Article
        </Button>
      </div>

      {/* Role Filter Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Target Role Persona:</span>
          {(['ALL', 'customer', 'support', 'dev', 'admin', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                filterRole === r
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={loadArticles}>
          Refresh List
        </Button>
      </div>

      <Card className="border border-white/10 bg-[#0c0d12] shadow-xl">
        {loading ? (
          <div className="py-12 text-center"><Spinner label="Loading article repository..." /></div>
        ) : articles.length === 0 ? (
          <p className="text-xs text-neutral-500 italic text-center py-8">No articles found matching role filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/5 text-neutral-400 border-b border-white/10 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Target Persona</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Helpful</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {articles.map((art) => (
                  <tr key={art.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-sans font-semibold text-white max-w-xs truncate">{art.title}</td>
                    <td className="p-3 uppercase text-[10px] text-neutral-300 font-bold">{art.category}</td>
                    <td className="p-3 uppercase text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        art.targetRole === 'dev'
                          ? 'bg-white/10 text-white border border-white/10'
                          : art.targetRole === 'support'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : art.targetRole === 'admin'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {art.targetRole || 'customer'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${art.published ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-700 text-neutral-300'}`}>
                        {art.published ? 'PUBLISHED' : 'DRAFT'}
                      </span>
                    </td>
                    <td className="p-3 text-neutral-400">{art.views}</td>
                    <td className="p-3 text-emerald-400 flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> {art.helpfulCount}</td>
                    <td className="p-3 text-neutral-500">{new Date(art.updatedAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={() => openEditModal(art)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(art.id, art.title)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Article Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0a0a0d] border border-white/15 rounded-3xl p-6 md:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl shadow-black relative scrollbar-thin">
            <h3 className="font-bold text-base text-white">
              {editingArticle ? 'Edit Documentation Article' : 'Create New Documentation Article'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Title *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Setting up SSL Certificates on Traefik Reverse Proxy"
                  className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 font-mono"
                  >
                    <option value="deployments" className="bg-[#0a0a0c]">Deployments & Apps</option>
                    <option value="vps" className="bg-[#0a0a0c]">VPS Fleet & SSH</option>
                    <option value="databases" className="bg-[#0a0a0c]">Managed Databases</option>
                    <option value="domains" className="bg-[#0a0a0c]">Domains & SSL</option>
                    <option value="billing" className="bg-[#0a0a0c]">Billing & Invoices</option>
                    <option value="api" className="bg-[#0a0a0c]">API & Developer SDK</option>
                    <option value="troubleshooting" className="bg-[#0a0a0c]">Troubleshooting</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Target Persona Role *</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as KbTargetRole)}
                    className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 font-mono"
                  >
                    <option value="customer" className="bg-[#0a0a0c]">Customer Storefront (/knowledgebase)</option>
                    <option value="support" className="bg-[#0a0a0c]">Support Operations (/support/kb)</option>
                    <option value="dev" className="bg-[#0a0a0c]">Developer Architecture</option>
                    <option value="admin" className="bg-[#0a0a0c]">Admin Control Panel</option>
                    <option value="all" className="bg-[#0a0a0c]">All Persona Workspaces</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Summary *</label>
                <input
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short description snippet for search previews..."
                  className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Article Content (Markdown & code blocks ``` supported) *</label>
                <textarea
                  required
                  rows={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Full documentation body..."
                  className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-white/40 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="published-check"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="rounded border-white/20 bg-white/10"
                />
                <label htmlFor="published-check" className="text-xs text-white cursor-pointer select-none">
                  Publish article immediately (visible to designated persona space)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={saving}
                  className="bg-white text-black hover:bg-neutral-200 font-bold shadow-md"
                >
                  {saving ? 'Saving...' : editingArticle ? 'Update Article' : 'Create Article'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
