'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Customer } from '@/lib/types';
import {
  Card,
  Spinner,
  EmptyState,
  ErrorBanner,
  formatMoney,
  Input,
  Table,
  Tr,
  Td,
  PageHeader,
  Button,
  useToast,
  Badge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('customer');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  function loadCustomers() {
    api.admin
      .customers(50, 0, search || undefined)
      .then((data) => setCustomers(data.customers))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    const timeout = setTimeout(loadCustomers, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      await api.admin.createUser({
        email: newEmail.trim(),
        displayName: newName.trim() || undefined,
        role: newRole,
      });
      toast('User account created successfully', 'success');
      setShowCreate(false);
      setNewEmail('');
      setNewName('');
      loadCustomers();
    } catch (err: any) {
      toast(err.message || 'Failed to create user account', 'error');
    } finally {
      setCreating(false);
    }
  }

  const [banModalUser, setBanModalUser] = useState<Customer | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);

  async function handleBanUser() {
    if (!banModalUser) return;
    setBanning(true);
    try {
      await api.admin.banUser(banModalUser.id, banReason || 'Suspended by Admin');
      toast(`User ${banModalUser.email} has been banned and resources stopped`, 'success');
      setBanModalUser(null);
      setBanReason('');
      loadCustomers();
    } catch (err: any) {
      toast(err.message || 'Failed to ban user', 'error');
    } finally {
      setBanning(false);
    }
  }

  async function handleUnbanUser(cust: Customer) {
    if (!confirm(`Are you sure you want to unban ${cust.email}?`)) return;
    try {
      await api.admin.unbanUser(cust.id);
      toast(`User ${cust.email} unbanned successfully`, 'success');
      loadCustomers();
    } catch (err: any) {
      toast(err.message || 'Failed to unban user', 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Customer & User Directory"
          description="Search customer accounts, manage roles, check billing history, and handle account suspensions / bans."
        />
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ Create User Account'}
        </Button>
      </div>

      {showCreate && (
        <Card className="border border-white/10 p-5 bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Create New User Account</h3>
          <form onSubmit={handleCreateUser} className="grid md:grid-cols-4 gap-3 items-end">
            <Input
              type="email"
              label="Email Address"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <Input
              type="text"
              label="Display Name"
              placeholder="John Doe"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Account Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50"
              >
                <option value="customer" className="bg-[#0a0a14]">Customer</option>
                <option value="support" className="bg-[#0a0a14]">Support Staff</option>
                <option value="dev" className="bg-[#0a0a14]">Developer (Full Access)</option>
                <option value="admin" className="bg-[#0a0a14]">Administrator</option>
              </select>
            </div>
            <Button type="submit" loading={creating}>
              Create User
            </Button>
          </form>
        </Card>
      )}

      <div className="max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by email..."
        />
      </div>

      {error && <ErrorBanner message={error} />}

      {customers === null && <Spinner label="Loading customer directory..." />}
      {customers?.length === 0 && <EmptyState message="No matching customers found." />}

      {customers && customers.length > 0 && (
        <Table headers={['Customer Name / Email', 'Status', 'Registration Date', 'Activity', 'Total Spent', 'Actions']}>
          {customers.map((cust) => (
            <Tr key={cust.id}>
              <Td>
                <div>
                  <p className="font-semibold text-text-primary text-sm flex items-center gap-2">
                    {cust.displayName || 'Unset Display Name'}
                  </p>
                  <p className="text-text-muted text-xs font-mono">{cust.email}</p>
                </div>
              </Td>
              <Td>
                {cust.isBanned ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Banned ({cust.banReason || 'Policy Violation'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </Td>
              <Td className="text-xs text-text-muted">
                {new Date(cust.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Td>
              <Td className="text-xs text-text-muted">
                <span className="font-semibold text-text-primary">{cust.orderCount}</span> orders
                {cust.phoneNumber && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium ml-1">
                    · WhatsApp
                  </span>
                )}
                {cust.discordUserId && (
                  <span className="inline-flex items-center gap-1 text-indigo-400 font-medium ml-1">
                    · Discord
                  </span>
                )}
              </Td>
              <Td className="font-bold text-accent-teal-bright text-sm">
                {formatMoney(cust.totalSpent)}
              </Td>
              <Td className="text-right pr-4">
                {cust.isBanned ? (
                  <button
                    onClick={() => handleUnbanUser(cust)}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  >
                    Unban Customer
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setBanModalUser(cust);
                      setBanReason('');
                    }}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                  >
                    Ban Customer
                  </button>
                )}
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-background-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Suspend / Ban Customer Account</span>
              </div>
              <button
                onClick={() => setBanModalUser(null)}
                className="text-text-muted hover:text-text-primary transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Banning <strong className="text-text-primary">{banModalUser.email}</strong> will immediately disable their login, revoke all API keys, and stop all running container deployments.
            </p>

            <Input
              label="Ban Reason"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. Terms of Service Abuse / Crypto Mining"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="secondary" onClick={() => setBanModalUser(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={banning} onClick={handleBanUser}>
                Confirm Ban &amp; Stop Containers
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
