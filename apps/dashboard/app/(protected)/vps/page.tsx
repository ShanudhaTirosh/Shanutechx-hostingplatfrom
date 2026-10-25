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
import { Search, User, Check, RefreshCw, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function VpsPage() {
  const { apiUser } = useAppUser();
  const [provisions, setProvisions] = useState<VpsProvision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Staff Add VPS Modal state
  const [addVpsModal, setAddVpsModal] = useState<boolean>(false);
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; email: string; displayName?: string | null; role?: string }>>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [customerLoading, setCustomerLoading] = useState<boolean>(false);
  const [manualInputMode, setManualInputMode] = useState<boolean>(false);
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
    if (addVpsModal && isStaff) {
      setCustomerLoading(true);
      api.admin
        .allUsers()
        .then((res) => {
          let users = res.users || [];
          if (apiUser && !users.some((u) => u.id === apiUser.id || u.email.toLowerCase() === apiUser.email.toLowerCase())) {
            users = [
              {
                id: apiUser.id,
                email: apiUser.email,
                displayName: apiUser.displayName || 'My Account',
                role: apiUser.role,
              },
              ...users,
            ];
          }
          setCustomerOptions(users);
          if (users.length > 0 && !targetUserId) {
            setTargetUserId(apiUser ? apiUser.id : users[0].id);
          }
        })
        .catch(() => {
          if (apiUser) {
            setCustomerOptions([
              {
                id: apiUser.id,
                email: apiUser.email,
                displayName: apiUser.displayName || 'My Account',
                role: apiUser.role,
              },
            ]);
            if (!targetUserId) setTargetUserId(apiUser.id);
          }
        })
        .finally(() => {
          setCustomerLoading(false);
        });
    }
  }, [addVpsModal, isStaff, apiUser]);

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

      {/* VPS Delivery Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
        <IconAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div>
            <strong className="font-semibold text-amber-300">Notice:</strong> VPS servers are delivered within <strong>24 to 72 hours</strong>.
          </div>
          <div className="text-[11px] text-amber-200/80">
            If you change your root user password directly inside the terminal (`chpasswd`), update stored credentials via <em>Sync Credentials</em>.
          </div>
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-xl w-full border border-white/15 bg-[#0a0a0d] space-y-4 shadow-2xl p-6 rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Deliver VPS (Assign to Customer)</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Connect over SSH, deploy telemetry services, and assign access to a customer account.
                </p>
              </div>
              <button
                onClick={() => setAddVpsModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* TARGET CUSTOMER SEARCH & SELECTOR */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-white" />
                    <span>Target Customer Account *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setManualInputMode((prev) => !prev)}
                    className="text-[11px] text-neutral-400 hover:text-white transition-colors underline"
                  >
                    {manualInputMode ? '← Search from customer list' : 'Enter ID manually'}
                  </button>
                </div>

                {manualInputMode ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="Paste or enter Customer User ID..."
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono text-xs transition-all"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Direct user ID assignment. Any valid user ID will be bound to this VPS container.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Selected Customer Preview Card */}
                    {(() => {
                      const effectiveId = targetUserId || apiUser?.id || '';
                      const sel =
                        customerOptions.find((c) => c.id === effectiveId) ||
                        (apiUser && effectiveId === apiUser.id
                          ? {
                              id: apiUser.id,
                              email: apiUser.email,
                              displayName: apiUser.displayName || 'Dev User',
                              role: apiUser.role,
                            }
                          : null);

                      if (sel) {
                        const isDefaultDev = !targetUserId || targetUserId === apiUser?.id;
                        return (
                          <div className="flex items-center justify-between p-3 rounded-xl border border-white/20 bg-white/10 text-white">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                                {(sel.displayName || sel.email || 'U')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs truncate text-white">
                                    {sel.displayName || sel.email}
                                  </span>
                                  {sel.role && (
                                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/20 text-white font-mono font-bold">
                                      {sel.role}
                                    </span>
                                  )}
                                  {isDefaultDev && (
                                    <span className="text-[9px] font-mono text-emerald-300 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      Default Dev
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-300 font-mono truncate">
                                  {sel.email}
                                </p>
                                <p className="text-[10px] text-neutral-400 font-mono truncate">
                                  ID: {sel.id}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                                <Check className="h-3.5 w-3.5" /> Selected
                              </span>
                            </div>
                          </div>
                        );
                      }
                      if (targetUserId) {
                        return (
                          <div className="p-2.5 rounded-xl border border-white/15 bg-white/5 flex items-center justify-between text-xs">
                            <span className="font-mono text-neutral-300">Selected ID: <strong className="text-white">{targetUserId}</strong></span>
                            <button
                              type="button"
                              onClick={() => setTargetUserId(apiUser?.id || '')}
                              className="text-neutral-400 hover:text-white text-[11px]"
                            >
                              Reset to Default Dev
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs">
                          Please search and select a customer account below (or leave default dev user).
                        </div>
                      );
                    })()}

                    {/* Quick-assign to current staff/dev account shortcut */}
                    {apiUser && targetUserId !== apiUser.id && (
                      <button
                        type="button"
                        onClick={() => setTargetUserId(apiUser.id)}
                        className="text-[11px] text-neutral-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors w-fit"
                      >
                        <User className="h-3 w-3 text-white" />
                        <span>Assign to My Account ({apiUser.email})</span>
                      </button>
                    )}

                    {/* Customer Live Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search customers by email, name, or User ID..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 transition-all font-sans"
                      />
                      {customerLoading && (
                        <RefreshCw className="absolute right-3 top-2.5 h-3.5 w-3.5 text-neutral-400 animate-spin" />
                      )}
                      {customerSearchQuery && !customerLoading && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearchQuery('')}
                          className="absolute right-3 top-2.5 text-neutral-400 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Scrollable Customer Filter Results List */}
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0a0c] divide-y divide-white/5">
                      {customerLoading && customerOptions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                          <span>Loading customer accounts...</span>
                        </div>
                      ) : (() => {
                        const q = customerSearchQuery.toLowerCase().trim();
                        const filtered = customerOptions.filter((c) => {
                          if (!q) return true;
                          return (
                            c.email?.toLowerCase().includes(q) ||
                            (c.displayName && c.displayName.toLowerCase().includes(q)) ||
                            c.id?.toLowerCase().includes(q) ||
                            (c.role && c.role.toLowerCase().includes(q))
                          );
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="p-4 text-center text-xs text-neutral-400">
                              <p>No customer accounts matching "{customerSearchQuery}"</p>
                              {customerSearchQuery.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setTargetUserId(customerSearchQuery.trim())}
                                  className="mt-2 text-xs text-white underline hover:text-neutral-200"
                                >
                                  Use "{customerSearchQuery}" as Custom User ID
                                </button>
                              )}
                            </div>
                          );
                        }

                        return filtered.map((c) => {
                          const effectiveId = targetUserId || apiUser?.id || '';
                          const isSelected = effectiveId === c.id;
                          return (
                            <div
                              key={c.id}
                              onClick={() => setTargetUserId(c.id)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-white/15 border-l-4 border-white text-white font-bold'
                                  : 'hover:bg-white/5 text-neutral-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isSelected ? 'bg-white text-black' : 'bg-white/10 text-white'
                                  }`}
                                >
                                  {(c.displayName || c.email || 'U')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-xs truncate ${
                                        isSelected ? 'font-bold text-white' : 'font-medium text-neutral-200'
                                      }`}
                                    >
                                      {c.displayName || c.email}
                                    </span>
                                    {c.displayName && (
                                      <span className="text-[10px] text-neutral-400 truncate">
                                        ({c.email})
                                      </span>
                                    )}
                                    {c.role && (
                                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-white/10 text-neutral-300 font-mono">
                                        {c.role}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-neutral-500 font-mono truncate">
                                    ID: {c.id}
                                  </p>
                                </div>
                              </div>
                              <div className="ml-2 shrink-0">
                                <div
                                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-white bg-white text-black'
                                      : 'border-white/30 bg-transparent'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-text-muted block mb-1">Provider / Tier Name</label>
                <input
                  type="text"
                  placeholder="STX Enterprise / Custom Dedicated Server"
                  value={manualProvider}
                  onChange={(e) => setManualProvider(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono text-xs transition-all"
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
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono text-xs transition-all"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">SSH Port</label>
                  <input
                    type="number"
                    value={manualPort}
                    onChange={(e) => setManualPort(parseInt(e.target.value) || 22)}
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono text-xs transition-all"
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
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono text-xs transition-all"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Root Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 font-mono text-xs transition-all"
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
                      className="flex items-center gap-1 text-[11px] border-white/15 text-neutral-300 hover:bg-white/5"
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

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAddVpsModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddManualVps}
                disabled={busyId === 'new'}
                className="px-5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold shadow-md transition-all disabled:opacity-50"
              >
                {busyId === 'new' ? 'Delivering...' : 'Save & Deliver to Customer'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
