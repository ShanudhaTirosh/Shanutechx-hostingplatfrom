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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Customer & User Directory"
          description="Search customer accounts, manage roles, check billing history, and create user accounts."
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
        <Table headers={['Customer Name / Email', 'Registration Date', 'Activity', 'Total Spent']}>
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
              <Td className="text-xs text-text-muted">
                {new Date(cust.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Td>
              <Td className="text-xs text-text-muted">
                <span className="font-semibold text-text-primary">{cust.orderCount}</span> orders
                {cust.phoneNumber && ' · 📱 WhatsApp'}
                {cust.discordUserId && ' · 💬 Discord'}
              </Td>
              <Td className="font-bold text-accent-teal-bright text-sm text-right pr-4">
                {formatMoney(cust.totalSpent)}
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  );
}
