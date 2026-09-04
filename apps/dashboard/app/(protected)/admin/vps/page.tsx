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
  IconStop,
  IconKey,
  IconActivity,
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

export default function AdminVpsFleetPage() {
  const { apiUser } = useAppUser();
  const [provisions, setProvisions] = useState<AdminVpsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Deliver VPS Modal State
  const [addModal, setAddModal] = useState<boolean>(false);
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; email: string; displayName?: string | null }>>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [manualIp, setManualIp] = useState<string>('');
  const [manualPort, setManualPort] = useState<number>(22);
  const [manualUsername, setManualUsername] = useState<string>('root');
  const [manualPassword, setManualPassword] = useState<string>('');
  const [manualProvider, setManualProvider] = useState<string>('STX Enterprise');

  // Diagnostics state
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    ssh?: { success: boolean; message: string };
    sftp?: { success: boolean; message: string };
  } | null>(null);

  const { toast } = useToast();
  const isStaff = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  function load() {
    api.vps
      .listAllAdmin()
      .then((data) => setProvisions(data.provisions))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  useEffect(() => {
    if (addModal && isStaff && customerOptions.length === 0) {
      api.admin
        .customers(100)
        .then((res) => {
          setCustomerOptions(res.customers || []);
          if (res.customers?.[0]?.id) setTargetUserId(res.customers[0].id);
        })
        .catch(() => {});
    }
  }, [addModal, isStaff, customerOptions.length]);

  async function handleTestConnection(testType: 'ssh' | 'sftp' | 'both') {
    if (!manualIp) {
      toast('Please enter server IP address', 'error');
      return;
    }
    if (!manualPassword) {
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
        password: manualPassword,
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

  async function handleDeliverVps() {
    if (!manualIp) {
      toast('IP address is required', 'error');
      return;
    }
    if (!targetUserId) {
      toast('Target customer selection is required', 'error');
      return;
    }
    if (!manualPassword) {
      toast('Root password is required', 'error');
      return;
    }

    setBusyId('new');
    try {
      await api.vps.create({
        userId: targetUserId,
        orderItemId: `manual-${Date.now()}`,
        provider: manualProvider,
        ip: manualIp,
        sshPort: manualPort,
        username: manualUsername,
        password: manualPassword,
      });
      toast('VPS provisioned over SSH and delivered to customer account.', 'success');
      setAddModal(false);
      setManualIp('');
      setManualPassword('');
      load();
    } catch (err: any) {
      toast(`Delivery failed: ${err.message}`, 'error');
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

  const activeCount = provisions?.filter((p) => p.status === 'provisioned').length || 0;
  const totalCount = provisions?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Global Customer VPS Fleet"
          description="Administrative overview and management of all provisioned Virtual Private Servers across all platform customer accounts."
        />
        {isStaff && (
          <Button variant="primary" size="sm" onClick={() => setAddModal(true)} className="flex items-center gap-1.5">
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
        <Card className="bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-1">
          <span className="text-emerald-300 text-xs block">Active & Provisioned</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono">{activeCount}</span>
        </Card>
        <Card className="bg-cyan-500/10 border border-cyan-500/20 p-4 space-y-1">
          <span className="text-cyan-300 text-xs block">SSH Telemetry Daemon</span>
          <span className="text-2xl font-bold text-cyan-400 font-mono">100% Agent</span>
        </Card>
        <Card className="bg-purple-500/10 border border-purple-500/20 p-4 space-y-1">
          <span className="text-purple-300 text-xs block">Monthly Quota / Host</span>
          <span className="text-2xl font-bold text-purple-400 font-mono">30 TB</span>
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
                  <th className="p-3">Provider Tier</th>
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
                    <td className="p-3 text-text-muted">{p.provider || 'Custom'}</td>
                    <td className="p-3">
                      <Badge status={p.status === 'provisioned' ? 'running' : 'pending'} />
                    </td>
                    <td className="p-3">
                      <RevealSecret
                        fetchSecret={() =>
                          api.vps.revealPassword(p.id).then((r) => `${r.username || 'root'}:${r.password}`)
                        }
                      />
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === p.id}
                        onClick={() => handlePowerAction(p.id, 'reboot')}
                        className="text-[10px] py-1 px-2"
                      >
                        <IconRestart size={11} /> Reboot
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Deliver VPS Modal */}
      {addModal && isStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Deliver VPS (Assign to Customer)</h3>
              <button onClick={() => setAddModal(false)} className="text-text-muted hover:text-white text-sm">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Target Customer Account *</label>
                {customerOptions.length > 0 ? (
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  >
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                        {c.email} ({c.displayName || c.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter Customer User ID"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-text-muted block mb-1">Server IP Address *</label>
                  <input
                    type="text"
                    placeholder="192.168.1.100"
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
                  <label className="text-text-muted block mb-1">Root Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono"
                  />
                </div>
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
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection('both')}
                      loading={testingConnection === 'both'}
                      className="text-[11px] border-purple-500/30 text-purple-300"
                    >
                      Test Both
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

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button size="sm" variant="secondary" onClick={() => setAddModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleDeliverVps} loading={busyId === 'new'}>
                Save & Deliver to Customer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
