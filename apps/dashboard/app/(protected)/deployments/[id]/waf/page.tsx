'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, Button, useToast, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface WafRule {
  id: string;
  action: 'allow' | 'block' | 'rate_limit';
  matchType: 'ip' | 'ip_range' | 'header' | 'path' | 'user_agent';
  matchValue: string;
  rateLimitPerMinute: number | null;
  description?: string;
  isEnabled: boolean;
  createdAt: string;
}

const ACTION_LABEL: Record<WafRule['action'], string> = { block: 'Block', rate_limit: 'Rate limit', allow: 'Allow' };
const MATCH_LABEL: Record<WafRule['matchType'], string> = { ip: 'IP', ip_range: 'IP range', header: 'Header', path: 'Path', user_agent: 'User agent' };

export default function WafSecurityPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const { toast } = useToast();

  const [rules, setRules] = useState<WafRule[]>([]);
  const [hasProtectionPassword, setHasProtectionPassword] = useState(false);
  const [protectionPassword, setProtectionPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New rule form state
  const [action, setAction] = useState<WafRule['action']>('block');
  const [matchType, setMatchType] = useState<WafRule['matchType']>('ip');
  const [matchValue, setMatchValue] = useState('');
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState('60');
  const [description, setDescription] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  async function loadWafData() {
    setLoading(true);
    try {
      const res = await api.get(`/deployments/${deploymentId}/waf/rules`);
      setRules(res.rules || []);
      setHasProtectionPassword(Boolean(res.hasProtectionPassword));
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the firewall configuration.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWafData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId]);

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!matchValue.trim()) return;
    setAddingRule(true);
    try {
      await api.post(`/deployments/${deploymentId}/waf/rules`, {
        action,
        matchType,
        matchValue: matchValue.trim(),
        description: description.trim() || undefined,
        rateLimitPerMinute: action === 'rate_limit' ? Number(rateLimitPerMinute) : undefined,
      });
      toast('Rule added.', 'success');
      setMatchValue('');
      setDescription('');
      await loadWafData();
    } catch (err: any) {
      toast(err?.message || 'Could not add the rule.', 'error');
    } finally {
      setAddingRule(false);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      await api.delete(`/deployments/${deploymentId}/waf/rules/${ruleId}`);
      toast('Rule removed.', 'info');
      await loadWafData();
    } catch (err: any) {
      toast(err?.message || 'Could not delete the rule.', 'error');
    }
  }

  async function handleSetProtection(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await api.post(`/deployments/${deploymentId}/waf/protection`, { password: protectionPassword.trim() || null });
      toast(protectionPassword.trim() ? 'Password protection enabled.' : 'Password protection removed.', 'success');
      setProtectionPassword('');
      await loadWafData();
    } catch (err: any) {
      toast(err?.message || 'Could not update password protection.', 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Firewall" description="Block or rate-limit traffic by IP, path, header or user agent, and optionally require a password." />
        <Button variant="secondary" size="sm" onClick={() => router.push(`/deployments/${deploymentId}`)} className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to deployment</span>
        </Button>
      </div>

      {loadError && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{loadError}</p>}

      <p className="text-xs text-text-muted">
        Rules apply to this deployment&apos;s public HTTPS address only (not a direct-port or internal deployment). New rules take effect immediately. A deployment
        that has not been redeployed since firewall support was added needs one more redeploy before any of this applies to it.
      </p>

      {/* Password protection */}
      <Card title="Password protection" description="Require a password before anyone can reach this deployment (HTTP Basic Auth).">
        <form onSubmit={handleSetProtection} className="max-w-md space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Password {hasProtectionPassword && <span className="text-emerald-400">(currently on)</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={protectionPassword}
                onChange={(e) => setProtectionPassword(e.target.value)}
                placeholder={hasProtectionPassword ? 'Enter a new password to change it' : 'Set a password (min. 8 characters)'}
                minLength={8}
                className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-accent-cyan focus:outline-none"
              />
              <Button type="submit" size="sm" loading={savingPassword}>
                Save
              </Button>
            </div>
            {hasProtectionPassword && <p className="mt-1.5 text-[11px] text-text-muted">Submit an empty password to remove protection.</p>}
          </div>
        </form>
      </Card>

      {/* Rules */}
      <Card title="Rules" description="Checked in order: a matching block rule always wins, then rate limits, then anything not matched is allowed.">
        <form onSubmit={handleAddRule} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-muted">Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value as WafRule['action'])} className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none">
              <option value="block">Block</option>
              <option value="rate_limit">Rate limit</option>
              <option value="allow">Allow</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-muted">Match</label>
            <select value={matchType} onChange={(e) => setMatchType(e.target.value as WafRule['matchType'])} className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none">
              <option value="ip">IP address</option>
              <option value="ip_range">IP range (CIDR)</option>
              <option value="path">Path</option>
              <option value="header">HTTP header</option>
              <option value="user_agent">User agent</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-muted">
              {matchType === 'path' ? 'Path (end with * for a prefix)' : matchType === 'header' ? 'Name or "Name: value"' : 'Value'}
            </label>
            <input
              type="text"
              required
              value={matchValue}
              onChange={(e) => setMatchValue(e.target.value)}
              placeholder={matchType === 'ip' ? '203.0.113.7' : matchType === 'ip_range' ? '203.0.113.0/24' : matchType === 'path' ? '/admin*' : matchType === 'header' ? 'X-Api-Key' : 'BadBot'}
              className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
            />
          </div>

          {action === 'rate_limit' ? (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-muted">Requests / min / IP</label>
              <input
                type="number"
                min={1}
                max={100000}
                required
                value={rateLimitPerMinute}
                onChange={(e) => setRateLimitPerMinute(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-text-muted">Note (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why this rule exists"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-end">
            <Button type="submit" size="sm" loading={addingRule} className="w-full">
              Add rule
            </Button>
          </div>
        </form>

        {loading ? (
          <p className="py-4 text-center text-xs text-text-muted">Loading...</p>
        ) : rules.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-muted">No rules yet.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      rule.action === 'block' ? 'bg-red-500/20 text-red-400' : rule.action === 'rate_limit' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {ACTION_LABEL[rule.action]}
                  </span>
                  <span className="font-mono text-text-muted">{MATCH_LABEL[rule.matchType]}:</span>
                  <span className="font-mono font-semibold text-white">{rule.matchValue}</span>
                  {rule.action === 'rate_limit' && rule.rateLimitPerMinute && <span className="font-mono text-text-muted">({rule.rateLimitPerMinute}/min)</span>}
                  {rule.description && <span className="text-text-muted">— {rule.description}</span>}
                </div>
                <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDeleteRule(rule.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Honest placeholder for what is not built yet, instead of a toggle that looks like it works */}
      <Card title="Bot challenge" description="An interactive verification challenge for suspicious traffic.">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs text-text-muted">Not available yet. Use a block or rate-limit rule, or password protection, in the meantime.</p>
          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-text-muted">Coming soon</span>
        </div>
      </Card>
    </div>
  );
}
