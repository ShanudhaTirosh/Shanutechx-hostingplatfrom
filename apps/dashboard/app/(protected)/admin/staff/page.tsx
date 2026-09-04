'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  Badge,
  Input,
  Table,
  Tr,
  Td,
  PageHeader,
  useToast,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

interface StaffMember {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('admin');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  function load() {
    api.me()
      .then((data) => {
        if (data.user?.role) setCurrentUserRole(data.user.role);
      })
      .catch(() => {});

    api.admin
      .staff()
      .then((data) => setStaff(data.staff as StaffMember[]))
      .catch((err) => {
        setError(err.message);
        toast('Failed to fetch staff directory', 'error');
      });
  }

  useEffect(load, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Staff &amp; Permissions"
        description="Manage role-based permissions, promote users to support or dev teams, and configure system administrative access."
      />

      {error && <ErrorBanner message={error} />}

      <PromoteForm onChanged={load} isDevUser={currentUserRole === 'dev'} />

      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Active Staff Members</h2>

        {staff === null && <Spinner label="Loading staff registry..." />}
        {staff?.length === 0 && <EmptyState message="No staff accounts registered. Promote users using the form above." />}

        {staff && staff.length > 0 && (
          <Table headers={['Staff Member', 'Role', 'Status / Control Actions']}>
            {staff.map((member) => (
              <StaffRow key={member.id} member={member} onChanged={load} isDevUser={currentUserRole === 'dev'} />
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

function StaffRow({ member, onChanged, isDevUser }: { member: StaffMember; onChanged: () => void; isDevUser: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleChange(role: 'customer' | 'support' | 'dev' | 'admin') {
    setBusy(true);
    setError(null);
    try {
      await api.admin.setStaffRole(member.id, role);
      toast(`User role updated to ${role}`, 'success');
      onChanged();
    } catch (err: any) {
      setError(err.message);
      toast('Failed to change user role', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tr>
      <Td>
        <div>
          <p className="font-semibold text-text-primary text-sm">{member.displayName || 'Unset Name'}</p>
          <p className="text-text-muted text-xs font-mono">{member.email}</p>
        </div>
      </Td>
      <Td>
        <Badge status={member.role} />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </Td>
      <Td className="text-right">
        {member.role === 'dev' ? (
          <span className="text-xs text-accent-violet-light font-mono italic bg-accent-violet/10 px-2.5 py-1 rounded-full border border-accent-violet/20">
            Developer Account (Protected)
          </span>
        ) : (
          <div className="inline-flex items-center gap-2">
            {member.role !== 'admin' && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleChange('admin')}>
                Make Admin
              </Button>
            )}
            {member.role !== 'support' && member.role === 'admin' && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleChange('support')}>
                Demote to Support
              </Button>
            )}
            {member.role !== 'support' && member.role !== 'admin' && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleChange('support')}>
                Make Support
              </Button>
            )}
            {isDevUser && member.role !== 'dev' && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleChange('dev')}>
                Make Dev
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={busy} className="hover:text-red-400" onClick={() => handleChange('customer')}>
              Revoke Access
            </Button>
          </div>
        )}
      </Td>
    </Tr>
  );
}

function PromoteForm({ onChanged, isDevUser }: { onChanged: () => void; isDevUser: boolean }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ id: string; email: string; displayName: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.admin
        .customers(search)
        .then((data) => setResults(data.customers))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handlePromote(userId: string, role: 'support' | 'dev' | 'admin') {
    setBusy(true);
    setError(null);
    try {
      await api.admin.setStaffRole(userId, role);
      setSearch('');
      setResults([]);
      toast(`User promoted to ${role} role`, 'success');
      onChanged();
    } catch (err: any) {
      setError(err.message);
      toast('Failed to promote user', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border border-white/[0.06]">
      <h2 className="font-semibold text-sm text-text-primary mb-1">Grant staff access credentials</h2>
      <p className="text-text-muted text-xs mb-4">
        Search for an existing customer account by email address. They must have registered and logged in once before they can be promoted.
      </p>
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      <div className="max-w-md mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by registered email address..."
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.05] pt-4 max-w-2xl">
          <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Search Results</p>
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between glass rounded-xl px-4 py-2 border border-white/[0.04]">
              <div className="min-w-0">
                <span className="text-xs font-medium text-text-primary truncate block">{r.displayName || 'Unset Display Name'}</span>
                <span className="text-[10px] text-text-muted font-mono truncate block">{r.email}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => handlePromote(r.id, 'support')}>
                  Support
                </Button>
                {isDevUser && (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => handlePromote(r.id, 'dev')}>
                    Dev
                  </Button>
                )}
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => handlePromote(r.id, 'admin')}>
                  Admin
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
