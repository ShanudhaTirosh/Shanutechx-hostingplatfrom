'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button, Input, Modal, useToast } from './ui';
import { api } from '@/lib/api';

import { Server, Activity, Settings, User, Box, Shield, Terminal, Download, Cpu, HardDrive, Network, RefreshCw, Trash2, Plus, Code } from 'lucide-react';

const SshTerminal = dynamic(
  () => import('./SshTerminal').then((m) => ({ default: m.SshTerminal })),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-text-muted text-sm animate-pulse">Loading Web SSH terminal...</div> }
);

interface NodeEngineControlPanelProps {
  nodeId: string;
  nodeLabel?: string;
  ipAddress?: string;
}

export function NodeEngineControlPanel({ nodeId, nodeLabel, ipAddress }: NodeEngineControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'terminal' | 'system' | 'ports' | 'docker' | 'users'>('overview');
  const [monitoringData, setMonitoringData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [listeningPorts, setListeningPorts] = useState<any[]>([]);
  const [firewall, setFirewall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const { toast } = useToast();

  // Modals & Sub-views
  const [selectedLogs, setSelectedLogs] = useState<{ title: string; content: string } | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [newRulePort, setNewRulePort] = useState('');
  const [newRuleProto, setNewRuleProto] = useState<'tcp' | 'udp'>('tcp');
  const [newRuleAction, setNewRuleAction] = useState<'allow' | 'deny'>('allow');

  // Package Installer & System Upgrade
  const [pkgName, setPkgName] = useState('');
  const [pkgBusy, setPkgBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  // Docker Container Creation & Compose
  const [showCreateContainerModal, setShowCreateContainerModal] = useState(false);
  const [cName, setCName] = useState('');
  const [cImage, setCImage] = useState('');
  const [cEnv, setCEnv] = useState('');
  const [cPorts, setCPorts] = useState('');
  const [cVolumes, setCVolumes] = useState('');
  const [cNetwork, setCNetwork] = useState('bridge');
  const [cBusy, setCBusy] = useState(false);

  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeProject, setComposeProject] = useState('my-stack');
  const [composeYaml, setComposeYaml] = useState('version: "3.8"\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n');
  const [composeBusy, setComposeBusy] = useState(false);

  const [showCreateNetModal, setShowCreateNetModal] = useState(false);
  const [netName, setNetName] = useState('');
  const [netDriver, setNetDriver] = useState('bridge');

  // Fetch telemetry
  useEffect(() => {
    fetchMonitoring();
    const interval = setInterval(fetchMonitoring, 5000);
    return () => clearInterval(interval);
  }, [nodeId]);

  useEffect(() => {
    if (activeTab === 'system') {
      fetchServices();
    }
    if (activeTab === 'ports') {
      fetchPortsAndFirewall();
    }
    if (activeTab === 'docker') {
      fetchDockerData();
    }
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, nodeId]);

  async function fetchMonitoring() {
    try {
      const data = await api.nodeEngine.monitoring(nodeId);
      setMonitoringData(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  async function fetchServices() {
    setTabLoading(true);
    try {
      const res = await api.nodeEngine.services(nodeId);
      setServices(res.services || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load systemd services', 'error');
    } finally {
      setTabLoading(false);
    }
  }

  async function handleServiceAction(serviceName: string, action: string) {
    try {
      await api.nodeEngine.serviceAction(nodeId, serviceName, action);
      toast(`Service ${serviceName} ${action}ed successfully`, 'success');
      fetchServices();
    } catch (err: any) {
      toast(err.message || `Failed to ${action} service`, 'error');
    }
  }

  async function viewServiceLogs(serviceName: string) {
    try {
      const res = await api.nodeEngine.serviceLogs(nodeId, serviceName, 150);
      setSelectedLogs({ title: `Journalctl Logs: ${serviceName}`, content: res.logs || 'No log output returned' });
    } catch (err: any) {
      toast(err.message || 'Failed to fetch service logs', 'error');
    }
  }

  async function handleInstallPackage() {
    if (!pkgName.trim()) return toast('Package name is required', 'error');
    setPkgBusy(true);
    try {
      const res = await api.nodeEngine.installPackage(nodeId, pkgName.trim());
      setSelectedLogs({ title: `Package Installation Output: ${pkgName}`, content: res.output || 'Package installed successfully' });
      toast(`Package ${pkgName} installed successfully`, 'success');
      setPkgName('');
    } catch (err: any) {
      toast(err.message || 'Package installation failed', 'error');
    } finally {
      setPkgBusy(false);
    }
  }

  async function handleUpgradePackages() {
    if (!confirm('Start 1-Click System Package Upgrade (apt update && apt upgrade -y)?')) return;
    setUpgradeBusy(true);
    try {
      const res = await api.nodeEngine.upgradePackages(nodeId);
      setSelectedLogs({ title: '1-Click System Package Upgrade Output', content: res.output || 'System packages upgraded successfully' });
      toast('System packages upgraded successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'System upgrade failed', 'error');
    } finally {
      setUpgradeBusy(false);
    }
  }

  async function fetchPortsAndFirewall() {
    setTabLoading(true);
    try {
      const [portsRes, fwRes] = await Promise.all([
        api.nodeEngine.listeningPorts(nodeId).catch(() => ({ ports: [] })),
        api.nodeEngine.firewallStatus(nodeId).catch(() => null),
      ]);
      setListeningPorts(portsRes.ports || []);
      setFirewall(fwRes);
    } catch (err: any) {
      toast('Failed to load networking data', 'error');
    } finally {
      setTabLoading(false);
    }
  }

  async function handleAddRule() {
    if (!newRulePort) return toast('Port number required', 'error');
    try {
      await api.nodeEngine.addFirewallRule(nodeId, {
        port: Number(newRulePort),
        protocol: newRuleProto,
        action: newRuleAction,
      });
      toast(`Firewall rule added: ${newRuleAction} ${newRulePort}/${newRuleProto}`, 'success');
      setShowAddRuleModal(false);
      setNewRulePort('');
      fetchPortsAndFirewall();
    } catch (err: any) {
      toast(err.message || 'Failed to add firewall rule', 'error');
    }
  }

  async function handleDeleteRule(port: string, protocol: string) {
    try {
      await api.nodeEngine.deleteFirewallRule(nodeId, port, protocol);
      toast(`Rule deleted: ${port}/${protocol}`, 'success');
      fetchPortsAndFirewall();
    } catch (err: any) {
      toast(err.message || 'Failed to delete rule', 'error');
    }
  }

  async function fetchDockerData() {
    setTabLoading(true);
    try {
      const [cRes, nRes] = await Promise.all([
        api.nodeEngine.containers(nodeId).catch(() => ({ containers: [] })),
        api.nodeEngine.networks(nodeId).catch(() => ({ networks: [] })),
      ]);
      setContainers(cRes.containers || []);
      setNetworks(nRes.networks || []);
    } catch (err: any) {
      toast('Failed to fetch Docker engine data', 'error');
    } finally {
      setTabLoading(false);
    }
  }

  async function handleContainerAction(containerId: string, action: string) {
    try {
      await api.nodeEngine.containerAction(nodeId, containerId, action);
      toast(`Container ${action}ed successfully`, 'success');
      fetchDockerData();
    } catch (err: any) {
      toast(err.message || `Failed to ${action} container`, 'error');
    }
  }

  async function viewContainerLogs(containerId: string, name: string) {
    try {
      const res = await api.nodeEngine.containerLogs(nodeId, containerId, 200);
      setSelectedLogs({ title: `Docker Container Logs: ${name}`, content: res.logs || 'No logs recorded' });
    } catch (err: any) {
      toast(err.message || 'Failed to fetch container logs', 'error');
    }
  }

  async function handleCreateContainer() {
    if (!cName.trim() || !cImage.trim()) return toast('Container name and image are required', 'error');
    setCBusy(true);
    try {
      const envArr = cEnv.split('\n').map((s) => s.trim()).filter(Boolean);
      const portArr = cPorts.split('\n').map((s) => s.trim()).filter(Boolean).map((p) => {
        const parts = p.split(':');
        return { hostPort: Number(parts[0]), containerPort: Number(parts[1] || parts[0]) };
      });
      const volArr = cVolumes.split('\n').map((s) => s.trim()).filter(Boolean).map((v) => {
        const parts = v.split(':');
        return { hostPath: parts[0], containerPath: parts[1] || parts[0] };
      });

      await api.nodeEngine.createContainer(nodeId, {
        name: cName.trim(),
        image: cImage.trim(),
        env: envArr,
        ports: portArr,
        volumes: volArr,
        network: cNetwork,
      });

      toast(`Container ${cName} created and launched!`, 'success');
      setShowCreateContainerModal(false);
      setCName('');
      setCImage('');
      setCEnv('');
      setCPorts('');
      setCVolumes('');
      fetchDockerData();
    } catch (err: any) {
      toast(err.message || 'Container creation failed', 'error');
    } finally {
      setCBusy(false);
    }
  }

  async function handleDeployCompose() {
    if (!composeProject.trim() || !composeYaml.trim()) return toast('Project name and YAML content required', 'error');
    setComposeBusy(true);
    try {
      const res = await api.nodeEngine.deployCompose(nodeId, composeYaml, composeProject.trim());
      setSelectedLogs({ title: `Docker Compose Deployment Output: ${composeProject}`, content: res.output || 'Stack deployed successfully' });
      toast(`Docker Compose stack ${composeProject} deployed!`, 'success');
      setShowComposeModal(false);
      fetchDockerData();
    } catch (err: any) {
      toast(err.message || 'Compose deployment failed', 'error');
    } finally {
      setComposeBusy(false);
    }
  }

  async function handleCreateNetwork() {
    if (!netName.trim()) return toast('Network name required', 'error');
    try {
      await api.nodeEngine.createNetwork(nodeId, netName.trim(), netDriver);
      toast(`Docker network ${netName} created`, 'success');
      setShowCreateNetModal(false);
      setNetName('');
      fetchDockerData();
    } catch (err: any) {
      toast(err.message || 'Network creation failed', 'error');
    }
  }

  async function handlePruneDocker() {
    if (!confirm('Prune all stopped containers and unused Docker images on this host node?')) return;
    try {
      const res = await api.nodeEngine.pruneDocker(nodeId);
      toast(`Docker cleanup: Pruned ${res.containersPruned} containers & ${res.imagesPruned} images`, 'success');
      fetchDockerData();
    } catch (err: any) {
      toast(err.message || 'Docker prune failed', 'error');
    }
  }

  async function fetchUsers() {
    setTabLoading(true);
    try {
      const res = await api.nodeEngine.users(nodeId);
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
      await api.nodeEngine.createUser(nodeId, { username: newUsername.trim(), password: newUserPassword });
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
      await api.nodeEngine.deleteUser(nodeId, username);
      toast(`User ${username} deleted`, 'success');
      fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Failed to delete user', 'error');
    }
  }

  const netStats = monitoringData?.network;
  const bandwidthPct = netStats?.usedPct || 0;
  const usedGb = netStats?.totalUsedGb || 0;
  const limitGb = netStats?.monthlyLimitGb || 30000;

  return (
    <div className="space-y-6">
      {/* Control Panel Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-5 rounded-2xl border border-white/[0.08]">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Server className="h-5 w-5 text-accent-violet" /> Host Node Engine: <span className="text-accent-violet">{nodeLabel || nodeId}</span>
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            IP: {ipAddress || 'Internal'} • Real-time Monitoring &amp; Docker Container Engine Orchestrator
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-black/40 p-1.5 rounded-xl border border-white/[0.06]">
          {[
            { id: 'overview', label: 'Overview & 30TB Quota', icon: Activity },
            { id: 'terminal', label: 'Web SSH', icon: Terminal },
            { id: 'system', label: 'System & Packages', icon: Settings },
            { id: 'ports', label: 'Ports & Firewall', icon: Shield },
            { id: 'docker', label: 'Containers & Compose', icon: Box },
            { id: 'users', label: 'Linux Users', icon: User },
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-accent-violet text-white shadow-md'
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

      {/* TAB 1: OVERVIEW & 30TB BANDWIDTH TELEMETRY */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-text-muted text-sm animate-pulse">Loading Node Engine metrics...</div>
          ) : monitoringData ? (
            <>
              {/* Top Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* CPU Usage */}
                <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-2">
                  <div className="flex justify-between items-center text-xs text-text-muted font-medium">
                    <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> CPU Usage ({monitoringData.cpu?.cores} Cores)</span>
                    <span className="font-mono text-emerald-400 font-bold">{monitoringData.cpu?.usagePct}%</span>
                  </div>
                  <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden border border-white/10">
                    <div
                      className="bg-emerald-400 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, monitoringData.cpu?.usagePct || 0)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted font-mono truncate">{monitoringData.cpu?.brand}</p>
                </div>

                {/* RAM Memory */}
                <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-2">
                  <div className="flex justify-between items-center text-xs text-text-muted font-medium">
                    <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-white" /> RAM Memory</span>
                    <span className="font-mono text-white font-bold">{monitoringData.memory?.usedPct}%</span>
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

                {/* Disk Storage */}
                <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-2">
                  <div className="flex justify-between items-center text-xs text-text-muted font-medium">
                    <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-amber-400" /> Storage Disk</span>
                    <span className="font-mono text-amber-400 font-bold">{monitoringData.disks?.[0]?.usedPct || 0}%</span>
                  </div>
                  <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden border border-white/10">
                    <div
                      className="bg-amber-400 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, monitoringData.disks?.[0]?.usedPct || 0)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted font-mono">
                    {monitoringData.disks?.[0]?.usedGb || 0} GB / {monitoringData.disks?.[0]?.sizeGb || 0} GB
                  </p>
                </div>

                {/* System Info */}
                <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-1 text-xs justify-center flex flex-col">
                  <div className="flex justify-between text-text-muted">
                    <span>System Uptime:</span>
                    <span className="font-mono text-text-primary">{Math.floor(monitoringData.uptimeSeconds / 3600)} hrs</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Load Average:</span>
                    <span className="font-mono text-text-primary">{monitoringData.loadAverage}</span>
                  </div>
                </div>
              </div>

              {/* 30 TB Monthly Bandwidth Telemetry Card */}
              <div className="glass p-6 rounded-2xl border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Monthly Network Bandwidth Quota Tracker</h3>
                      <p className="text-xs text-text-muted">30 TB Monthly Quota allocation per VPS Host Node</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono bg-cyan-500/10 text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/20 font-semibold">
                    {usedGb} GB / {limitGb} GB ({bandwidthPct}%)
                  </span>
                </div>

                <div className="w-full bg-black/60 rounded-full h-4 overflow-hidden border border-white/10 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      bandwidthPct > 90 ? 'bg-red-500' : bandwidthPct > 75 ? 'bg-amber-400' : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, bandwidthPct)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2">
                  <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                    <span className="text-text-muted block mb-0.5">Network Download (RX)</span>
                    <span className="font-mono text-emerald-400 font-bold">{netStats?.rxGb || 0} GB</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                    <span className="text-text-muted block mb-0.5">Network Upload (TX)</span>
                    <span className="font-mono text-cyan-400 font-bold">{netStats?.txGb || 0} GB</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                    <span className="text-text-muted block mb-0.5">Total Used Traffic</span>
                    <span className="font-mono text-text-primary font-bold">{usedGb} GB</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                    <span className="text-text-muted block mb-0.5">Remaining Monthly Traffic</span>
                    <span className="font-mono text-text-primary font-bold">{Math.max(0, limitGb - usedGb)} GB</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-text-muted text-sm">Host Node Engine agent not responding</div>
          )}
        </div>
      )}

      {/* TAB 2: WEB SSH TERMINAL */}
      {activeTab === 'terminal' && (
        <SshTerminal kind="node" id={nodeId} onClose={() => setActiveTab('overview')} />
      )}

      {/* TAB 3: SYSTEM SERVICES & PACKAGE INSTALLER/UPGRADER */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* OS Package Installer & Upgrader Toolbar */}
          <div className="glass p-5 rounded-2xl border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Download className="w-4 h-4 text-accent-violet" /> OS Package Manager &amp; 1-Click System Upgrader
            </h3>
            
            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <Input
                  label="Install System Package (e.g., git, htop, nginx, redis-tools)"
                  placeholder="Enter apt/apk package name"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" loading={pkgBusy} onClick={handleInstallPackage} disabled={!pkgName.trim()}>
                  Install Package
                </Button>
                <Button variant="secondary" loading={upgradeBusy} onClick={handleUpgradePackages}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> 1-Click System Upgrade
                </Button>
              </div>
            </div>
          </div>

          {/* Systemd Services Table */}
          <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-text-primary">Systemd Services ({services.length})</h3>
              <Button size="sm" variant="ghost" onClick={fetchServices}>↻ Refresh</Button>
            </div>
            {tabLoading ? (
              <div className="py-10 text-center text-text-muted text-xs animate-pulse">Loading system services...</div>
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
                          <button onClick={() => viewServiceLogs(svc.name)} className="text-white hover:underline">Logs</button>
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
        </div>
      )}

      {/* TAB 4: PORTS & UFW FIREWALL */}
      {activeTab === 'ports' && (
        <div className="space-y-6">
          {/* Active Listening Ports */}
          <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Open Listening Ports Detection (`ss -tulpn`)</h3>
                <p className="text-xs text-text-muted">Detected active network services bound to host interfaces</p>
              </div>
              <Button size="sm" variant="ghost" onClick={fetchPortsAndFirewall}>↻ Refresh</Button>
            </div>
            {tabLoading ? (
              <div className="py-8 text-center text-text-muted text-xs animate-pulse">Detecting listening ports...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-text-muted">
                      <th className="p-3">Protocol</th>
                      <th className="p-3">Port</th>
                      <th className="p-3">Bound Address</th>
                      <th className="p-3">Process / Daemon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {listeningPorts.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-mono font-bold text-cyan-400">{pt.protocol}</td>
                        <td className="p-3 font-mono font-bold text-text-primary">{pt.port}</td>
                        <td className="p-3 font-mono text-text-muted">{pt.address}</td>
                        <td className="p-3 font-mono text-text-muted">{pt.process || 'system'}</td>
                      </tr>
                    ))}
                    {listeningPorts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-text-muted">No open listening ports detected</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Firewall UFW Rules */}
          <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">UFW Network Firewall Rules</h3>
                <p className="text-xs text-text-muted">Status: {firewall?.active ? 'Active' : 'Inactive'}</p>
              </div>
              <Button size="sm" variant="primary" onClick={() => setShowAddRuleModal(true)}>+ Add Firewall Rule</Button>
            </div>
            {tabLoading ? (
              <div className="py-8 text-center text-text-muted text-xs animate-pulse">Loading firewall rules...</div>
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
        </div>
      )}

      {/* TAB 5: DOCKER CONTAINER ENGINE & DOCKER COMPOSE */}
      {activeTab === 'docker' && (
        <div className="space-y-6">
          {/* Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 glass p-4 rounded-2xl border border-white/[0.08]">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => setShowCreateContainerModal(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Deploy Container
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowComposeModal(true)}>
                <Code className="w-3.5 h-3.5 mr-1" /> Deploy Docker Compose YAML
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowCreateNetModal(true)}>
                <Network className="w-3.5 h-3.5 mr-1" /> Create Docker Network
              </Button>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handlePruneDocker}>
                <Trash2 className="w-3.5 h-3.5 mr-1 text-red-400" /> Prune Unused Resources
              </Button>
              <Button size="sm" variant="ghost" onClick={fetchDockerData}>↻ Refresh</Button>
            </div>
          </div>

          {/* Containers Table */}
          <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Host Docker Containers ({containers.length})</h3>
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
                          <button onClick={() => viewContainerLogs(c.id, c.names[0])} className="text-white hover:underline">Logs</button>
                          <button onClick={() => handleContainerAction(c.id, 'restart')} className="text-amber-400 hover:underline">Restart</button>
                          {c.state === 'running' ? (
                            <button onClick={() => handleContainerAction(c.id, 'stop')} className="text-red-400 hover:underline">Stop</button>
                          ) : (
                            <button onClick={() => handleContainerAction(c.id, 'start')} className="text-emerald-400 hover:underline">Start</button>
                          )}
                          <button onClick={() => handleContainerAction(c.id, 'remove')} className="text-red-400 hover:underline">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Docker Networks Table */}
          <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Docker Networks ({networks.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted">
                    <th className="p-3">Network Name</th>
                    <th className="p-3">Driver</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Network ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {networks.map((n) => (
                    <tr key={n.id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-mono font-bold text-text-primary">{n.name}</td>
                      <td className="p-3 font-mono text-cyan-400">{n.driver}</td>
                      <td className="p-3 font-mono text-text-muted">{n.scope}</td>
                      <td className="p-3 font-mono text-text-faint">{n.id?.slice(0, 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: LINUX USER ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="glass rounded-2xl p-5 border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-primary">Linux System User Accounts ({users.length})</h3>
            <Button size="sm" variant="primary" onClick={() => setShowCreateUserModal(true)}>+ Create Linux User</Button>
          </div>
          {tabLoading ? (
            <div className="py-10 text-center text-text-muted text-xs animate-pulse">Loading Linux users...</div>
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

      {/* MODALS */}
      {selectedLogs && (
        <Modal open={true} onClose={() => setSelectedLogs(null)} title={selectedLogs.title} width="max-w-4xl">
          <pre className="bg-black/90 p-4 rounded-xl font-mono text-xs text-emerald-400 max-h-[60vh] overflow-y-auto whitespace-pre-wrap">
            {selectedLogs.content}
          </pre>
        </Modal>
      )}

      {showCreateUserModal && (
        <Modal open={true} onClose={() => setShowCreateUserModal(false)} title="Create Linux System User" width="max-w-md">
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

      {/* Deploy Container Modal */}
      {showCreateContainerModal && (
        <Modal open={true} onClose={() => setShowCreateContainerModal(false)} title="Deploy Docker Container" width="max-w-lg">
          <div className="space-y-4 text-xs">
            <Input label="Container Name" placeholder="e.g. my-app" value={cName} onChange={(e) => setCName(e.target.value)} />
            <Input label="Image Tag" placeholder="e.g. nginx:latest or redis:alpine" value={cImage} onChange={(e) => setCImage(e.target.value)} />
            <div>
              <label className="text-text-muted block mb-1">Environment Variables (KEY=VALUE per line)</label>
              <textarea
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 font-mono text-xs text-text-primary"
                placeholder="NODE_ENV=production&#10;PORT=3000"
                value={cEnv}
                onChange={(e) => setCEnv(e.target.value)}
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Port Mappings (HostPort:ContainerPort per line)</label>
              <textarea
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 font-mono text-xs text-text-primary"
                placeholder="8080:80&#10;3000:3000"
                value={cPorts}
                onChange={(e) => setCPorts(e.target.value)}
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Volume Binds (HostPath:ContainerPath per line)</label>
              <textarea
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 font-mono text-xs text-text-primary"
                placeholder="/srv/data:/app/data"
                value={cVolumes}
                onChange={(e) => setCVolumes(e.target.value)}
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Docker Network</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 font-mono text-xs text-text-primary"
                value={cNetwork}
                onChange={(e) => setCNetwork(e.target.value)}
              >
                {networks.map((n) => (
                  <option key={n.id} value={n.name} className="bg-slate-900">{n.name} ({n.driver})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateContainerModal(false)}>Cancel</Button>
              <Button variant="primary" loading={cBusy} onClick={handleCreateContainer}>Deploy Container</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Deploy Compose Modal */}
      {showComposeModal && (
        <Modal open={true} onClose={() => setShowComposeModal(false)} title="Deploy Docker Compose Stack" width="max-w-2xl">
          <div className="space-y-4 text-xs">
            <Input label="Project / Stack Name" placeholder="e.g. my-app-stack" value={composeProject} onChange={(e) => setComposeProject(e.target.value)} />
            <div>
              <label className="text-text-muted block mb-1">docker-compose.yml Specification</label>
              <textarea
                rows={12}
                className="w-full bg-black/80 border border-white/10 rounded-xl p-3 font-mono text-xs text-emerald-400 focus:outline-none"
                value={composeYaml}
                onChange={(e) => setComposeYaml(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowComposeModal(false)}>Cancel</Button>
              <Button variant="primary" loading={composeBusy} onClick={handleDeployCompose}>Deploy Stack</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Docker Network Modal */}
      {showCreateNetModal && (
        <Modal open={true} onClose={() => setShowCreateNetModal(false)} title="Create Docker Network" width="max-w-md">
          <div className="space-y-4 text-xs">
            <Input label="Network Name" placeholder="e.g. internal-net" value={netName} onChange={(e) => setNetName(e.target.value)} />
            <div>
              <label className="text-text-muted block mb-1">Network Driver</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 font-mono text-xs text-text-primary"
                value={netDriver}
                onChange={(e) => setNetDriver(e.target.value)}
              >
                <option value="bridge" className="bg-slate-900">bridge</option>
                <option value="overlay" className="bg-slate-900">overlay</option>
                <option value="macvlan" className="bg-slate-900">macvlan</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateNetModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateNetwork}>Create Network</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
