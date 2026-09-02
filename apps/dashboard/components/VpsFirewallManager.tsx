'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Button, Spinner, useToast, Badge, ErrorBanner } from '@/components/ui';
import {
  IconShield,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconAlert,
  IconClose,
  IconCheck,
} from '@/components/Icons';

export interface FirewallRule {
  index: number;
  to: string;
  action: 'ALLOW' | 'DENY';
  from: string;
  comment?: string;
}

interface VpsFirewallManagerProps {
  provisionId: string;
  sshPort?: number;
}

export function VpsFirewallManager({ provisionId, sshPort = 22 }: VpsFirewallManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'active' | 'inactive'>('inactive');
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [toggling, setToggling] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Add Rule Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingRule, setSubmittingRule] = useState(false);
  const [ruleAction, setRuleAction] = useState<'allow' | 'deny'>('allow');
  const [rulePort, setRulePort] = useState<string>('80');
  const [ruleProtocol, setRuleProtocol] = useState<'tcp' | 'udp' | 'any'>('tcp');
  const [ruleSourceIp, setRuleSourceIp] = useState<string>('');
  const [ruleComment, setRuleComment] = useState<string>('');

  const loadFirewall = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.vps.getFirewall(provisionId);
      setStatus(res.status);
      setRules(res.rules || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load VPS host firewall status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirewall();
  }, [provisionId]);

  const handleToggle = async () => {
    const nextStatus = status === 'active' ? false : true;
    setToggling(true);
    try {
      const res = await api.vps.toggleFirewall(provisionId, nextStatus);
      setStatus(res.status);
      toast(`Host firewall is now ${res.status.toUpperCase()}`, 'success');
      await loadFirewall();
    } catch (err: any) {
      toast(`Firewall toggle failed: ${err.message}`, 'error');
    } finally {
      setToggling(false);
    }
  };

  const handleDeleteRule = async (index: number) => {
    if (!confirm(`Are you sure you want to delete firewall rule #${index}?`)) return;
    setDeletingIndex(index);
    try {
      await api.vps.deleteFirewallRule(provisionId, index);
      toast(`Firewall rule #${index} deleted`, 'success');
      await loadFirewall();
    } catch (err: any) {
      toast(`Failed to delete rule: ${err.message}`, 'error');
    } finally {
      setDeletingIndex(null);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRule(true);
    try {
      await api.vps.addFirewallRule(provisionId, {
        action: ruleAction,
        port: rulePort,
        protocol: ruleProtocol,
        sourceIp: ruleSourceIp,
        comment: ruleComment,
      });
      toast('Firewall rule added successfully', 'success');
      setShowAddModal(false);
      setRulePort('80');
      setRuleComment('');
      await loadFirewall();
    } catch (err: any) {
      toast(`Failed to add rule: ${err.message}`, 'error');
    } finally {
      setSubmittingRule(false);
    }
  };

  const applyPreset = async (presetName: string, port: string, protocol: 'tcp' | 'udp' | 'any' = 'tcp') => {
    try {
      await api.vps.addFirewallRule(provisionId, {
        action: 'allow',
        port,
        protocol,
        comment: `${presetName} Preset`,
      });
      toast(`Preset rule added: Allow ${presetName} (Port ${port})`, 'success');
      await loadFirewall();
    } catch (err: any) {
      toast(`Failed to apply preset: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Card */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-accent-violet/10 border border-accent-violet/20 text-accent-violet-light">
              <IconShield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Host VPS Firewall (UFW)</h3>
                <Badge status={status === 'active' ? 'running' : 'stopped'} />
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Manage host-level network port filtering and IP access rules directly over SSH.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadFirewall} disabled={loading}>
              <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>

            <Button
              variant={status === 'active' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleToggle}
              loading={toggling}
            >
              {status === 'active' ? 'Disable Firewall' : 'Enable Firewall'}
            </Button>

            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <IconPlus size={14} />
              Add Rule
            </Button>
          </div>
        </div>
      </Card>

      {/* Critical SSH Security Warning */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-2 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <IconAlert size={16} />
          <span>IMPORTANT SSH ACCESS SECURITY WARNING</span>
        </div>
        <p>
          Before enabling or tightening rules, ensure port <code className="font-mono text-white bg-amber-950/60 px-1.5 py-0.5 rounded">{sshPort}</code> (SSH) is explicitly allowed from Anywhere. Blocking port {sshPort} will lock you out of the web SSH terminal and SFTP file access!
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-text-muted font-medium mr-1">Quick Presets:</span>
        <button
          onClick={() => applyPreset('SSH', String(sshPort), 'tcp')}
          className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white font-mono text-[11px] transition-all"
        >
          + Allow SSH ({sshPort}/tcp)
        </button>
        <button
          onClick={() => applyPreset('HTTP Web', '80', 'tcp')}
          className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white font-mono text-[11px] transition-all"
        >
          + Allow HTTP (80/tcp)
        </button>
        <button
          onClick={() => applyPreset('HTTPS Web', '443', 'tcp')}
          className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white font-mono text-[11px] transition-all"
        >
          + Allow HTTPS (443/tcp)
        </button>
        <button
          onClick={() => applyPreset('MySQL Database', '3306', 'tcp')}
          className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white font-mono text-[11px] transition-all"
        >
          + Allow MySQL (3306/tcp)
        </button>
        <button
          onClick={() => applyPreset('PostgreSQL Database', '5432', 'tcp')}
          className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white font-mono text-[11px] transition-all"
        >
          + Allow Postgres (5432/tcp)
        </button>
      </div>

      {/* Firewall Rules List Table */}
      <Card title="Active Firewall Rules">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner label="Querying host firewall over SSH..." />
          </div>
        ) : rules.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-muted">
            {status === 'inactive'
              ? 'Firewall is currently disabled. Enable firewall above to enforce security rules.'
              : 'No custom firewall rules configured. Default incoming policy applies.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-text-muted border-b border-white/10 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Port / Protocol</th>
                  <th className="p-3">Source Address</th>
                  <th className="p-3">Comment</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {rules.map((rule) => (
                  <tr key={rule.index} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 text-text-faint">{rule.index}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rule.action === 'ALLOW'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {rule.action}
                      </span>
                    </td>
                    <td className="p-3 text-white font-bold">{rule.to}</td>
                    <td className="p-3 text-accent-cyan">{rule.from}</td>
                    <td className="p-3 text-text-muted font-sans">{rule.comment || '—'}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        disabled={deletingIndex === rule.index}
                        onClick={() => handleDeleteRule(rule.index)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete Rule"
                      >
                        <IconTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <IconShield size={18} className="text-accent-violet" />
                Add Host Firewall Rule
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <IconClose size={16} />
              </button>
            </div>

            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Action</label>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                >
                  <option value="allow">ALLOW (Permit inbound connection)</option>
                  <option value="deny">DENY (Block inbound connection)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Port or Port Range</label>
                <input
                  required
                  value={rulePort}
                  onChange={(e) => setRulePort(e.target.value)}
                  placeholder="e.g. 80, 443, 22 or 3000:3005"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Protocol</label>
                <select
                  value={ruleProtocol}
                  onChange={(e) => setRuleProtocol(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="any">ANY (TCP + UDP)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">
                  Source IP / CIDR Subnet (Optional)
                </label>
                <input
                  value={ruleSourceIp}
                  onChange={(e) => setRuleSourceIp(e.target.value)}
                  placeholder="Leave empty for Anywhere (0.0.0.0/0)"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Comment / Label</label>
                <input
                  value={ruleComment}
                  onChange={(e) => setRuleComment(e.target.value)}
                  placeholder="e.g. Production Web Traffic"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={submittingRule}>
                  Add Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
