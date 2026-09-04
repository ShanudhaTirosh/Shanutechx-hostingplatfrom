'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ManagedDatabase, ManagedDatabaseUser } from '@/lib/types';

export default function ManagedDatabasesPage() {
  const [databases, setDatabases] = useState<ManagedDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDb, setSelectedDb] = useState<ManagedDatabase | null>(null);

  // Connection details state
  const [connDetails, setConnDetails] = useState<{
    type: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    databaseName: string;
    connectionString: string;
  } | null>(null);
  const [loadingConn, setLoadingConn] = useState(false);

  // DB Users state
  const [dbUsers, setDbUsers] = useState<ManagedDatabaseUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'read_write' | 'read_only'>('read_write');
  const [createdUserNotice, setCreatedUserNotice] = useState<string | null>(null);

  // Provision Modal state
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provType, setProvType] = useState<'postgres' | 'mysql' | 'redis' | 'mongodb'>('postgres');
  const [provDbName, setProvDbName] = useState('app_db');
  const [provUsername, setProvUsername] = useState('db_master');
  const [provPassword, setProvPassword] = useState('');
  const [provAllowedIp, setProvAllowedIp] = useState('0.0.0.0/0');
  const [provMaxConn, setProvMaxConn] = useState(100);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Action state
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchDatabases();
  }, []);

  async function fetchDatabases() {
    setLoading(true);
    try {
      const res = await api.managedDatabases.list();
      setDatabases(res.databases);
      if (res.databases.length > 0 && !selectedDb) {
        selectDatabase(res.databases[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function selectDatabase(db: ManagedDatabase) {
    setSelectedDb(db);
    setConnDetails(null);
    setDbUsers([]);
    setCreatedUserNotice(null);
    loadConnectionAndUsers(db.id);
  }

  async function loadConnectionAndUsers(id: string) {
    setLoadingConn(true);
    setLoadingUsers(true);
    try {
      const [connRes, usersRes] = await Promise.all([
        api.managedDatabases.getConnection(id).catch(() => null),
        api.managedDatabases.listUsers(id).catch(() => ({ users: [] })),
      ]);
      if (connRes) setConnDetails(connRes);
      setDbUsers(usersRes.users);
    } finally {
      setLoadingConn(false);
      setLoadingUsers(false);
    }
  }

  async function handleProvisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProvisioning(true);
    try {
      const res = await api.managedDatabases.create({
        type: provType,
        dbName: provDbName.trim() || 'main_db',
        masterUsername: provUsername.trim() || 'db_admin',
        masterPassword: provPassword.trim() || undefined,
        allowedIps: [provAllowedIp.trim() || '0.0.0.0/0'],
        maxConnections: Number(provMaxConn) || 100,
      });
      setShowProvisionModal(false);
      await fetchDatabases();
      if (res.database) {
        selectDatabase(res.database);
        setActionNotice(`Successfully provisioned ${provType.toUpperCase()} database '${res.database.dbName}'!`);
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err: any) {
      alert(`Provisioning failed: ${err.message}`);
    } finally {
      setIsProvisioning(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDb || !newUsername.trim()) return;

    try {
      const res = await api.managedDatabases.createUser(selectedDb.id, {
        username: newUsername.trim(),
        password: newUserPass.trim() || undefined,
        role: newUserRole,
      });
      setShowAddUserModal(false);
      setNewUsername('');
      setNewUserPass('');
      setCreatedUserNotice(`User '${res.user.username}' created! Password: ${res.user.password || '(configured)'}`);
      loadConnectionAndUsers(selectedDb.id);
    } catch (err: any) {
      alert(`Failed to create DB user: ${err.message}`);
    }
  }

  async function handleDeleteUser(username: string) {
    if (!selectedDb || !confirm(`Delete database user '${username}'?`)) return;
    try {
      await api.managedDatabases.deleteUser(selectedDb.id, username);
      loadConnectionAndUsers(selectedDb.id);
    } catch (err: any) {
      alert(`Failed to delete DB user: ${err.message}`);
    }
  }

  async function handleDbAction(action: 'start' | 'stop' | 'restart') {
    if (!selectedDb) return;
    try {
      await api.managedDatabases.action(selectedDb.id, action);
      setActionNotice(`Container action '${action}' triggered for ${selectedDb.dbName || selectedDb.id}`);
      setTimeout(() => setActionNotice(null), 4000);
      fetchDatabases();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  }

  async function handleTriggerBackup() {
    if (!selectedDb) return;
    try {
      const res = await api.managedDatabases.backup(selectedDb.id);
      alert(`Backup snapshot created! Key: ${res.backupKey}`);
    } catch (err: any) {
      alert(`Backup failed: ${err.message}`);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Managed Relational & NoSQL
            </span>
            <span className="text-xs text-text-faint">• Live Cluster Nodes</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Managed Database Engines</h1>
          <p className="text-xs text-text-muted mt-1">
            Provision dedicated Postgres, MySQL, Redis, or MongoDB instances with custom DB-level user accounts, connection strings, max connection limits, and automated backups.
          </p>
        </div>
        <button
          onClick={() => setShowProvisionModal(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Provision New Database
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-white hover:text-red-400">✕</button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-text-muted animate-pulse">Loading database instances...</div>
      ) : databases.length === 0 ? (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-white">No Managed Database Engines Provisioned</p>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Click &quot;Provision New Database&quot; to launch a managed PostgreSQL, MySQL, Redis, or MongoDB database container on your cluster worker nodes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Database List sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">
              Active Database Instances ({databases.length})
            </h2>
            <div className="space-y-2">
              {databases.map((db) => {
                const isSelected = selectedDb?.id === db.id;
                return (
                  <button
                    key={db.id}
                    onClick={() => selectDatabase(db)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg'
                        : 'bg-[#0b0c16] border-white/10 text-text-muted hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">{db.type}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                          db.status === 'running'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : db.status === 'stopped'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {db.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white mt-1">{db.dbName || db.id}</p>
                    <div className="flex items-center justify-between text-[11px] text-text-muted mt-2">
                      <span>Host: {db.internalHost || 'local'}</span>
                      <span>Port: {db.internalPort || 'Auto'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Database Details & Users Management (8 cols) */}
          {selectedDb && (
            <div className="lg:col-span-8 space-y-6">
              {/* Selected DB Header & Power controls */}
              <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase">{selectedDb.type} ENGINE</span>
                      <span className="text-xs text-text-muted">• Version {selectedDb.dbVersion || 'latest'}</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mt-0.5">{selectedDb.dbName || selectedDb.id}</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDbAction('start')}
                      disabled={selectedDb.status === 'running'}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white disabled:opacity-30"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => handleDbAction('stop')}
                      disabled={selectedDb.status !== 'running'}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-amber-300 disabled:opacity-30"
                    >
                      Stop
                    </button>
                    <button
                      onClick={() => handleDbAction('restart')}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white"
                    >
                      Restart
                    </button>
                    <button
                      onClick={handleTriggerBackup}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-semibold"
                    >
                      Snapshot Backup
                    </button>
                  </div>
                </div>

                {/* Connection String & Credentials box */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Connection DSN & Credentials
                  </h3>

                  {loadingConn ? (
                    <div className="text-xs text-text-muted animate-pulse">Loading connection keys...</div>
                  ) : connDetails ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-black/60 border border-white/10 rounded-xl font-mono text-xs text-emerald-400 break-all select-all flex items-center justify-between">
                        <span>{connDetails.connectionString}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
                        <div>
                          <span className="text-text-muted block text-[10px]">Host</span>
                          <span className="font-semibold text-white">{connDetails.host}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px]">Port</span>
                          <span className="font-semibold text-white">{connDetails.port}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px]">Database Name</span>
                          <span className="font-semibold text-white">{connDetails.databaseName}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px]">Master User</span>
                          <span className="font-semibold text-white">{connDetails.username}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* DB Users Accounts Manager */}
              <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Database Users & Access Control ({dbUsers.length})
                    </h3>
                    <p className="text-xs text-text-muted">
                      Database-level credentials created specifically inside this database engine instance.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all"
                  >
                    + Create DB User
                  </button>
                </div>

                {createdUserNotice && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-300 flex items-center justify-between">
                    <span>{createdUserNotice}</span>
                    <button onClick={() => setCreatedUserNotice(null)} className="text-white">✕</button>
                  </div>
                )}

                {loadingUsers ? (
                  <div className="text-xs text-text-muted animate-pulse">Loading database user accounts...</div>
                ) : dbUsers.length === 0 ? (
                  <div className="text-xs text-text-muted py-4">No custom database users created yet.</div>
                ) : (
                  <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
                    {dbUsers.map((u) => (
                      <div key={u.id} className="p-3.5 bg-white/[0.01] flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white font-mono">{u.username}</span>
                          <span className="ml-2 text-[10px] uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-semibold">
                            Role: {u.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROVISION NEW DATABASE MODAL */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0c16] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Provision Managed Database Engine</h3>
              <button onClick={() => setShowProvisionModal(false)} className="text-text-muted hover:text-white">✕</button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Select Engine Type *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['postgres', 'mysql', 'redis', 'mongodb'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setProvType(t)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all border ${
                        provType === t
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/[0.03] text-text-muted border-white/10 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Database Name</label>
                  <input
                    type="text"
                    value={provDbName}
                    onChange={(e) => setProvDbName(e.target.value)}
                    placeholder="my_production_db"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Master DB Username</label>
                  <input
                    type="text"
                    value={provUsername}
                    onChange={(e) => setProvUsername(e.target.value)}
                    placeholder="db_master"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Master Password (Optional)</label>
                <input
                  type="password"
                  value={provPassword}
                  onChange={(e) => setProvPassword(e.target.value)}
                  placeholder="Leave empty for secure random password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Allowed IP Whitelist</label>
                  <input
                    type="text"
                    value={provAllowedIp}
                    onChange={(e) => setProvAllowedIp(e.target.value)}
                    placeholder="0.0.0.0/0"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Max Connections</label>
                  <input
                    type="number"
                    value={provMaxConn}
                    onChange={(e) => setProvMaxConn(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black disabled:opacity-50"
                >
                  {isProvisioning ? 'Provisioning...' : 'Provision Engine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DB USER MODAL */}
      {showAddUserModal && selectedDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0c16] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Add User Account to {selectedDb.dbName}</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-text-muted hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="app_user"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Password (Optional)</label>
                <input
                  type="password"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  placeholder="Leave empty for auto-generated password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Assigned Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full bg-[#121324] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="read_write">Read & Write (Default)</option>
                  <option value="read_only">Read Only</option>
                  <option value="admin">Database Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
