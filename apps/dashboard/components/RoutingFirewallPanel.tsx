'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, Button, Badge, useToast } from '@/components/ui';
import { IconShield, IconTerminal, IconUnlock } from '@/components/Icons';

export type RoutingMode = 'proxied' | 'direct' | 'no_ssl';

export interface FirewallRule {
  id: string;
  action: 'ALLOW' | 'DENY';
  protocol: 'TCP' | 'UDP' | 'BOTH';
  port: number | string;
  sourceCidr: string;
  description?: string;
}

interface Props {
  deploymentId: string;
  currentRoutingMode?: RoutingMode;
  currentPort?: number;
}

export function RoutingFirewallPanel({
  deploymentId,
  currentRoutingMode = 'proxied',
  currentPort = 8080,
}: Props) {
  const [routingMode, setRoutingMode] = useState<RoutingMode>(currentRoutingMode);
  const [publishedPort, setPublishedPort] = useState<number>(currentPort);
  const [updatingRouting, setUpdatingRouting] = useState(false);

  // Firewall Rules
  const [rules, setRules] = useState<FirewallRule[]>([
    { id: 'rule-1', action: 'ALLOW', protocol: 'TCP', port: 80, sourceCidr: '0.0.0.0/0', description: 'Web traffic' },
    { id: 'rule-2', action: 'ALLOW', protocol: 'TCP', port: 443, sourceCidr: '0.0.0.0/0', description: 'HTTPS traffic' },
  ]);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);

  // New Rule Form
  const [action, setAction] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [protocol, setProtocol] = useState<'TCP' | 'UDP' | 'BOTH'>('TCP');
  const [port, setPort] = useState('8080');
  const [sourceCidr, setSourceCidr] = useState('0.0.0.0/0');
  const [description, setDescription] = useState('');

  const { toast } = useToast();

  async function handleSaveRouting(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingRouting(true);
    try {
      const mode = routingMode === 'direct' ? 'raw_tcp' : routingMode === 'no_ssl' ? 'internal_only' : 'ssl_with_proxy';
      await api.deployments.updateConfig(deploymentId, {
        exposureMode: mode,
        internalPort: publishedPort,
      });
      toast(
        routingMode === 'direct'
          ? `Direct Mode enabled! Bound container to host port ${publishedPort}`
          : routingMode === 'no_ssl'
          ? 'HTTP-Only Mode enabled (No SSL redirect).'
          : 'Proxied Mode enabled! Traffic routed via secure HTTPS proxy.',
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Failed to update routing mode', 'error');
    } finally {
      setUpdatingRouting(false);
    }
  }

  function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    const newRule: FirewallRule = {
      id: `rule-${Date.now()}`,
      action,
      protocol,
      port,
      sourceCidr,
      description,
    };
    setRules((prev) => [newRule, ...prev]);
    toast(`Firewall rule added: ${action} ${protocol}:${port}`, 'success');
    setShowAddRuleModal(false);
    setDescription('');
  }

  function handleDeleteRule(ruleId: string) {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast('Firewall rule deleted.', 'info');
  }

  return (
    <div className="space-y-6">
      {/* Routing Mode Selector */}
      <Card title="Traffic Routing Mode & Network Ports" description="Select how inbound traffic is routed to your server container.">
        <form onSubmit={handleSaveRouting} className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Option 1: Proxied */}
            <div
              onClick={() => setRoutingMode('proxied')}
              className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-2 ${
                routingMode === 'proxied'
                  ? 'bg-accent-cyan/15 border-accent-cyan text-white shadow-lg'
                  : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between">
                <IconShield size={22} className="text-accent-cyan" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Recommended
                </span>
              </div>
              <h4 className="text-xs font-semibold text-white">Proxied (Auto SSL)</h4>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Reverse proxied automatically. Free automatic HTTPS certificates and DDoS protection.
              </p>
            </div>

            {/* Option 2: Direct */}
            <div
              onClick={() => setRoutingMode('direct')}
              className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-2 ${
                routingMode === 'direct'
                  ? 'bg-accent-violet/15 border-accent-violet text-white shadow-lg'
                  : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between">
                <IconTerminal size={22} className="text-accent-violet" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-accent-violet/20 text-accent-violet">
                  Raw TCP / UDP
                </span>
              </div>
              <h4 className="text-xs font-semibold text-white">Direct (Non-Proxied)</h4>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Direct host port mapping without proxying. Ideal for game servers (Minecraft, CS:GO), database listeners, or raw sockets.
              </p>
            </div>

            {/* Option 3: No SSL */}
            <div
              onClick={() => setRoutingMode('no_ssl')}
              className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-2 ${
                routingMode === 'no_ssl'
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg'
                  : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between">
                <IconUnlock size={22} className="text-amber-400" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  HTTP Only
                </span>
              </div>
              <h4 className="text-xs font-semibold text-white">No SSL (HTTP Only)</h4>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Plain HTTP proxying without SSL redirect or TLS certificate provisioning.
              </p>
            </div>
          </div>

          {/* Direct Port Binding Field */}
          {routingMode === 'direct' && (
            <div className="p-4 border border-accent-violet/30 rounded-2xl bg-accent-violet/10 space-y-2">
              <label className="text-xs font-semibold text-white block">Host Published Port</label>
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  type="number"
                  value={publishedPort}
                  onChange={(e) => setPublishedPort(parseInt(e.target.value) || 8080)}
                  placeholder="25565"
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
                />
                <span className="text-xs font-mono text-text-muted">TCP/UDP</span>
              </div>
              <p className="text-[11px] text-text-muted">
                External clients connect to: <code className="text-accent-cyan font-mono">YOUR_NODE_IP:{publishedPort}</code>
              </p>
            </div>
          )}

          <div className="flex justify-end border-t border-white/10 pt-4">
            <Button type="submit" size="sm" loading={updatingRouting}>
              Save Routing Settings
            </Button>
          </div>
        </form>
      </Card>

      {/* Firewall Rules Manager */}
      <Card
        title="Firewall Access Rules"
        description="Configure port access and IP whitelist/blacklist security rules for your node container."
        action={<Button size="sm" onClick={() => setShowAddRuleModal(true)}>+ Add Rule</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-text-muted border-b border-white/10 uppercase font-mono">
              <tr>
                <th className="p-3">Action</th>
                <th className="p-3">Protocol</th>
                <th className="p-3">Port / Range</th>
                <th className="p-3">Source CIDR</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.action === 'ALLOW' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="p-3 text-text-muted">{r.protocol}</td>
                  <td className="p-3 text-white font-bold">{r.port}</td>
                  <td className="p-3 text-accent-cyan">{r.sourceCidr}</td>
                  <td className="p-3 text-text-muted font-sans">{r.description || '—'}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(r.id)}
                      className="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Firewall Rule Modal */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-white">Add Firewall Security Rule</h3>
            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                >
                  <option value="ALLOW">ALLOW (Permit traffic)</option>
                  <option value="DENY">DENY (Block traffic)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Protocol</label>
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                >
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                  <option value="BOTH">TCP + UDP</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Port or Port Range</label>
                <input
                  required
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="e.g. 8080 or 25565-25575"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Source IP / CIDR</label>
                <input
                  required
                  value={sourceCidr}
                  onChange={(e) => setSourceCidr(e.target.value)}
                  placeholder="0.0.0.0/0 (Anywhere)"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Description (Optional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Minecraft server port"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddRuleModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Add Rule</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
