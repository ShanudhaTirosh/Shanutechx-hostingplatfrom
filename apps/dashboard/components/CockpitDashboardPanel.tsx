'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button, Input, Modal, useToast } from './ui';
import { api } from '@/lib/api';

import { Server, Activity, Settings, User, Box, Shield, Terminal } from 'lucide-react';

// CRITICAL: @xterm/xterm references `self` (browser-only global) at module load.
// A static import causes "ReferenceError: self is not defined" during Next.js SSR
// prerender. dynamic() with ssr:false defers the import to client-side only.
const SshTerminal = dynamic(
  () => import('./SshTerminal').then((m) => ({ default: m.SshTerminal })),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-text-muted text-sm animate-pulse">Loading terminal...</div> }
);

interface CockpitDashboardPanelProps {
  nodeId: string;
  nodeLabel?: string;
  ipAddress?: string;
}

export function CockpitDashboardPanel({ nodeId, nodeLabel, ipAddress }: CockpitDashboardPanelProps) {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'services' | 'users' | 'docker' | 'firewall' | 'terminal'>('monitoring');
  const [monitoringData, setMonitoringData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [firewall, setFirewall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const { toast } = useToast();

  // Modals & Active Viewers
  const [selectedLogs, setSelectedLogs] = useState<{ title: string; content: string } | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [newRulePort, setNewRulePort] = useState('');
  const [newRuleProto, setNewRuleProto] = useState<'tcp' | 'udp'>('tcp');
  const [newRuleAction, setNewRuleAction] = useState<'allow' | 'deny'>('allow');


  // Poll monitoring data
  useEffect(() => {
    fetchMonitoring();
    const interval = setInterval(fetchMonitoring, 5000);
    return () => clearInterval(interval);
  }, [nodeId]);

  useEffect(() => {
    if (activeTab === 'services') fetchServices();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'docker') fetchContainers();
    if (activeTab === 'firewall') fetchFirewall();
  }, [activeTab, nodeId]);

  async function fetchMonitoring() {
    try {
      const data = await api.cockpit.monitoring(nodeId);
      setMonitoringData(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  async function fetchServices() {
    setTabLoading(true);
    try {
      const res = await api.cockpit.services(nodeId);
      setServices(res.services || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load systemd services', 'error');
    } finally {
      setTabLoading(false);
    }
  }

  async function handleServiceAction(serviceName: string, action: string) {
    try {
      await api.cockpit.serviceAction(nodeId, serviceName, action);
      toast(`Service ${serviceName} ${action}ed successfully`, 'success');
      fetchServices();
    } catch (err: any) {
      toast(err.message || `Failed to ${action} service`, 'error');
    }
  }

  async function viewServiceLogs(serviceName: string) {
    try {
      const res = await api.cockpit.serviceLogs(nodeId, serviceName, 150);
      setSelectedLogs({ title: `Journalctl Logs: ${serviceName}`, content: res.logs || 'No log output returned' });
    } catch (err: any) {
      toast(err.message || 'Failed to fetch service logs', 'error');
    }
  }

  async function fetchUsers() {
    setTabLoading(true);
    try {
      const res = await api.cockpit.users(nodeId);
      setUsers(res.users || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load Linux user accounts', 'error');
    } finally {
      setTabLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!newUsername.trim()) return toast('Username is required', 'error');
    try {
      await api.cockpit.createUser(nodeId, { username: newUsername.trim(), password: newUserPassword });
      toast(`Linux user ${newUsername} created successfully`, 'success');
      setShowCreateUserModal(false);
      setNewUsername('');
      setNewUserPassword('');
      fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Failed to create user', 'error');
    }
  }

  async function handleDeleteUser(username: string) {
    if (!confirm(`Are you sure you want to delete system user ${username}?`)) return;
    try {
      await api.cockpit.deleteUser(nodeId, username);
      toast(`User ${username} deleted`, 'success');
      fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Failed to delete user', 'error');
    }
  }

  async function fetchContainers() {
    setTabLoading(true);
    try {
      const res = await api.cockpit.containers(nodeId);
      setContainers(res.containers || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load Docker containers', 'error');
    } finally {
      setTabLoading(false);
    }
  }

  async function handleContainerAction(containerId: string, action: string) {
    try {
      await api.cockpit.containerAction(nodeId, containerId, action);
      toast(`Container ${action}ed successfully`, 'success');
      fetchContainers();
    } catch (err: any) {
      toast(err.message || `Failed to ${action} container`, 'error');
    }
  }

  async function viewContainerLogs(containerId: string, name: string) {
    try {
      const res = await api.cockpit.containerLogs(nodeId, containerId, 200);
      setSelectedLogs({ title: `Docker Container Logs: ${name}`, content: res.logs || 'No logs recorded' });
    } catch (err: any) {
      toast(err.message || 'Failed to fetch container logs', 'error');
    }
  }

  async function fetchFirewall() {
    setTabLoading(true);
    try {
      const res = await api.cockpit.firewallStatus(nodeId);
      setFirewall(res);
    } catch (err: any) {
      toast(err.message || 'Failed to fetch firewall status', 'error');
    } finally {
      setTabLoading(false);
    }
  }

  async function handleAddRule() {
    if (!newRulePort) return toast('Port number required', 'error');
    try {
      await api.cockpit.addFirewallRule(nodeId, {
        port: Number(newRulePort),
        protocol: newRuleProto,
        action: newRuleAction,
      });
      toast(`Firewall rule added: ${newRuleAction} ${newRulePort}/${newRuleProto}`, 'success');
      setShowAddRuleModal(false);
      setNewRulePort('');
      fetchFirewall();
    } catch (err: any) {
      toast(err.message || 'Failed to add firewall rule', 'error');
    }
  }

  async function handleDeleteRule(port: string, protocol: string) {
    try {
      await api.cockpit.deleteFirewallRule(nodeId, port, protocol);
      toast(`Rule deleted: ${port}/${protocol}`, 'success');
      fetchFirewall();
    } catch (err: any) {
      toast(err.message || 'Failed to delete rule', 'error');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-5 rounded-2xl border border-white/[0.08]">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Server className="h-5 w-5 text-accent-violet" /> Server Cockpit: <span className="text-accent-violet">{nodeLabel || nodeId}</span>
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            IP: {ipAddress || 'Internal'} • Real-time Monitoring &amp; System Administration
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-black/40 p-1.5 rounded-xl border border-white/[0.06]">
          {[
            { id: 'monitoring', label: 'Monitoring', icon: Activity },
            { id: 'services', label: 'Services', icon: Settings },
            { id: 'users', label: 'Users', icon: User },
            { id: 'docker', label: 'Docker', icon: Box },
            { id: 'firewall', label: 'Firewall', icon: Shield },
            { id: 'terminal', label: 'Terminal', icon: Terminal },
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-accent-violet text-white shadow-glow-violet'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.05]'
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: System Monitoring */}
      {activeTab === 'monitoring' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-text-muted text-sm animate-pulse">Loading system metrics...</div>
          ) : monitoringData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CPU Usage Card */}
              <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-2">
                <div className="flex justify-between items-center text-xs text-text-muted">
                  <span>CPU Usage ({monitoringData.cpu?.cores} Cores)</span>
                  <span className="font-mono text-emerald-400">{monitoringData.cpu?.usagePct}%</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden border border-white/10">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, monitoringData.cpu?.usagePct || 0)}%` }}
                  />
                </div>
                <p className="text-[11px] text-text-muted font-mono truncate">{monitoringData.cpu?.brand}</p>
              </div>

              {/* Memory Card */}
              <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-2">
                <div className="flex justify-between items-center text-xs text-text-muted">
                  <span>RAM Usage</span>
                  <span className="font-mono text-indigo-400">{monitoringData.memory?.usedPct}%</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden border border-white/10">
                  <div
                    className="bg-indigo-400 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, monitoringData.memory?.usedPct || 0)}%` }}
                  />
                </div>
                <p className="text-[11px] text-text-muted font-mono">
                  {monitoringData.memory?.usedMb} MB / {monitoringData.memory?.totalMb} MB Used
                </p>
              </div>

              {/* System Stats Card */}
              <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-1 text-xs">
                <div className="flex justify-between text-text-muted">
                  <span>System Uptime:</span>
                  <span className="font-mono text-text-primary">{Math.floor(monitoringData.uptimeSeconds / 3600)} hrs</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Load Average:</span>
                  <span className="font-mono text-text-primary">{monitoringData.loadAverage}</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Disks Attached:</span>
                  <span className="font-mono text-text-primary">{monitoringData.disks?.length || 1} volumes</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted text-sm">System information agent not responding</div>
          )}
        </div>
      )}

      {/* Tab 2: Systemd Services */}
      {activeTab === 'services' && (
        <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-primary">Systemd Services ({services.length})</h3>
            <Button size="sm" variant="ghost" onClick={fetchServices}>↻ Refresh</Button>
          </div>
          {tabLoading ? (
            <div className="py-10 text-center text-text-muted text-xs animate-pulse">Loading services...</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="p-3">Service Unit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {services.map((svc) => (
                  <tr key={svc.name} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-text-primary font-medium">{svc.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        svc.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {svc.status}
                      </span>
                    </td>
                    <td className="p-3 text-text-muted truncate max-w-xs">{svc.description}</td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => viewServiceLogs(svc.name)} className="text-indigo-400 hover:underline">Logs</button>
                      <button onClick={() => handleServiceAction(svc.name, 'restart')} className="text-amber-400 hover:underline">Restart</button>
                      {svc.status === 'active' ? (
                        <button onClick={() => handleServiceAction(svc.name, 'stop')} className="text-red-400 hover:underline">Stop</button>
                      ) : (
                        <button onClick={() => handleServiceAction(svc.name, 'start')} className="text-emerald-400 hover:underline">Start</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 3: Linux User Management */}
      {activeTab === 'users' && (
        <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-primary">System Users ({users.length})</h3>
            <Button size="sm" variant="primary" onClick={() => setShowCreateUserModal(true)}>+ Create User</Button>
          </div>
          {tabLoading ? (
            <div className="py-10 text-center text-text-muted text-xs animate-pulse">Loading users...</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="p-3">Username</th>
                  <th className="p-3">UID</th>
                  <th className="p-3">Home Directory</th>
                  <th className="p-3">Shell</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((u) => (
                  <tr key={u.username} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-mono font-semibold text-text-primary">{u.username}</td>
                    <td className="p-3 font-mono text-text-muted">{u.uid}</td>
                    <td className="p-3 font-mono text-text-muted">{u.home}</td>
                    <td className="p-3 font-mono text-text-muted">{u.shell}</td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => handleDeleteUser(u.username)} className="text-red-400 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 4: Docker Containers */}
      {activeTab === 'docker' && (
        <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-primary">Docker Containers ({containers.length})</h3>
            <Button size="sm" variant="ghost" onClick={fetchContainers}>↻ Refresh</Button>
          </div>
          {tabLoading ? (
            <div className="py-10 text-center text-text-muted text-xs animate-pulse">Loading containers...</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="p-3">Container Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Image</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {containers.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-text-primary font-semibold">{c.names.join(', ')}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        c.state === 'running' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-text-muted truncate max-w-xs">{c.image}</td>
                    <td className="p-3 text-right space-x-2">
                      <button onClick={() => viewContainerLogs(c.id, c.names[0])} className="text-indigo-400 hover:underline">Logs</button>
                      <button onClick={() => handleContainerAction(c.id, 'restart')} className="text-amber-400 hover:underline">Restart</button>
                      {c.state === 'running' ? (
                        <button onClick={() => handleContainerAction(c.id, 'stop')} className="text-red-400 hover:underline">Stop</button>
                      ) : (
                        <button onClick={() => handleContainerAction(c.id, 'start')} className="text-emerald-400 hover:underline">Start</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 5: Network Firewall */}
      {activeTab === 'firewall' && (
        <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Network Firewall</h3>
              <p className="text-xs text-text-muted">Status: {firewall?.active ? '🟢 Active' : '🔴 Inactive'}</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setShowAddRuleModal(true)}>+ Add Rule</Button>
          </div>
          {tabLoading ? (
            <div className="py-10 text-center text-text-muted text-xs animate-pulse">Loading firewall rules...</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-text-muted">
                  <th className="p-3">Port / Protocol</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">From Source</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {firewall?.rules?.map((r: any, idx: number) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-text-primary font-semibold">{r.to}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        r.action.toLowerCase().includes('allow') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-text-muted">{r.from}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteRule(r.to.split('/')[0], r.to.split('/')[1] || 'tcp')}
                        className="text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 6: Interactive Terminal */}
      {activeTab === 'terminal' && (
        <SshTerminal kind="node" id={nodeId} onClose={() => setActiveTab('monitoring')} />
      )}

      {/* Modals */}
      {selectedLogs && (
        <Modal open={true} onClose={() => setSelectedLogs(null)} title={selectedLogs.title} width="max-w-4xl">
          <pre className="bg-black/90 p-4 rounded-xl font-mono text-xs text-emerald-400 max-h-[60vh] overflow-y-auto whitespace-pre-wrap">
            {selectedLogs.content}
          </pre>
        </Modal>
      )}

      {showCreateUserModal && (
        <Modal open={true} onClose={() => setShowCreateUserModal(false)} title="Create System Linux User" width="max-w-md">
          <div className="space-y-4">
            <Input placeholder="Username (e.g. devuser)" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <Input type="password" placeholder="Initial Password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateUserModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateUser}>Create User</Button>
            </div>
          </div>
        </Modal>
      )}

      {showAddRuleModal && (
        <Modal open={true} onClose={() => setShowAddRuleModal(false)} title="Add Network Firewall Rule" width="max-w-md">
          <div className="space-y-4">
            <Input placeholder="Port Number (1-65535)" value={newRulePort} onChange={(e) => setNewRulePort(e.target.value)} />
            <div className="flex gap-4 text-xs text-text-muted">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="proto" checked={newRuleProto === 'tcp'} onChange={() => setNewRuleProto('tcp')} /> TCP
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="proto" checked={newRuleProto === 'udp'} onChange={() => setNewRuleProto('udp')} /> UDP
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowAddRuleModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleAddRule}>Add Rule</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
