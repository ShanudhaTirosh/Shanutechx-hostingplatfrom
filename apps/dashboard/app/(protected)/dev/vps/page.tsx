'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { VpsProvision } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Badge,
  useToast,
  RevealSecret,
} from '@/components/ui';
import {
  IconServer,
  IconPlus,
  IconRefresh,
  IconTerminal,
  IconFolder,
  IconCheck,
  IconAlert,
  IconRestart,
  IconEdit,
  IconSearch,
  IconUser,
  IconCheckCircle,
} from '@/components/Icons';

export const dynamic = 'force-dynamic';

type AdminVpsItem = VpsProvision & {
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
    role: string;
  };
};

interface AllUserItem {
  id: string;
  email: string;
  displayName?: string | null;
  role: string;
  hasPaidVps?: boolean;
  paidOrderCount?: number;
  totalSpent?: number;
  vpsCount?: number;
  awaitingDelivery?: boolean;
}

const VPS_PROVIDERS = [
  'Leaseweb',
  'DigitalOcean',
  'BreezeHost',
  'Linode',
  'Hetzner',
  'Custom',
];

export default function DevVpsFleetPage() {
  const { apiUser } = useAppUser();
  const [provisions, setProvisions] = useState<AdminVpsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modal State for New / Manual Provisioning
  const [addModal, setAddModal] = useState<boolean>(false);
  const [selectedProvision, setSelectedProvision] = useState<AdminVpsItem | null>(null);

  // Customer dropdown & search state
  const [userOptions, setUserOptions] = useState<AllUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [targetUserId, setTargetUserId] = useState<string>('');

  // Form fields
  const [manualIp, setManualIp] = useState<string>('');
  const [manualPort, setManualPort] = useState<number>(22);
  const [manualUsername, setManualUsername] = useState<string>('root');
  const [manualPassword, setManualPassword] = useState<string>('');
  const [manualSshPrivateKey, setManualSshPrivateKey] = useState<string>('');
  const [manualProvider, setManualProvider] = useState<string>('Leaseweb');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Connection Diagnostics state
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    ssh?: { success: boolean; message: string };
    sftp?: { success: boolean; message: string };
  } | null>(null);

  // Staff Renewal Modal state
  const [renewModalOpen, setRenewModalOpen] = useState<boolean>(false);
  const [renewTargetItem, setRenewTargetItem] = useState<AdminVpsItem | null>(null);
  const [renewMonths, setRenewMonths] = useState<number>(1);
  const [renewNotesInput, setRenewNotesInput] = useState<string>('');

  const { toast } = useToast();
  const isStaff = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  function load() {
    api.vps
      .listAllAdmin()
      .then((data) => setProvisions(data.provisions))
      .catch((err) => setError(err.message));
  }

  function loadAllUsers(searchQuery?: string) {
    setLoadingUsers(true);
    // Query /api/admin/all-users
    api.admin
      .allUsers(searchQuery)
      .then((res: any) => {
        const list: AllUserItem[] = res.users || [];
        setUserOptions(list);
        if (list.length > 0 && !targetUserId) {
          setTargetUserId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }

  useEffect(load, []);

  useEffect(() => {
    if (addModal && isStaff) {
      loadAllUsers(userSearchQuery);
    }
  }, [addModal, isStaff, userSearchQuery]);

  function openFulfillModal(item?: AdminVpsItem) {
    setSelectedProvision(item || null);
    if (item) {
      setTargetUserId(item.userId);
      setManualIp(item.ip || '');
      setManualPort(item.sshPort || 22);
      setManualUsername(item.username || 'root');
      setManualPassword('');
      setManualSshPrivateKey('');
      setManualProvider(item.provider || 'Leaseweb');
      setManualNotes(item.notes || '');
    } else {
      setManualIp('');
      setManualPort(22);
      setManualUsername('root');
      setManualPassword('');
      setManualSshPrivateKey('');
      setManualProvider('Leaseweb');
      setManualNotes('');
    }
    setTestResults(null);
    setUserSearchQuery('');
    setAddModal(true);
  }

  async function handleTestConnection(testType: 'ssh' | 'sftp' | 'both') {
    if (!manualIp) {
      toast('Please enter server IP address', 'error');
      return;
    }
    if (!manualPassword && !manualSshPrivateKey) {
      toast('Please enter root password or private key', 'error');
      return;
    }
    setTestingConnection(testType);
    setTestResults(null);
    try {
      const res = await api.vps.testConnection({
        ip: manualIp,
        sshPort: manualPort,
        username: manualUsername,
        password: manualPassword || manualSshPrivateKey,
        testType,
      });
      setTestResults({
        ...(res.ssh ? { ssh: res.ssh } : {}),
        ...(res.sftp ? { sftp: res.sftp } : {}),
      });
      if (res.ok) {
        toast(`Connection Test Passed! (${testType.toUpperCase()})`, 'success');
      } else {
        toast(`Connection Test Failed: ${res.ssh?.message || res.sftp?.message || 'Error'}`, 'error');
      }
    } catch (err: any) {
      toast(`Diagnostic Error: ${err.message}`, 'error');
    } finally {
      setTestingConnection(null);
    }
  }

  async function handleSaveAndDeliver() {
    if (!manualIp) {
      toast('IP address is required', 'error');
      return;
    }

    setBusyId('modal');
    try {
      if (selectedProvision) {
        await api.vps.manualProvision(selectedProvision.id, {
          ip: manualIp,
          sshPort: manualPort,
          username: manualUsername,
          password: manualPassword || undefined,
          sshPrivateKey: manualSshPrivateKey || undefined,
          provider: manualProvider,
          notes: manualNotes || undefined,
        });
        toast('VPS provision details updated and customer notified.', 'success');
      } else {
        if (!targetUserId) {
          toast('Target customer selection is required', 'error');
          setBusyId(null);
          return;
        }
        await api.vps.create({
          userId: targetUserId,
          orderItemId: `manual-${Date.now()}`,
          provider: manualProvider,
          ip: manualIp,
          sshPort: manualPort,
          username: manualUsername,
          password: manualPassword || manualSshPrivateKey || 'STX-default-key',
        });
        toast('VPS provisioned and delivered to customer account.', 'success');
      }
      setAddModal(false);
      setSelectedProvision(null);
      load();
    } catch (err: any) {
      toast(`Action failed: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePowerAction(id: string, action: 'reboot') {
    setBusyId(id);
    try {
      const res = await api.vps.power(id, action);
      toast(res.message || `Action '${action}' issued over SSH.`, 'success');
      load();
    } catch (err: any) {
      toast(`Action failed: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRenewVpsSubmit() {
    if (!renewTargetItem) return;
    setBusyId(`renew_${renewTargetItem.id}`);
    try {
      const res = await api.vps.renew(renewTargetItem.id, {
        months: renewMonths,
        notes: renewNotesInput || 'Manual staff renewal extension',
      });
      toast(res.message || 'VPS successfully renewed and extended.', 'success');
      setRenewModalOpen(false);
      setRenewTargetItem(null);
      load();
    } catch (err: any) {
      toast(`Renewal failed: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = provisions?.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.ip?.toLowerCase().includes(q) ||
      item.user?.email.toLowerCase().includes(q) ||
      item.provider?.toLowerCase().includes(q) ||
      item.username?.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  const pendingCount = provisions?.filter((p) => p.status === 'pending').length || 0;
  const activeCount = provisions?.filter((p) => p.status === 'provisioned').length || 0;
  const totalCount = provisions?.length || 0;

  const selectedUserObj = userOptions.find((u) => u.id === targetUserId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Global Customer VPS Fleet Manager"
          description="Dev Studio & Administrative VPS orchestration, provisioning, credential management, and connectivity diagnostics."
        />
        {isStaff && (
          <Button variant="primary" size="sm" onClick={() => openFulfillModal()} className="flex items-center gap-1.5">
            <IconPlus size={14} /> Deliver New VPS to Customer
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border border-white/10 p-4 space-y-1">
          <span className="text-text-muted text-xs block">Total VPS Fleet</span>
          <span className="text-2xl font-bold text-white font-mono">{totalCount}</span>
        </Card>
        <Card className="bg-amber-500/10 border border-amber-500/20 p-4 space-y-1">
          <span className="text-amber-300 text-xs block">Pending Manual Setup</span>
          <span className="text-2xl font-bold text-amber-400 font-mono">{pendingCount}</span>
        </Card>
        <Card className="bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-1">
          <span className="text-emerald-300 text-xs block">Active & Provisioned</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono">{activeCount}</span>
        </Card>
        <Card className="bg-cyan-500/10 border border-cyan-500/20 p-4 space-y-1">
          <span className="text-cyan-300 text-xs block">Supported Providers</span>
          <span className="text-2xl font-bold text-cyan-400 font-mono">Leaseweb, DO, Linode</span>
        </Card>
      </div>

      {/* Search & Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <input
            type="text"
            placeholder="Search by customer email, server IP, provider, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:border-accent-teal font-mono"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={load} className="flex items-center gap-1.5">
          <IconRefresh size={14} /> Refresh Fleet
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {provisions === null && <Spinner label="Loading customer VPS fleet..." />}
      {provisions?.length === 0 && (
        <EmptyState message="No VPS provisions found in the platform database." />
      )}

      {/* Fleet Table */}
      {filtered && filtered.length > 0 && (
        <Card className="overflow-hidden border border-white/10 bg-neutral-900/60 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-text-muted uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3">Customer Account</th>
                  <th className="p-3">Server IP & Port</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Credentials</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-white">{p.user?.email || p.userId}</div>
                      <span className="text-[10px] text-text-muted">User ID: {p.userId.slice(0, 8)}...</span>
                    </td>
                    <td className="p-3">
                      <div className="text-accent-teal font-bold">{p.ip || 'Pending IP'}</div>
                      <span className="text-[10px] text-text-muted">Port: {p.sshPort || 22} ({p.username || 'root'})</span>
                    </td>
                    <td className="p-3 text-text-muted">{p.provider || 'Leaseweb'}</td>
                    <td className="p-3">
                      {p.status === 'provisioned' ? (
                        <Badge status="running" />
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Pending Setup
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {p.status === 'provisioned' ? (
                        <RevealSecret
                          fetchSecret={() =>
                            api.vps.revealPassword(p.id).then((r) => `${r.username || 'root'}:${r.password}`)
                          }
                        />
                      ) : (
                        <span className="text-[10px] text-amber-400">Awaiting Admin Input</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant={p.status === 'pending' ? 'primary' : 'secondary'}
                        onClick={() => openFulfillModal(p)}
                        className="text-[10px] py-1 px-2"
                      >
                        <IconEdit size={11} /> {p.status === 'pending' ? 'Setup VPS' : 'Edit Credentials'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRenewTargetItem(p);
                          setRenewMonths(1);
                          setRenewNotesInput('');
                          setRenewModalOpen(true);
                        }}
                        className="text-[10px] py-1 px-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <IconRefresh size={11} /> Renew / Extend
                      </Button>
                      {p.status === 'provisioned' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === p.id}
                          onClick={() => handlePowerAction(p.id, 'reboot')}
                          className="text-[10px] py-1 px-2"
                        >
                          <IconRestart size={11} /> Reboot
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Deliver / Setup VPS Modal */}
      {addModal && isStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-xl w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <IconServer className="text-accent-teal" size={18} />
                {selectedProvision ? `Setup Customer VPS (${selectedProvision.user?.email || selectedProvision.id})` : 'Deliver New VPS to Customer'}
              </h3>
              <button onClick={() => setAddModal(false)} className="text-text-muted hover:text-white text-sm">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              {/* TARGET CUSTOMER SEARCHABLE SELECTOR */}
              {!selectedProvision && (
                <div className="space-y-2 p-3 bg-white/[0.02] border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <IconUser size={14} className="text-accent-teal" />
                      Target Customer Account *
                    </label>
                    {selectedUserObj && (
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Selected: {selectedUserObj.email}
                      </span>
                    )}
                  </div>

                  {/* Customer Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search customer by email, display name, or user ID..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:border-accent-teal font-mono"
                    />
                    {loadingUsers && (
                      <div className="absolute right-3 top-2.5">
                        <div className="w-3.5 h-3.5 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Searchable Customer List (Prioritizes Paid VPS Customers at top) */}
                  <div className="max-h-44 overflow-y-auto border border-white/10 rounded-lg bg-black/50 divide-y divide-white/5 font-mono">
                    {userOptions.length === 0 ? (
                      <p className="p-3 text-center text-text-muted text-[11px] italic">
                        {loadingUsers ? 'Searching customer directory...' : 'No customer accounts match your search.'}
                      </p>
                    ) : (
                      userOptions.map((u) => {
                        const isSelected = targetUserId === u.id;
                        return (
                          <div
                            key={u.id}
                            onClick={() => setTargetUserId(u.id)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-accent-teal/20 border-l-4 border-accent-teal text-white font-bold'
                                : 'hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-semibold">{u.email}</span>
                                {u.awaitingDelivery ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                                    <IconAlert size={10} /> Awaiting VPS Delivery (Paid)
                                  </span>
                                ) : u.vpsCount && u.vpsCount > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                                    <IconCheckCircle size={10} /> Active VPS ({u.vpsCount})
                                  </span>
                                ) : u.hasPaidVps ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 shrink-0">
                                    Paid Customer
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[10px] text-text-muted flex items-center gap-3 mt-0.5">
                                <span>Name: {u.displayName || 'Client'}</span>
                                <span>Role: {u.role}</span>
                                <span>Spent: ${(u.totalSpent || 0).toFixed(2)}</span>
                                {u.vpsCount ? <span>Active VPS: {u.vpsCount}</span> : null}
                              </div>
                            </div>

                            {isSelected && <IconCheck size={16} className="text-accent-teal shrink-0 ml-2" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-text-muted block mb-1">Infrastructure Provider *</label>
                <select
                  value={manualProvider}
                  onChange={(e) => setManualProvider(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                >
                  {VPS_PROVIDERS.map((prov) => (
                    <option key={prov} value={prov} className="bg-neutral-900 text-white">
                      {prov}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-text-muted block mb-1">Server IP Address *</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.100"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">SSH Port</label>
                  <input
                    type="number"
                    value={manualPort}
                    onChange={(e) => setManualPort(parseInt(e.target.value) || 22)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-text-muted block mb-1">Username</label>
                  <input
                    type="text"
                    value={manualUsername}
                    onChange={(e) => setManualUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Root / SSH Password</label>
                  <input
                    type="password"
                    placeholder="Password for SSH access"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1">SSH Private Key (Optional - .pem format)</label>
                <textarea
                  rows={3}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                  value={manualSshPrivateKey}
                  onChange={(e) => setManualSshPrivateKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Notes / Internal Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Purchased via Leaseweb Order #1048"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                />
              </div>

              {/* Pre-Delivery Connection Diagnostic Section */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    Pre-Delivery Connection Diagnostics
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection('ssh')}
                      loading={testingConnection === 'ssh'}
                      className="text-[11px] border-emerald-500/30 text-emerald-300"
                    >
                      <IconTerminal size={12} /> Test SSH
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection('sftp')}
                      loading={testingConnection === 'sftp'}
                      className="text-[11px] border-cyan-500/30 text-cyan-300"
                    >
                      <IconFolder size={12} /> Test SFTP
                    </Button>
                  </div>
                </div>

                {testResults && (
                  <div className="space-y-1 text-xs bg-black/40 border border-white/10 rounded-lg p-2">
                    {testResults.ssh && (
                      <div className={`flex items-center gap-1.5 ${testResults.ssh.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {testResults.ssh.success ? <IconCheck size={13} /> : <IconAlert size={13} />}
                        <span>SSH: {testResults.ssh.message}</span>
                      </div>
                    )}
                    {testResults.sftp && (
                      <div className={`flex items-center gap-1.5 ${testResults.sftp.success ? 'text-cyan-400' : 'text-rose-400'}`}>
                        {testResults.sftp.success ? <IconCheck size={13} /> : <IconAlert size={13} />}
                        <span>SFTP: {testResults.sftp.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button size="sm" variant="secondary" onClick={() => setAddModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveAndDeliver} loading={busyId === 'modal'}>
                {selectedProvision ? 'Save Credentials & Fulfill' : 'Deliver VPS'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Staff VPS Renewal & Extension Modal */}
      {renewModalOpen && isStaff && renewTargetItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <IconRefresh className="text-emerald-400" size={18} />
                Renew & Extend VPS ({renewTargetItem.user?.email || renewTargetItem.ip || renewTargetItem.id.slice(0, 8)})
              </h3>
              <button onClick={() => setRenewModalOpen(false)} className="text-text-muted hover:text-white text-sm">✕</button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Extend the customer's active VPS provision term, update billing ledger records, and send automated renewal notifications.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Renewal Extension Duration *</label>
                <select
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-accent-teal"
                >
                  <option value={1} className="bg-neutral-900 text-white">1 Month (+30 Days)</option>
                  <option value={3} className="bg-neutral-900 text-white">3 Months (+90 Days - 7% Savings)</option>
                  <option value={6} className="bg-neutral-900 text-white">6 Months (+180 Days - 11% Savings)</option>
                  <option value={12} className="bg-neutral-900 text-white">12 Months (+365 Days - 17% Savings)</option>
                </select>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Administrative Notes (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Extended by admin after bank transfer verification..."
                  value={renewNotesInput}
                  onChange={(e) => setRenewNotesInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button size="sm" variant="secondary" onClick={() => setRenewModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleRenewVpsSubmit} loading={busyId === `renew_${renewTargetItem.id}`}>
                Confirm & Extend VPS
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
