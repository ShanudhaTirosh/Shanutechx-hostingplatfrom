'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, Button, useToast, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface RewriteRule {
  source: string;
  destination: string;
}

interface RedirectRule {
  source: string;
  destination: string;
  permanent: boolean;
}

interface CronRule {
  path: string;
  schedule: string;
  description?: string;
}

export default function EdgeRulesPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const { toast } = useToast();

  const [rewrites, setRewrites] = useState<RewriteRule[]>([]);
  const [redirects, setRedirects] = useState<RedirectRule[]>([]);
  const [crons, setCrons] = useState<CronRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New item inputs
  const [newRewriteSource, setNewRewriteSource] = useState('');
  const [newRewriteDest, setNewRewriteDest] = useState('');

  const [newRedirectSource, setNewRedirectSource] = useState('');
  const [newRedirectDest, setNewRedirectDest] = useState('');
  const [newRedirectPerm, setNewRedirectPerm] = useState(false);

  const [newCronPath, setNewCronPath] = useState('');
  const [newCronSchedule, setNewCronSchedule] = useState('0 * * * *');

  async function loadEdgeRules() {
    setLoading(true);
    try {
      const res = await api.get(`/deployments/${deploymentId}/edge-rules`);
      const rules = res.edgeRules || {};
      setRewrites(rules.rewrites || []);
      setRedirects(rules.redirects || []);
      setCrons(rules.crons || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load edge rules', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEdgeRules();
  }, [deploymentId]);

  async function handleSaveEdgeRules() {
    setSaving(true);
    try {
      await api.put(`/deployments/${deploymentId}/edge-rules`, {
        rewrites,
        redirects,
        crons,
      });
      toast('Edge routing rules saved successfully!', 'success');
      await loadEdgeRules();
    } catch (err: any) {
      toast(err.message || 'Failed to save edge rules', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addRewrite() {
    if (!newRewriteSource || !newRewriteDest) return;
    setRewrites([...rewrites, { source: newRewriteSource.trim(), destination: newRewriteDest.trim() }]);
    setNewRewriteSource('');
    setNewRewriteDest('');
  }

  function addRedirect() {
    if (!newRedirectSource || !newRedirectDest) return;
    setRedirects([...redirects, { source: newRedirectSource.trim(), destination: newRedirectDest.trim(), permanent: newRedirectPerm }]);
    setNewRedirectSource('');
    setNewRedirectDest('');
  }

  function addCron() {
    if (!newCronPath || !newCronSchedule) return;
    setCrons([...crons, { path: newCronPath.trim(), schedule: newCronSchedule.trim() }]);
    setNewCronPath('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Edge Routing & Crons Hub"
          description="Configure Edge Routing Rules, HTTP Rewrites, Redirects, Custom Response Headers, and scheduled Cron tasks."
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/deployments/${deploymentId}`)} className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Deployment</span>
          </Button>
          <Button size="sm" onClick={handleSaveEdgeRules} loading={saving}>
            Save All Edge Rules
          </Button>
        </div>
      </div>

      {/* Rewrites Card */}
      <Card title="HTTP Rewrites" description="Map incoming request paths to alternative internal or external destinations transparently.">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={newRewriteSource}
            onChange={(e) => setNewRewriteSource(e.target.value)}
            placeholder="Source path (e.g. /old-path)"
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
          <span className="text-text-muted text-xs">→</span>
          <input
            type="text"
            value={newRewriteDest}
            onChange={(e) => setNewRewriteDest(e.target.value)}
            placeholder="Destination path (e.g. /new-path)"
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
          <Button size="sm" onClick={addRewrite} className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Rewrite</span>
          </Button>
        </div>

        {rewrites.length === 0 ? (
          <p className="text-xs text-text-faint italic py-2">No rewrites defined.</p>
        ) : (
          <div className="space-y-2">
            {rewrites.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-white/10 bg-black/40 text-xs font-mono">
                <span>{r.source} → {r.destination}</span>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setRewrites(rewrites.filter((_, idx) => idx !== i))}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Redirects Card */}
      <Card title="HTTP Redirects" description="Send 301 (Permanent) or 302 (Temporary) redirects to incoming traffic.">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input
            type="text"
            value={newRedirectSource}
            onChange={(e) => setNewRedirectSource(e.target.value)}
            placeholder="Source path (e.g. /legacy)"
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
          <span className="text-text-muted text-xs">→</span>
          <input
            type="text"
            value={newRedirectDest}
            onChange={(e) => setNewRedirectDest(e.target.value)}
            placeholder="Target URL (e.g. https://example.com)"
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input type="checkbox" checked={newRedirectPerm} onChange={(e) => setNewRedirectPerm(e.target.checked)} />
            301 Permanent
          </label>
          <Button size="sm" onClick={addRedirect} className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Redirect</span>
          </Button>
        </div>

        {redirects.length === 0 ? (
          <p className="text-xs text-text-faint italic py-2">No redirects defined.</p>
        ) : (
          <div className="space-y-2">
            {redirects.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-white/10 bg-black/40 text-xs font-mono">
                <span>{r.source} → {r.destination} [{r.permanent ? '301 Permanent' : '302 Temporary'}]</span>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setRedirects(redirects.filter((_, idx) => idx !== i))}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Scheduled Crons Card */}
      <Card title="Scheduled Cron Jobs" description="Schedule automatic HTTP requests to your deployment endpoints on a timer.">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={newCronPath}
            onChange={(e) => setNewCronPath(e.target.value)}
            placeholder="API Path (e.g. /api/cron/sync)"
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
          <input
            type="text"
            value={newCronSchedule}
            onChange={(e) => setNewCronSchedule(e.target.value)}
            placeholder="Cron Expression (e.g. 0 * * * *)"
            className="w-48 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
          <Button size="sm" onClick={addCron} className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Schedule Cron</span>
          </Button>
        </div>

        {crons.length === 0 ? (
          <p className="text-xs text-text-faint italic py-2">No cron schedules defined.</p>
        ) : (
          <div className="space-y-2">
            {crons.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-white/10 bg-black/40 text-xs font-mono">
                <span>Path: {c.path} | Schedule: {c.schedule}</span>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setCrons(crons.filter((_, idx) => idx !== i))}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
