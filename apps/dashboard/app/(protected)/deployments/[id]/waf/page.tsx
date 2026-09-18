'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, Button, Badge, useToast, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface WafRule {
  id: string;
  action: 'allow' | 'block' | 'rate_limit' | 'turnstile_challenge';
  matchType: 'ip' | 'ip_range' | 'header' | 'path' | 'user_agent' | 'country';
  matchValue: string;
  description?: string;
  isEnabled: boolean;
  createdAt: string;
}

export default function WafSecurityPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const { toast } = useToast();

  const [rules, setRules] = useState<WafRule[]>([]);
  const [wafTurnstileEnabled, setWafTurnstileEnabled] = useState(false);
  const [hasProtectionPassword, setHasProtectionPassword] = useState(false);
  const [protectionPassword, setProtectionPassword] = useState('');
  const [loading, setLoading] = useState(true);

  // New Rule Form state
  const [action, setAction] = useState<'allow' | 'block' | 'rate_limit' | 'turnstile_challenge'>('block');
  const [matchType, setMatchType] = useState<'ip' | 'ip_range' | 'header' | 'path' | 'user_agent' | 'country'>('ip');
  const [matchValue, setMatchValue] = useState('');
  const [description, setDescription] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  async function loadWafData() {
    setLoading(true);
    try {
      const res = await api.get(`/deployments/${deploymentId}/waf/rules`);
      setRules(res.rules || []);
      setWafTurnstileEnabled(res.wafTurnstileEnabled || false);
      setHasProtectionPassword(res.hasProtectionPassword || false);
    } catch (err: any) {
      toast(err.message || 'Failed to load WAF configuration', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWafData();
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
      });
      toast('WAF rule added successfully!', 'success');
      setMatchValue('');
      setDescription('');
      await loadWafData();
    } catch (err: any) {
      toast(err.message || 'Failed to add WAF rule', 'error');
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
      toast(err.message || 'Failed to delete rule', 'error');
    }
  }

  async function handleToggleTurnstile() {
    try {
      const updated = !wafTurnstileEnabled;
      await api.post(`/deployments/${deploymentId}/waf/turnstile`, { enabled: updated });
      setWafTurnstileEnabled(updated);
      toast(updated ? 'Anti-bot challenge activated!' : 'Anti-bot challenge disabled.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to toggle anti-bot challenge', 'error');
    }
  }

  async function handleSetProtection(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/deployments/${deploymentId}/waf/protection`, {
        password: protectionPassword.trim() || null,
      });
      toast(protectionPassword.trim() ? 'URL password protection enabled!' : 'URL password protection cleared.', 'success');
      setProtectionPassword('');
      await loadWafData();
    } catch (err: any) {
      toast(err.message || 'Failed to update URL protection', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Firewall & Security Hub"
          description="Manage firewall rules, automated anti-bot verification challenges, IP filtering, and Basic Auth deployment passwords."
        />
        <Button variant="secondary" size="sm" onClick={() => router.push(`/deployments/${deploymentId}`)} className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Deployment</span>
        </Button>
      </div>

      {/* Turnstile Anti-Bot Challenge Card */}
      <Card
        title="Automated Anti-Bot Verification Gate"
        description="Automatically present an interactive anti-bot verification challenge to suspicious visitors and crawler traffic."
      >
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Interactive Verification Challenge</span>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${wafTurnstileEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-text-muted'}`}>
                {wafTurnstileEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Protects endpoints against automated scrapers, credential stuffing, and brute-force attacks without blocking real users.
            </p>
          </div>
          <Button size="sm" variant={wafTurnstileEnabled ? 'secondary' : 'primary'} onClick={handleToggleTurnstile}>
            {wafTurnstileEnabled ? 'Disable Challenge' : 'Enable Challenge'}
          </Button>
        </div>
      </Card>

      {/* Deployment Protection (Password Gate) */}
      <Card
        title="Deployment Password Protection (HTTP Basic Auth)"
        description="Gate access to preview or production environments with a secret password."
      >
        <form onSubmit={handleSetProtection} className="space-y-4 max-w-md">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Protection Password {hasProtectionPassword && <span className="text-emerald-400">(Currently Active)</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={protectionPassword}
                onChange={(e) => setProtectionPassword(e.target.value)}
                placeholder={hasProtectionPassword ? 'Enter new password to change...' : 'Set secret password...'}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
              />
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
            {hasProtectionPassword && (
              <p className="text-[11px] text-text-muted mt-1.5">
                To remove password protection, submit an empty password input.
              </p>
            )}
          </div>
        </form>
      </Card>

      {/* WAF Rules Manager */}
      <Card title="Custom WAF Firewall Rules" description="Define custom IP blocks, rate limits, user-agent blocks, and path filters.">
        <form onSubmit={handleAddRule} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as any)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="block">Block Access</option>
              <option value="rate_limit">Rate Limit</option>
              <option value="turnstile_challenge">Verification Challenge</option>
              <option value="allow">Allowlist</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Match Type</label>
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as any)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="ip">IP Address</option>
              <option value="ip_range">IP CIDR Range</option>
              <option value="path">Path / Route</option>
              <option value="header">HTTP Header</option>
              <option value="user_agent">User Agent</option>
              <option value="country">Country Code</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-text-muted block mb-1">Match Value</label>
            <input
              type="text"
              required
              value={matchValue}
              onChange={(e) => setMatchValue(e.target.value)}
              placeholder="e.g. 192.168.1.1 or /admin/*"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" size="sm" loading={addingRule} className="w-full flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Rule</span>
            </Button>
          </div>
        </form>

        {rules.length === 0 ? (
          <p className="text-xs text-text-faint italic py-4 text-center">No custom WAF rules configured.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-3 border border-white/10 rounded-xl bg-black/40 text-xs">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${
                    rule.action === 'block' ? 'bg-red-500/20 text-red-400' :
                    rule.action === 'rate_limit' ? 'bg-amber-500/20 text-amber-400' :
                    rule.action === 'turnstile_challenge' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {rule.action}
                  </span>
                  <span className="font-mono text-text-muted">{rule.matchType}:</span>
                  <span className="font-mono text-white font-semibold">{rule.matchValue}</span>
                </div>
                <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDeleteRule(rule.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
