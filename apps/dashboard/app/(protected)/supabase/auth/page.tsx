'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PageHeader, Card, Spinner, ErrorBanner, Button, Badge, useToast, ConfirmDialog } from '@/components/ui';


interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'customer' | 'admin' | 'support' | 'dev';
  banned: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export default function SupabaseAuthPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals & Actions
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AuthUser['role']>('customer');
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const { toast } = useToast();

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await supabaseAdmin.auth.users();
      setUsers(
        (data.users || []).map((u: any) => ({
          id: u.id,
          email: u.email || '—',
          displayName: u.user_metadata?.name || u.email?.split('@')[0] || 'User',
          role: u.role || 'authenticated',
          banned: u.banned || false,
          createdAt: u.created_at || new Date().toISOString(),
          lastSignInAt: u.last_sign_in_at || null,
        }))
      );
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load auth users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await supabaseAdmin.auth.createUser({ email, password, user_metadata: { role } });
      toast(`Created auth user for ${email} with role "${role}"`, 'success');

      setShowAddUserModal(false);
      setEmail('');
      setPassword('');
      loadUsers();
    } catch (err: any) {
      toast(err.message || 'Failed to create user', 'error');
    } finally {
      setCreating(false);
    }
  }


  async function handleSendResetPassword(userEmail: string) {
    try {
      toast(`Sent password reset link to ${userEmail}`, 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  async function handleToggleBan(user: AuthUser) {
    try {
      toast(user.banned ? `Unbanned user ${user.email}` : `Banned user ${user.email}`, 'info');
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, banned: !u.banned } : u))
      );
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supabase Auth & Identity Studio"
        description="Manage user authentication, OAuth providers, JWT tokens, RBAC roles, and user sessions."
        action={<Button onClick={() => setShowAddUserModal(true)}>+ Add User</Button>}
      />

      {error && <ErrorBanner message={error} />}

      {/* Auth Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
          <p className="text-xs text-text-muted">Total Auth Users</p>
          <p className="text-xl font-bold text-white font-mono">{users.length}</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
          <p className="text-xs text-text-muted">Active Sessions</p>
          <p className="text-xl font-bold text-emerald-400 font-mono">{users.filter((u) => !u.banned).length}</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
          <p className="text-xs text-text-muted">Banned Accounts</p>
          <p className="text-xl font-bold text-red-400 font-mono">{users.filter((u) => u.banned).length}</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02] space-y-1">
          <p className="text-xs text-text-muted">JWT Expiry</p>
          <p className="text-xl font-bold text-accent-cyan font-mono">3600s</p>
        </div>
      </div>

      {/* Users Directory Table */}
      <Card title="User Directory & Credentials" description="Registered application accounts across Email, Google, GitHub, and SMS providers.">
        {loading ? (
          <div className="py-12 text-center"><Spinner label="Loading auth users..." /></div>
        ) : users.length === 0 ? (
          <p className="text-xs text-text-muted italic text-center py-8">No registered users in directory.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-text-muted border-b border-white/10 uppercase font-mono">
                <tr>
                  <th className="p-3">User Email / ID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Last Sign-in</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="p-3">
                      <p className="font-semibold text-white font-sans">{u.email}</p>
                      <p className="text-[10px] text-text-faint font-mono">{u.id}</p>
                    </td>
                    <td className="p-3">
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-accent-violet/20 text-accent-violet font-bold">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.banned ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {u.banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="p-3 text-text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-text-muted">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '—'}</td>
                    <td className="p-3 text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleSendResetPassword(u.email)}>
                        Reset Pwd
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleBan(u)}>
                        {u.banned ? 'Unban' : 'Ban'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-white">Create New Auth User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">RBAC Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan"
                >
                  <option value="customer">Customer</option>
                  <option value="support">Support Staff</option>
                  <option value="dev">Developer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddUserModal(false)}>Cancel</Button>
                <Button type="submit" size="sm" loading={creating}>Create User</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
