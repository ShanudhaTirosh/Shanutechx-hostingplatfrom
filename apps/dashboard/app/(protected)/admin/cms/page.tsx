'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Button, ErrorBanner, Spinner, Input, Textarea, PageHeader, useToast } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PAGE = 'home';

export default function AdminCmsPage() {
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [faqJson, setFaqJson] = useState('');
  const [faqError, setFaqError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.cms
      .get(PAGE)
      .then((data) => {
        setHeroTitle(data.content.heroTitle ?? '');
        setHeroSubtitle(data.content.heroSubtitle ?? '');
        setFaqJson(JSON.stringify(data.content.faqItems ?? [], null, 2));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFaqError(null);
    setBusy(true);
    setError(null);

    let faqItems: unknown;
    try {
      faqItems = faqJson.trim() ? JSON.parse(faqJson) : [];
    } catch {
      setFaqError('Must be a valid JSON array of { "q": "...", "a": "..." } objects.');
      setBusy(false);
      return;
    }

    try {
      await api.cms.update(PAGE, [
        { key: 'heroTitle', value: heroTitle },
        { key: 'heroSubtitle', value: heroSubtitle },
        { key: 'faqItems', value: faqItems },
      ]);
      toast('Content saved — refresh the marketing site to see changes live.', 'success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading content..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <PageHeader
        title="Site Content"
        description="Edit the marketing site's home page content without a redeploy. Leave a field blank to use the built-in default."
      />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSave} className="space-y-4">
        <Card className="border border-white/[0.06] space-y-4">
          <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
            <span className="h-5 w-5 rounded-md bg-accent-violet/15 text-accent-violet-light text-[10px] font-bold flex items-center justify-center">H</span>
            Hero Section
          </h2>

          <Input
            label="Hero Title"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            placeholder="Hosting that gets out of your way"
            hint="Displayed as the main headline on the home page."
          />

          <Textarea
            label="Hero Subtitle"
            rows={2}
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
            placeholder="Deploy web apps, Node.js and Python services, and Discord bots in minutes."
          />
        </Card>

        <Card className="border border-white/[0.06] space-y-4">
          <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
            <span className="h-5 w-5 rounded-md bg-teal-500/15 text-teal-300 text-[10px] font-bold flex items-center justify-center">?</span>
            FAQ Items
          </h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              FAQ JSON <span className="text-text-faint">(array of {`{"q": "...", "a": "..."}`})</span>
            </label>
            <textarea
              rows={12}
              value={faqJson}
              onChange={(e) => { setFaqJson(e.target.value); setFaqError(null); }}
              spellCheck={false}
              className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-xs font-mono placeholder:text-text-faint focus:outline-none transition-colors resize-none ${
                faqError ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/10 focus:border-accent-violet/50'
              }`}
            />
            {faqError && <p className="text-xs text-red-400">{faqError}</p>}
            <p className="text-[10px] text-text-faint">
              Example: <code className="bg-white/[0.04] px-1 rounded">[{`{"q": "What is X?", "a": "X is..."}`}]</code>
            </p>
          </div>
        </Card>

        <Button type="submit" loading={busy} className="w-full justify-center" size="lg">
          {busy ? 'Saving...' : 'Save & Publish'}
        </Button>
      </form>
    </div>
  );
}
