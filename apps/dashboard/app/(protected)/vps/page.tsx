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
  useToast,
} from '@/components/ui';
import {
  IconPlus,
  IconAlert,
  IconTerminal,
  IconFolder,
  IconCheck,
} from '@/components/Icons';
import { CustomerVpsPanel } from '@/components/CustomerVpsPanel';

export const dynamic = 'force-dynamic';

export default function VpsPage() {
  const { apiUser } = useAppUser();
  const [provisions, setProvisions] = useState<VpsProvision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Staff Add VPS Modal state
  const [addVpsModal, setAddVpsModal] = useState<boolean>(false);
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; email: string; displayName?: string | null }>>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [manualIp, setManualIp] = useState<string>('');
  const [manualPort, setManualPort] = useState<number>(22);
  const [manualUsername, setManualUsername] = useState<string>('root');
  const [manualPassword, setManualPassword] = useState<string>('');
  const [manualProvider, setManualProvider] = useState<string>('STX Enterprise');

  // Pre-Delivery Connection Test state
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    ssh?: { success: boolean; message: string };
    sftp?: { success: boolean; message: string };
  } | null>(null);

  const { toast } = useToast();
  const isStaff = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  function load() {
    api.vps
      .list()
      .then((data) => setProvisions(data.provisions))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  useEffect(() => {
    if (addVpsModal && isStaff && customerOptions.length === 0) {
      api.admin
        .customers(100)
        .then((res) => {
          setCustomerOptions(res.customers || []);
          if (res.customers?.[0]?.id) setTargetUserId(res.customers[0].id);
        })
        .catch(() => {});
    }
  }, [addVpsModal, isStaff, customerOptions.length]);

  async function handleTestConnection(testType: 'ssh' | 'sftp' | 'both') {
    if (!manualIp) {
      toast('Please enter the server IP address to test connection', 'error');
      return;
    }
    if (!manualPassword) {
      toast('Please enter the root password or private key to test connection', 'error');
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
        const failMsg = res.ssh?.message || res.sftp?.message || 'Connection test failed';
        toast(`Connection Test Failed: ${failMsg}`, 'error');
      }
    } catch (err: any) {
      toast(`Action failed: ${err.message}`, 'error');
    } finally {
      setTestingConnection(null);
    }
  }

  async function handleAddManualVps() {
    if (!manualIp) {
      toast('IP address is required', 'error');
      return;
    }
    const finalUserId = targetUserId.trim() || apiUser?.id || '';
    if (!finalUserId) {
      toast('Please select a target customer to assign this VPS', 'error');
      return;
    }
    if (!manualPassword) {
      toast('Root password is required', 'error');
      return;
    }

    setBusyId('new');
    try {
      await api.vps.create({
        userId: finalUserId,
        orderItemId: `manual-${Date.now()}`,
        provider: manualProvider,
        ip: manualIp,
        sshPort: manualPort,
        username: manualUsername,
        password: manualPassword,
      });
      toast('VPS successfully provisioned over SSH and assigned to customer.', 'success');
      setAddVpsModal(false);
      setManualIp('');
      setManualPassword('');
      load();
    } catch (err: any) {
      toast(`Action failed: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Virtual Server Fleet"
          description="Interactive customer VPS control panel: live telemetry, web SSH shell, desktop-grade SFTP file manager, host firewall, and Docker container engine."
        />
        {isStaff && (
          <Button variant="primary" size="sm" onClick={() => setAddVpsModal(true)} className="flex items-center gap-1.5">
            <IconPlus size={14} /> Deliver VPS to Customer
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {provisions === null && <Spinner label="Loading your VPS fleet..." />}
      {provisions?.length === 0 && (
        <EmptyState message="No active VPS server assigned to your account yet. Purchased servers will automatically appear here once provisioned." />
      )}

      {/* Global Warning Note */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
        <IconAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-300">IMPORTANT SECURITY NOTICE:</strong> If you change your root user password directly inside the terminal (`chpasswd`) or via your external provider dashboard, you <strong>MUST</strong> update your stored credentials here in the control panel. This ensures SFTP file transfers, live stats telemetry, and automated SSH power controls remain synchronized.
        </div>
      </div>

      {/* Customer VPS Fleet Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {provisions?.map((p) => (
          <CustomerVpsPanel key={p.id} provision={p} onRefresh={load} />
        ))}
      </div>

      {/* Manual VPS Provisioning Modal (Admin / Dev Staff Only) */}
      {addVpsModal && isStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border border-white/20 bg-neutral-900 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Deliver VPS (Assign to Customer)</h3>
              <button onClick={() => setAddVpsModal(false)} className="text-text-muted hover:text-white text-sm">✕</button>
            </div>
            <p className="text-xs text-text-muted">
              Enter the SSH server details below. The platform will automatically connect over SSH, deploy telemetry services, and assign access to the selected customer account.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Target Customer Account *</label>
                {customerOptions.length > 0 ? (
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-accent-teal font-mono text-xs"
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                )}
              </div>

              <div>
                <label className="text-text-muted block mb-1">Provider / Tier Name</label>
                <input
                  type="text"
                  placeholder="STX Enterprise / Custom Dedicated Server"
                  value={manualProvider}
                  onChange={(e) => setManualProvider(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-text-muted block mb-1">Server IP Address *</label>
                  <input
                    type="text"
                    placeholder="192.168.1.100"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">SSH Port</label>
                  <input
                    type="number"
                    value={manualPort}
                    onChange={(e) => setManualPort(parseInt(e.target.value) || 22)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Root Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-accent-teal font-mono"
                  />
                </div>
              </div>

              {/* Pre-Delivery Connection Test Diagnostics */}
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
                      className="flex items-center gap-1 text-[11px] border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <IconTerminal size={12} /> Test SSH
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection('sftp')}
                      loading={testingConnection === 'sftp'}
                      className="flex items-center gap-1 text-[11px] border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                    >
                      <IconFolder size={12} /> Test SFTP / FTP
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection('both')}
                      loading={testingConnection === 'both'}
                      className="flex items-center gap-1 text-[11px] border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                    >
                      Test Both
                    </Button>
                  </div>
                </div>

                {testResults && (
                  <div className="space-y-1.5 text-xs bg-black/40 border border-white/10 rounded-lg p-2.5">
                    {testResults.ssh && (
                      <div className={`flex items-start gap-2 ${testResults.ssh.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {testResults.ssh.success ? <IconCheck size={14} className="shrink-0 mt-0.5" /> : <IconAlert size={14} className="shrink-0 mt-0.5" />}
                        <div>
                          <strong className="font-semibold">SSH Connection:</strong> {testResults.ssh.message}
                        </div>
                      </div>
                    )}
                    {testResults.sftp && (
                      <div className={`flex items-start gap-2 ${testResults.sftp.success ? 'text-cyan-400' : 'text-rose-400'}`}>
                        {testResults.sftp.success ? <IconCheck size={14} className="shrink-0 mt-0.5" /> : <IconAlert size={14} className="shrink-0 mt-0.5" />}
                        <div>
                          <strong className="font-semibold">SFTP / FTP Subsystem:</strong> {testResults.sftp.message}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button size="sm" variant="secondary" onClick={() => setAddVpsModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleAddManualVps} loading={busyId === 'new'}>
                Save & Deliver to Customer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
