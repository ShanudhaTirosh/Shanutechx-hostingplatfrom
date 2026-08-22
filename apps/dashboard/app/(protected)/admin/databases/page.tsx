'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAppUser } from '@/lib/AppUserContext';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  useToast,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function DatabaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

const DB_TYPES = ['postgres', 'mysql', 'redis', 'mongodb'] as const;

const DB_COLORS: Record<string, string> = {
  postgres: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  mysql: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  redis: 'bg-red-500/10 text-red-300 border-red-500/20',
  mongodb: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const ROLE_BADGE: Record<string, string> = {
  dev: 'bg-fuchsia-500/10 text-fuchsia-300',
  admin: 'bg-accent-violet/10 text-accent-violet-light',
  support: 'bg-teal-500/10 text-teal-300',
  customer: 'bg-white/5 text-text-muted',
};

type UserOption = { id: string; email: string; displayName: string | null; role: string };

export default function AdminDatabasesPage() {
  const { apiUser } = useAppUser();
  const [databases, setDatabases] = useState<any[] | null>(null);
  const [type, setType] = useState<'postgres' | 'mysql' | 'redis' | 'mongodb'>('postgres');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // User picker state
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load() {
    api.managedDatabases
      .list()
      .then((d) => setDatabases(d.databases))
      .catch((e) => setError(e.message));
  }

  // Pre-fill current user as "self"
  useEffect(() => {
    if (apiUser && !selectedUser) {
      setSelectedUser({ id: apiUser.id, email: apiUser.email, displayName: apiUser.displayName ?? null, role: apiUser.role });
    }
  }, [apiUser]);

  useEffect(load, []);

  // Fetch users on search change
  useEffect(() => {
    if (!dropdownOpen) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setUsersLoading(true);
      api.admin.allUsers(userSearch || undefined)
        .then((d) => setUsers(d.users))
        .catch(() => setUsers([]))
        .finally(() => setUsersLoading(false));
    }, 250);
  }, [userSearch, dropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function openDropdown() {
    setDropdownOpen(true);
    setUserSearch('');
    setUsersLoading(true);
    api.admin.allUsers()
      .then((d) => setUsers(d.users))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }

  function selectUser(u: UserOption) {
    setSelectedUser(u);
    setDropdownOpen(false);
    setUserSearch('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setBusy(true);
    setError(null);
    try {
      await api.managedDatabases.create(selectedUser.id, type);
      toast(`Managed ${type} database provisioned successfully`, 'success');
      load();
    } catch (err: any) {
      setError(err.message);
      toast('Failed to provision database', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <PageHeader
        title="Managed Databases"
        description="Provision standalone Postgres, MySQL, Redis, or MongoDB databases assigned to users."
      />

      {error && <ErrorBanner message={error} />}

      {/* Provision form */}
      <Card className="border border-white/[0.06] bg-white/[0.01]">
        <h2 className="font-semibold text-sm text-text-primary mb-4 flex items-center gap-2">
          <PlusIcon /> Provision Database Container
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 items-end">

            {/* User Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Assign to User</label>
              <div className="relative" ref={dropdownRef}>
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={openDropdown}
                  className="w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50 text-left"
                >
                  {selectedUser ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[selectedUser.role] ?? ROLE_BADGE.customer}`}>
                        {selectedUser.role}
                      </span>
                      <span className="truncate text-text-primary">
                        {selectedUser.displayName || selectedUser.email}
                      </span>
                      <span className="text-text-faint text-xs truncate hidden sm:block">
                        {selectedUser.displayName ? selectedUser.email : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-muted">Select a user…</span>
                  )}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-faint shrink-0">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div className="absolute z-50 mt-1.5 w-full bg-[#0d0d1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
                      <SearchIcon />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search by name or email…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none"
                      />
                    </div>

                    {/* Self-assign shortcut */}
                    {apiUser && (
                      <button
                        type="button"
                        onClick={() => selectUser({ id: apiUser.id, email: apiUser.email, displayName: apiUser.displayName ?? null, role: apiUser.role })}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/[0.05] border-b border-white/[0.04] transition-colors"
                      >
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent-violet/10 text-accent-violet-light shrink-0">
                          {apiUser.role}
                        </span>
                        <span className="text-text-primary font-medium truncate">
                          {apiUser.displayName || apiUser.email}
                        </span>
                        <span className="text-text-faint text-xs ml-auto shrink-0">myself</span>
                      </button>
                    )}

                    {/* User list */}
                    <div className="max-h-52 overflow-y-auto">
                      {usersLoading ? (
                        <div className="px-4 py-3 text-xs text-text-muted">Loading users…</div>
                      ) : users.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-text-muted">No users found.</div>
                      ) : (
                        users
                          .filter((u) => u.id !== apiUser?.id)
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => selectUser(u)}
                              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/[0.05] transition-colors text-left ${
                                selectedUser?.id === u.id ? 'bg-accent-violet/10' : ''
                              }`}
                            >
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[u.role] ?? ROLE_BADGE.customer}`}>
                                {u.role}
                              </span>
                              <span className="text-text-primary truncate">{u.displayName || u.email}</span>
                              <span className="text-text-faint text-xs ml-auto truncate hidden sm:block max-w-[140px]">{u.email}</span>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DB Engine */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Database Engine</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50 capitalize"
              >
                {DB_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#0a0a14] capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {selectedUser && (
              <p className="text-xs text-text-faint font-mono">
                User ID: <span className="text-text-muted">{selectedUser.id}</span>
              </p>
            )}
            <Button type="submit" loading={busy} disabled={!selectedUser} className="ml-auto">
              {busy ? 'Provisioning…' : 'Provision DB'}
            </Button>
          </div>
        </form>
      </Card>

      {/* List of active databases */}
      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Active Database Containers</h2>

        {databases === null && <Spinner label="Loading managed databases..." />}
        {databases?.length === 0 && <EmptyState message="No managed databases provisioned yet." />}

        <div className="space-y-3">
          {databases?.map((db) => {
            const dbColorClass = DB_COLORS[db.type] ?? 'bg-white/5 text-text-muted border-white/10';
            return (
              <Card key={db.id} className="border border-white/[0.06] hover:border-white/10 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center shrink-0">
                      <DatabaseIcon />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${dbColorClass}`}>
                          {db.type}
                        </span>
                        <span className="text-xs text-text-muted font-mono">{db.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-text-muted text-xs mt-1 font-mono">
                        {db.internalHost}:{db.internalPort}
                      </p>
                      {db.user && (
                        <p className="text-text-faint text-xs mt-0.5">
                          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mr-1.5 ${ROLE_BADGE[db.user.role] ?? ROLE_BADGE.customer}`}>
                            {db.user.role}
                          </span>
                          {db.user.displayName || db.user.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto">
                    <Badge status={db.status} />

                    {/* Power Actions */}
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-1">
                      {db.status === 'stopped' ? (
                        <button
                          onClick={async () => {
                            try {
                              await api.managedDatabases.action(db.id, 'start');
                              toast('Starting database container...', 'success');
                              load();
                            } catch (e: any) {
                              toast(e.message, 'error');
                            }
                          }}
                          className="px-2 py-0.5 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                        >
                          ▶ Start
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              await api.managedDatabases.action(db.id, 'stop');
                              toast('Stopping database container...', 'info');
                              load();
                            } catch (e: any) {
                              toast(e.message, 'error');
                            }
                          }}
                          className="px-2 py-0.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 rounded transition-colors"
                        >
                          ⏹ Stop
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          try {
                            await api.managedDatabases.action(db.id, 'restart');
                            toast('Restarting database container...', 'info');
                            load();
                          } catch (e: any) {
                            toast(e.message, 'error');
                          }
                        }}
                        className="px-2 py-0.5 text-[11px] font-semibold text-accent-violet-light hover:bg-accent-violet/20 rounded transition-colors"
                      >
                        🔄 Restart
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          const res = await api.managedDatabases.connection(db.id);
                          navigator.clipboard.writeText(res.connectionString);
                          toast(`Copied ${db.type.toUpperCase()} DSN connection URI!`, 'success');
                        } catch (e: any) {
                          toast(e.message, 'error');
                        }
                      }}
                      className="text-xs text-accent-cyan hover:underline font-mono"
                    >
                      🔗 Copy DSN
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          const d = await api.managedDatabases.revealPassword(db.id);
                          navigator.clipboard.writeText(d.password);
                          toast(`Copied password for ${db.type.toUpperCase()} DB!`, 'success');
                        } catch (e: any) {
                          toast(e.message, 'error');
                        }
                      }}
                      className="text-xs text-accent-violet-light hover:underline font-mono"
                    >
                      🔑 Password
                    </button>

                    <button
                      onClick={async () => {
                        if (!window.confirm(`Are you sure you want to delete database ${db.id.slice(0, 8)}? This will destroy the container.`)) return;
                        try {
                          await api.managedDatabases.delete(db.id);
                          toast('Managed database deleted successfully', 'success');
                          load();
                        } catch (e: any) {
                          toast(e.message, 'error');
                        }
                      }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
