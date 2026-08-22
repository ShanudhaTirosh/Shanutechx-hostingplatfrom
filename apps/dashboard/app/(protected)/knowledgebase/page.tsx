'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Button, Spinner, PageHeader, useToast } from '@/components/ui';

interface KbArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  published: boolean;
  views: number;
  helpfulCount: number;
  updatedAt: string;
}

interface KbCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export default function CustomerKnowledgeBasePage() {
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);
  const [votedHelpful, setVotedHelpful] = useState<Record<string, boolean>>({});

  const { toast } = useToast();

  async function loadKb() {
    setLoading(true);
    try {
      const data = await api.knowledgebase.list(selectedCategory, searchQuery);
      setCategories(data.categories || []);
      setArticles(data.articles || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load Knowledge Base', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKb();
  }, [selectedCategory]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadKb();
  }

  async function handleVoteHelpful(articleId: string) {
    if (votedHelpful[articleId]) return;
    try {
      await api.knowledgebase.voteHelpful(articleId);
      setVotedHelpful((prev) => ({ ...prev, [articleId]: true }));
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, helpfulCount: a.helpfulCount + 1 } : a))
      );
      if (selectedArticle && selectedArticle.id === articleId) {
        setSelectedArticle({ ...selectedArticle, helpfulCount: selectedArticle.helpfulCount + 1 });
      }
      toast('Thanks for your feedback!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PageHeader
        title="Knowledge Base & Documentation"
        description="Guides, tutorials, troubleshooting tips, and API references for ShanuTechX platform services."
      />

      {/* Search Header Banner */}
      <div className="p-8 border border-white/10 rounded-3xl bg-gradient-to-r from-accent-violet/20 via-black/40 to-accent-cyan/20 text-center space-y-4 shadow-2xl">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          How can we help you today?
        </h2>
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search docs, guides, errors, or keywords..."
            className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-accent-cyan shadow-inner font-mono"
          />
          <Button type="submit">Search</Button>
        </form>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
            selectedCategory === 'all'
              ? 'bg-accent-cyan/20 border-accent-cyan text-white shadow-lg'
              : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          <p className="text-2xl">📚</p>
          <div>
            <h4 className="text-xs font-semibold">All Categories</h4>
            <p className="text-[10px] text-text-faint">Full Documentation</p>
          </div>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`p-4 rounded-2xl border text-left transition-all space-y-2 ${
                isSelected
                  ? 'bg-accent-violet/20 border-accent-violet text-white shadow-lg'
                  : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <p className="text-2xl">{cat.icon}</p>
              <div>
                <h4 className="text-xs font-semibold truncate">{cat.name}</h4>
                <p className="text-[10px] text-text-faint truncate">{cat.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Articles Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            {selectedCategory === 'all' ? 'Featured Articles' : `Category: ${selectedCategory}`}
          </h3>
          <span className="text-xs text-text-muted font-mono">{articles.length} article(s)</span>
        </div>

        {loading ? (
          <div className="py-12 text-center"><Spinner label="Loading Knowledge Base..." /></div>
        ) : articles.length === 0 ? (
          <Card>
            <p className="text-xs text-text-muted italic text-center py-8">
              No documentation articles found matching your query.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map((article) => (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="p-5 border border-white/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] hover:border-accent-cyan/40 transition-all cursor-pointer space-y-3 group shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold text-white group-hover:text-accent-cyan transition-colors">
                    {article.title}
                  </h4>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-text-muted flex-shrink-0">
                    {article.category}
                  </span>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                  {article.summary}
                </p>
                <div className="flex items-center justify-between text-[11px] text-text-faint font-mono pt-2 border-t border-white/[0.04]">
                  <span>👁 {article.views} views</span>
                  <span>👍 {article.helpfulCount} helpful</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-accent-cyan/20 text-accent-cyan">
                  {selectedArticle.category}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-white mt-2">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="text-text-muted hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Article Content */}
            <div className="prose prose-invert prose-xs max-w-none space-y-4 text-xs leading-relaxed text-text-primary">
              <div className="whitespace-pre-wrap font-sans space-y-3">
                {selectedArticle.content}
              </div>
            </div>

            {/* Article Footer & Helpful Vote */}
            <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs">
              <span className="text-text-muted font-mono">
                Updated {new Date(selectedArticle.updatedAt).toLocaleDateString()}
              </span>
              <Button
                size="sm"
                variant={votedHelpful[selectedArticle.id] ? 'secondary' : 'primary'}
                onClick={() => handleVoteHelpful(selectedArticle.id)}
              >
                {votedHelpful[selectedArticle.id] ? '👍 Marked Helpful' : `👍 Was this article helpful? (${selectedArticle.helpfulCount})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
