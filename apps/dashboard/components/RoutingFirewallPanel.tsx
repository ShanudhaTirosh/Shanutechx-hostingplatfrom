'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, DeploymentExposure, ExposureModeUi } from '@/lib/api';
import { Card, Button, Badge, useToast } from '@/components/ui';
import { IconShield, IconTerminal, IconUnlock } from '@/components/Icons';

export type RoutingMode = ExposureModeUi;

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
}

const MIN_PORT = 1024;
const MODE_LABEL: Record<ExposureModeUi, string> = { proxied: 'Proxied (HTTPS)', direct_port: 'Direct port', internal: 'Internal only' };

export function RoutingFirewallPanel({ deploymentId }: Props) {
  const [current, setCurrent] = useState<DeploymentExposure | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routingMode, setRoutingMode] = useState<ExposureModeUi>('proxied');
  const [publishedPort, setPublishedPort] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [updatingRouting, setUpdatingRouting] = useState(false);
  const [pendingRedeploy, setPendingRedeploy] = useState(false);

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

  async function loadExposure() {
    try {
      const r = await api.exposure.get(deploymentId);
      setCurrent(r.exposure);
      setCanEdit(r.canEdit);
      setRoutingMode(r.exposure.mode);
      setPublishedPort(r.exposure.publishedPort ? String(r.exposure.publishedPort) : '');
      setConfirmText('');
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the current exposure.');
    }
  }

  useEffect(() => {
    void loadExposure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId]);

  const portNumber = publishedPort.trim() === '' ? null : Number(publishedPort);
  const portError =
    routingMode !== 'direct_port'
      ? null
      : portNumber === null
      ? 'Choose a port.'
      : !Number.isInteger(portNumber) || portNumber < MIN_PORT || portNumber > 65535
      ? `Use a whole number between ${MIN_PORT} and 65535.`
      : null;
  const changed = current !== null && (routingMode !== current.mode || (routingMode === 'direct_port' && portNumber !== current.publishedPort));
  const closesSomething = current !== null && changed && ((current.mode === 'direct_port' && routingMode !== 'direct_port') || (current.mode === 'proxied' && routingMode !== 'proxied'));
  const needsConfirm = Boolean(current?.requiresConfirm) && changed;
  const confirmOk = !needsConfirm || confirmText.trim() === current?.confirmName;

  async function handleSaveRouting(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !changed || portError || !confirmOk) return;
    setUpdatingRouting(true);
    try {
      const res = await api.exposure.update(deploymentId, {
        mode: routingMode,
        publishedPort: routingMode === 'direct_port' ? portNumber : null,
        confirm: needsConfirm ? confirmText.trim() : undefined,
      });
      setPendingRedeploy(res.requiresRedeploy);
      toast(
        res.requiresRedeploy
          ? 'Saved. The running container keeps its current routing until you redeploy it.'
          : 'Saved.',
        'success'
      );
      await loadExposure();
    } catch (err) {
      toast(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to update exposure', 'error');
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
    toast(`Added to this preview list only (${action} ${protocol}:${port}). It is not saved or enforced.`, 'info');
    setShowAddRuleModal(false);
    setDescription('');
  }

  function handleDeleteRule(ruleId: string) {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast('Removed from the preview list. Nothing was changed on the node.', 'info');
  }

  return (
    <div className="space-y-6">
      {/* Exposure */}
      <Card title="How this deployment is reachable" description="Choose how traffic reaches your container. A change is saved now and takes effect when the deployment is redeployed.">
        {loadError && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{loadError}</p>}
        {current && (
          <p className="mb-4 text-xs text-text-muted">
            Currently: <span className="font-semibold text-white">{MODE_LABEL[current.mode]}</span>
            {current.mode === 'proxied' && current.url && <> at <code className="font-mono text-accent-cyan">{current.url}</code></>}
            {current.mode === 'direct_port' && current.hostPort && <> on host port <code className="font-mono text-accent-cyan">{current.hostPort}</code></>}
          </p>
        )}
        {current?.issues.map((i) => (
          <p key={i.code + i.message} className={`mb-2 rounded-xl border p-3 text-xs ${i.severity === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
            {i.message}
          </p>
        ))}
        {pendingRedeploy && (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Saved, but not applied yet: the running container still uses its previous routing. Redeploy to apply it.
          </p>
        )}
        {!canEdit && current && <p className="mb-4 text-xs text-text-muted">Only dev superusers can change how a deployment is exposed.</p>}

        <form onSubmit={handleSaveRouting} className="space-y-6">
          <fieldset disabled={!canEdit || !current} className="grid md:grid-cols-3 gap-4 disabled:opacity-60">
            <div
              onClick={() => setRoutingMode('proxied')}
              className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-2 ${routingMode === 'proxied' ? 'bg-accent-cyan/15 border-accent-cyan text-white shadow-lg' : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04]'}`}
            >
              <div className="flex items-center justify-between">
                <IconShield size={22} className="text-accent-cyan" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Recommended</span>
              </div>
              <h4 className="text-xs font-semibold text-white">Proxied (HTTPS)</h4>
              <p className="text-[11px] text-text-muted leading-relaxed">Public HTTPS address through the reverse proxy, with automatic certificates.</p>
            </div>

            <div
              onClick={() => setRoutingMode('direct_port')}
              className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-2 ${routingMode === 'direct_port' ? 'bg-accent-violet/15 border-accent-violet text-white shadow-lg' : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04]'}`}
            >
              <div className="flex items-center justify-between">
                <IconTerminal size={22} className="text-accent-violet" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-accent-violet/20 text-accent-violet">Raw TCP / UDP</span>
              </div>
              <h4 className="text-xs font-semibold text-white">Direct port</h4>
              <p className="text-[11px] text-text-muted leading-relaxed">A port on the node, bypassing the proxy. For game servers, database listeners and raw sockets. The port is open to the internet.</p>
            </div>

            <div
              onClick={() => setRoutingMode('internal')}
              className={`p-4 border rounded-2xl cursor-pointer transition-all space-y-2 ${routingMode === 'internal' ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg' : 'bg-white/[0.02] border-white/10 text-text-muted hover:bg-white/[0.04]'}`}
            >
              <div className="flex items-center justify-between">
                <IconUnlock size={22} className="text-amber-400" />
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Private</span>
              </div>
              <h4 className="text-xs font-semibold text-white">Internal only</h4>
              <p className="text-[11px] text-text-muted leading-relaxed">No public address and no open port. Use this to close public access.</p>
            </div>
          </fieldset>

          {routingMode === 'direct_port' && (
            <div className="p-4 border border-accent-violet/30 rounded-2xl bg-accent-violet/10 space-y-2">
              <label className="text-xs font-semibold text-white block" htmlFor="published-port">Host port</label>
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  id="published-port"
                  type="number"
                  min={MIN_PORT}
                  max={65535}
                  disabled={!canEdit}
                  value={publishedPort}
                  onChange={(e) => setPublishedPort(e.target.value)}
                  placeholder="25565"
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
                <span className="text-xs font-mono text-text-muted">TCP/UDP</span>
              </div>
              {portError ? (
                <p className="text-[11px] text-red-300">{portError}</p>
              ) : (
                <p className="text-[11px] text-text-muted">
                  Clients connect to: <code className="text-accent-cyan font-mono">YOUR_NODE_IP:{publishedPort || '…'}</code>. This is separate from the port your app listens on inside the container.
                </p>
              )}
            </div>
          )}

          {closesSomething && current && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {current.mode === 'direct_port'
                ? `This closes host port ${current.hostPort ?? ''}. Anything connected to it is disconnected when the deployment is redeployed.`
                : 'This removes the public HTTPS address when the deployment is redeployed.'}
            </p>
          )}

          {needsConfirm && current && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white block" htmlFor="confirm-exposure">
                This deployment is running. Type <code className="font-mono text-accent-cyan">{current.confirmName}</code> to confirm.
              </label>
              <input
                id="confirm-exposure"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="w-full max-w-xs bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end border-t border-white/10 pt-4">
            <Button type="submit" size="sm" loading={updatingRouting} disabled={!canEdit || !changed || Boolean(portError) || !confirmOk}>
              Save exposure
            </Button>
          </div>
        </form>
      </Card>

      {/* Firewall Rules Manager */}
      <Card
        title="Firewall Access Rules (preview, not enforced)"
        description="These rules are a local sketch. They are not saved and are not applied to the node, so they do not restrict any traffic."
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
