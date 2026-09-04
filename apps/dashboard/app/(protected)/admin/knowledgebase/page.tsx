'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Button, Spinner, PageHeader, useToast } from '@/components/ui';

interface KbArticle {
  id: string;
  slug: string;
  title: string;
  category: 'deployments' | 'vps' | 'databases' | 'domains' | 'billing' | 'api' | 'troubleshooting';
  summary: string;
  content: string;
  published: boolean;
  views: number;
  helpfulCount: number;
  updatedAt: string;
}

export default function AdminKnowledgeBasePage() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<KbArticle['category']>('deployments');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  async function loadArticles() {
    setLoading(true);
    try {
      const data = await api.knowledgebase.list('all', '');
      setArticles(data.articles || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load admin articles', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArticles();
  }, []);

  function openCreateModal() {
    setEditingArticle(null);
    setTitle('');
    setCategory('deployments');
    setSummary('');
    setContent('');
    setPublished(true);
    setShowModal(true);
  }

  function openEditModal(article: KbArticle) {
    setEditingArticle(article);
    setTitle(article.title);
    setCategory(article.category);
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
          summary,
          content,
          published,
        });
        toast('Article updated successfully!', 'success');
      } else {
        await api.knowledgebase.createArticle({
          title,
          category,
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
    <div className="space-y-6">
      <PageHeader
        title="Admin Knowledge Base Manager"
        description="Create, publish, edit, and maintain customer-facing platform documentation."
        action={<Button onClick={openCreateModal}>+ New Article</Button>}
      />

      <Card title="Documentation Repository" description="Manage all published & draft documentation articles.">
        {loading ? (
          <div className="py-12 text-center"><Spinner label="Loading articles..." /></div>
        ) : articles.length === 0 ? (
          <p className="text-xs text-text-muted italic text-center py-8">No articles found in repository.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-text-muted border-b border-white/10 uppercase font-mono">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Helpful</th>
                  <th className="p-3">Last Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {articles.map((art) => (
                  <tr key={art.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-sans font-medium text-white max-w-xs truncate">{art.title}</td>
                    <td className="p-3 uppercase text-[10px] text-accent-cyan">{art.category}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${art.published ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {art.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-3 text-text-muted">{art.views}</td>
                    <td className="p-3 text-text-muted flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-400 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      {art.helpfulCount}
                    </td>
                    <td className="p-3 text-text-muted">{new Date(art.updatedAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={() => openEditModal(art)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(art.id, art.title)} className="text-red-400">Delete</Button>
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">
              {editingArticle ? 'Edit Article' : 'Create New Knowledge Base Article'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Setting up SSL Certificates on Traefik"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                >
                  <option value="deployments">Deployments & Apps</option>
                  <option value="vps">VPS Fleet & Nodes</option>
                  <option value="databases">Managed Databases</option>
                  <option value="domains">Domains & SSL</option>
                  <option value="billing">Billing & Invoices</option>
                  <option value="api">API & Developer SDK</option>
                  <option value="troubleshooting">Troubleshooting</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Summary</label>
                <input
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short description snippet for search previews..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Article Content (Markdown supported)</label>
                <textarea
                  required
                  rows={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Full documentation body..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="published-check"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                <label htmlFor="published-check" className="text-xs text-white cursor-pointer select-none">
                  Publish article immediately (visible to customers)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" size="sm" loading={saving}>
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
