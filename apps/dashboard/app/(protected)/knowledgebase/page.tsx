'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { KbArticle, KbCategory } from '@/lib/types';
import { Card, Button, Spinner, PageHeader, useToast, Badge } from '@/components/ui';
import { Check, Copy, Eye, ThumbsUp, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function copyToClipboard() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast('Code snippet copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-white/10 bg-black/60 font-mono text-xs shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-[10px] text-text-muted">
        <span>Terminal / Snippet</span>
        <button
          type="button"
          onClick={copyToClipboard}
          className="text-accent-teal hover:text-white transition-colors font-semibold flex items-center gap-1"
        >
          {copied ? (
            <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Copied</span>
          ) : (
            <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</span>
          )}
        </button>
      </div>
      <pre className="p-3 text-emerald-300 overflow-x-auto whitespace-pre-wrap">{code}</pre>
    </div>
  );
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
      const data = await api.knowledgebase.list(selectedCategory, searchQuery, 'customer');
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

  // Parse lines for code blocks
  function renderContentWithCode(text: string) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^[a-z]+\n/i, '').trim();
        return <CodeBlock key={i} code={code} />;
      }
      return (
        <div key={i} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </div>
      );
    });
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        title="Customer Knowledge Base & Help Center"
        description="Self-service guides, tutorials, command snippets, troubleshooting, and API references for your cloud services."
      />

      {/* Search Header Banner */}
      <div className="p-8 border border-white/10 rounded-3xl bg-gradient-to-r from-accent-teal/15 via-black/50 to-purple-500/15 text-center space-y-4 shadow-2xl backdrop-blur-md">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Search Documentation & Help Topics
        </h2>
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search VPS SSH, Docker, Managed DBs, Mailboxes, Domains..."
            className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-text-muted focus:outline-none focus:border-accent-teal shadow-inner font-mono"
          />
          <Button type="submit" variant="primary" size="md">
            Search Docs
          </Button>
        </form>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`p-3.5 rounded-2xl border text-left transition-all space-y-1.5 ${
            selectedCategory === 'all'
              ? 'bg-accent-teal/20 border-accent-teal text-white shadow-lg'
              : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          <div className="text-xs font-bold text-accent-teal font-mono"># ALL</div>
          <h4 className="text-xs font-semibold">All Categories</h4>
          <p className="text-[10px] text-text-muted truncate">Full Repository</p>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`p-3.5 rounded-2xl border text-left transition-all space-y-1.5 ${
                isSelected
                  ? 'bg-accent-violet/20 border-accent-violet text-white shadow-lg'
                  : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <div className="text-xs font-bold text-accent-violet font-mono">#{cat.slug.slice(0, 4).toUpperCase()}</div>
              <h4 className="text-xs font-semibold truncate">{cat.name}</h4>
              <p className="text-[10px] text-text-muted truncate">{cat.description}</p>
            </button>
          );
        })}
      </div>

      {/* Articles Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {selectedCategory === 'all' ? 'Featured Documentation Articles' : `Category: ${selectedCategory}`}
          </h3>
          <span className="text-xs text-text-muted font-mono">{articles.length} article(s)</span>
        </div>

        {loading ? (
          <div className="py-12 text-center"><Spinner label="Loading Documentation..." /></div>
        ) : articles.length === 0 ? (
          <Card className="border border-dashed border-white/10 p-8 text-center text-text-muted text-xs">
            No customer articles found matching current category or search query.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map((article) => (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="p-5 border border-white/10 rounded-2xl bg-neutral-900/60 hover:bg-white/[0.05] hover:border-accent-teal/40 transition-all cursor-pointer space-y-3 group shadow-md backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-white group-hover:text-accent-teal transition-colors">
                    {article.title}
                  </h4>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-text-muted flex-shrink-0">
                    {article.category}
                  </span>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                  {article.summary}
                </p>
                <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pt-2 border-t border-white/5">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-slate-400" /> {article.views} views</span>
                  <span className="text-emerald-400 flex items-center gap-1"><ThumbsUp className="w-3 h-3 text-emerald-400" /> {article.helpfulCount} helpful</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/20 rounded-3xl p-6 md:p-8 w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-accent-teal/20 text-accent-teal font-bold">
                  {selectedArticle.category}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-white mt-2">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="text-text-muted hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Article Content */}
            <div className="space-y-4 text-xs leading-relaxed text-text-primary">
              {renderContentWithCode(selectedArticle.content)}
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
                {votedHelpful[selectedArticle.id] ? (
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Marked Helpful</span>
                ) : (
                  `Was this helpful? (${selectedArticle.helpfulCount})`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
