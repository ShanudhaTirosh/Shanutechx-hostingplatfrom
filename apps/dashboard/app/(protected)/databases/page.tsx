'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAppUser } from '@/lib/AppUserContext';
import { ManagedDatabase, ManagedDatabaseUser, Node } from '@/lib/types';
import { IconLock } from '@/components/Icons';

type ActiveTab = 'overview' | 'query' | 'scaling' | 'backups' | 'migration' | 'security' | 'connection';

interface BackupItem {
  backupId: string;
  databaseId: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

function calcManagedDbPrice(params: {
  type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
  storageLimitGb?: number | null;
  maxConnections?: number | null;
  backupCount?: number;
}) {
  const type = params.type || 'postgres';
  const engineBaseCost = type === 'mongodb' ? 12 : type === 'postgres' ? 10 : type === 'mysql' ? 10 : 8; // redis $8
  const cpuCost = (params.cpuLimit || 1) * 5; // $5 per 1 vCPU
  const ramCost = ((params.memoryLimitMb || 2048) / 1024) * 4; // $4 per 1GB RAM
  const storageCost = (params.storageLimitGb || 25) * 0.20; // $0.20 per 1GB storage
  const connCost = Math.ceil((params.maxConnections || 100) / 100) * 1.0; // $1.00 per 100 connections
  const backupsCost = (params.backupCount || 0) * 2.0; // $2.00 / snapshot dump / month

  const totalUsd = Math.round((engineBaseCost + cpuCost + ramCost + storageCost + connCost + backupsCost) * 100) / 100;
  const totalLkr = Math.round(totalUsd * 300); // 1 USD = 300 LKR

  return {
    engineBaseCost,
    cpuCost,
    ramCost,
    storageCost,
    connCost,
    backupsCost,
    totalUsd,
    totalLkr,
  };
}

const PRESET_TIERS = [
  { name: 'Micro', cpu: 0.5, memoryMb: 512, storageGb: 10, maxConn: 50 },
  { name: 'Starter', cpu: 1.0, memoryMb: 2048, storageGb: 25, maxConn: 100 },
  { name: 'Growth', cpu: 2.0, memoryMb: 4096, storageGb: 50, maxConn: 250 },
  { name: 'Performance', cpu: 4.0, memoryMb: 8192, storageGb: 100, maxConn: 500 },
  { name: 'Enterprise', cpu: 8.0, memoryMb: 16384, storageGb: 250, maxConn: 1000 },
];

export default function ManagedDatabasesPage() {
  const { apiUser } = useAppUser();
  const [databases, setDatabases] = useState<ManagedDatabase[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDb, setSelectedDb] = useState<ManagedDatabase | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

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
  const [showPassword, setShowPassword] = useState(false);

  // DB Users state
  const [dbUsers, setDbUsers] = useState<ManagedDatabaseUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'read_write' | 'read_only'>('read_write');
  const [createdUserNotice, setCreatedUserNotice] = useState<string | null>(null);

  // Query Console State
  const [queryInput, setQueryInput] = useState('SELECT * FROM pg_tables WHERE schemaname = \'public\';');
  const [isExecutingQuery, setIsExecutingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    ok: boolean;
    exitCode: number;
    rawOutput: string;
    executionTimeMs: number;
  } | null>(null);

  // Backups State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState<string | null>(null);

  // Resource Scaling State
  const [scaleCpu, setScaleCpu] = useState<number>(1);
  const [scaleRamMb, setScaleRamMb] = useState<number>(2048);
  const [scaleStorageGb, setScaleStorageGb] = useState<number>(25);
  const [scaleMaxConn, setScaleMaxConn] = useState<number>(100);
  const [isScaling, setIsScaling] = useState(false);

  // Node Migration State
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState(false);

  // Security / IP Whitelist & Master Pass State
  const [ipWhitelistInput, setIpWhitelistInput] = useState<string>('0.0.0.0/0');
  const [showRotatePassModal, setShowRotatePassModal] = useState(false);
  const [newMasterPass, setNewMasterPass] = useState('');
  const [isRotatingPass, setIsRotatingPass] = useState(false);

  // Provision Modal state
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provType, setProvType] = useState<'postgres' | 'mysql' | 'redis' | 'mongodb'>('postgres');
  const [provDbName, setProvDbName] = useState('app_db');
  const [provUsername, setProvUsername] = useState('db_master');
  const [provPassword, setProvPassword] = useState('');
  const [provAllowedIp, setProvAllowedIp] = useState('0.0.0.0/0');
  const [provMaxConn, setProvMaxConn] = useState(100);
  const [provCpu, setProvCpu] = useState(1);
  const [provRamMb, setProvRamMb] = useState(2048);
  const [provStorageGb, setProvStorageGb] = useState(25);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Notice State
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const isDevUser = apiUser?.role === 'dev';

  useEffect(() => {
    fetchDatabasesAndNodes();
  }, []);

  async function fetchDatabasesAndNodes() {
    setLoading(true);
    try {
      const [dbRes, nodeRes] = await Promise.all([
        api.managedDatabases.list(),
        api.nodes.list().catch(() => ({ nodes: [] })),
      ]);
      setDatabases(dbRes.databases);
      setNodes(nodeRes.nodes || []);
      if (dbRes.databases.length > 0 && !selectedDb) {
        selectDatabase(dbRes.databases[0]);
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
    setBackups([]);
    setQueryResult(null);
    setCreatedUserNotice(null);
    setShowPassword(false);

    // Set scaling sliders
    setScaleCpu(db.cpuLimit || 1);
    setScaleRamMb(db.memoryLimitMb || 2048);
    setScaleStorageGb(db.storageLimitGb || 25);
    setScaleMaxConn(db.maxConnections || 100);
    setIpWhitelistInput(db.allowedIps?.join(', ') || '0.0.0.0/0');

    // Default query sample based on engine
    if (db.type === 'postgres') {
      setQueryInput('SELECT * FROM pg_tables WHERE schemaname = \'public\';');
    } else if (db.type === 'mysql') {
      setQueryInput('SHOW TABLES;');
    } else if (db.type === 'redis') {
      setQueryInput('KEYS *');
    } else if (db.type === 'mongodb') {
      setQueryInput('db.stats()');
    }

    loadDatabaseDetails(db.id);
  }

  async function loadDatabaseDetails(id: string) {
    setLoadingConn(true);
    setLoadingUsers(true);
    setLoadingBackups(true);
    try {
      const [connRes, usersRes, backupRes] = await Promise.all([
        api.managedDatabases.getConnection(id).catch(() => null),
        api.managedDatabases.listUsers(id).catch(() => ({ users: [] })),
        api.managedDatabases.listBackups(id).catch(() => ({ backups: [] })),
      ]);
      if (connRes) setConnDetails(connRes);
      setDbUsers(usersRes.users || []);
      setBackups(backupRes.backups || []);
    } finally {
      setLoadingConn(false);
      setLoadingUsers(false);
      setLoadingBackups(false);
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
      await fetchDatabasesAndNodes();
      if (res.database) {
        selectDatabase(res.database);
        setActionNotice(`Provisioned ${provType.toUpperCase()} database '${res.database.dbName}' successfully!`);
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err: any) {
      alert(`Provisioning failed: ${err.message}`);
    } finally {
      setIsProvisioning(false);
    }
  }

  async function handleExecuteQuery(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedDb || !queryInput.trim()) return;
    setIsExecutingQuery(true);
    setQueryResult(null);
    try {
      const res = await api.managedDatabases.executeQuery(selectedDb.id, queryInput.trim());
      setQueryResult(res);
    } catch (err: any) {
      setQueryResult({
        ok: false,
        exitCode: 1,
        rawOutput: err.message || 'Query execution failed',
        executionTimeMs: 0,
      });
    } finally {
      setIsExecutingQuery(false);
    }
  }

  async function handleCreateBackup() {
    if (!selectedDb) return;
    setIsCreatingBackup(true);
    try {
      const res = await api.managedDatabases.backup(selectedDb.id);
      setActionNotice(`Snapshot backup '${res.backup.backupId}' created ($2.00/mo snapshot dump cost)!`);
      setTimeout(() => setActionNotice(null), 5000);
      const updatedBackups = await api.managedDatabases.listBackups(selectedDb.id);
      setBackups(updatedBackups.backups || []);
    } catch (err: any) {
      alert(`Snapshot backup failed: ${err.message}`);
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function handleRestoreBackup(backupId: string) {
    if (!selectedDb || !confirm(`Are you sure you want to restore snapshot '${backupId}'? Current data will be overwritten.`)) return;
    setIsRestoringBackup(backupId);
    try {
      await api.managedDatabases.restore(selectedDb.id, backupId);
      setActionNotice(`Database successfully restored from snapshot '${backupId}'!`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setIsRestoringBackup(null);
    }
  }

  async function handleScaleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDb) return;
    setIsScaling(true);
    try {
      const res = await api.managedDatabases.scale(selectedDb.id, {
        cpuLimit: scaleCpu,
        memoryLimitMb: scaleRamMb,
        storageLimitGb: scaleStorageGb,
        maxConnections: scaleMaxConn,
      });
      setActionNotice('Database cgroup resources and billing pricing scaled successfully!');
      setTimeout(() => setActionNotice(null), 4000);
      if (res.database) {
        setSelectedDb(res.database);
      }
      fetchDatabasesAndNodes();
    } catch (err: any) {
      alert(`Scaling failed: ${err.message}`);
    } finally {
      setIsScaling(false);
    }
  }

  async function handleMigrateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDb) return;
    if (!isDevUser) {
      alert('Unauthorized: Cluster node migration is restricted exclusively to dev superusers.');
      return;
    }
    setIsMigrating(true);
    try {
      const res = await api.managedDatabases.migrate(selectedDb.id, targetNodeId || undefined);
      setActionNotice(res.message || 'Database migrated successfully!');
      setTimeout(() => setActionNotice(null), 5000);
      fetchDatabasesAndNodes();
    } catch (err: any) {
      alert(`Migration failed: ${err.message}`);
    } finally {
      setIsMigrating(false);
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
      setCreatedUserNotice(`DB User '${res.user.username}' created! Password: ${res.user.password || '(configured)'}`);
      const usersRes = await api.managedDatabases.listUsers(selectedDb.id);
      setDbUsers(usersRes.users || []);
    } catch (err: any) {
      alert(`Failed to create DB user: ${err.message}`);
    }
  }

  async function handleDeleteUser(username: string) {
    if (!selectedDb || !confirm(`Delete DB user '${username}'?`)) return;
    try {
      await api.managedDatabases.deleteUser(selectedDb.id, username);
      const usersRes = await api.managedDatabases.listUsers(selectedDb.id);
      setDbUsers(usersRes.users || []);
    } catch (err: any) {
      alert(`Failed to delete DB user: ${err.message}`);
    }
  }

  async function handleUpdateIpWhitelist(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDb) return;
    const ips = ipWhitelistInput.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const res = await api.managedDatabases.updateConfig(selectedDb.id, { allowedIps: ips });
      if (res.database) setSelectedDb(res.database);
      setActionNotice('IP Whitelist firewall rules updated!');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to update IP whitelist: ${err.message}`);
    }
  }

  async function handleRotateMasterPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDb || !newMasterPass.trim()) return;
    setIsRotatingPass(true);
    try {
      await api.managedDatabases.rotateMasterPassword(selectedDb.id, newMasterPass.trim());
      setShowRotatePassModal(false);
      setNewMasterPass('');
      setActionNotice('Master password rotated live on container engine and vault!');
      setTimeout(() => setActionNotice(null), 5000);
      loadDatabaseDetails(selectedDb.id);
    } catch (err: any) {
      alert(`Password rotation failed: ${err.message}`);
    } finally {
      setIsRotatingPass(false);
    }
  }

  async function handleDbAction(action: 'start' | 'stop' | 'restart') {
    if (!selectedDb) return;
    try {
      await api.managedDatabases.action(selectedDb.id, action);
      setActionNotice(`Container action '${action}' sent to engine.`);
      setTimeout(() => setActionNotice(null), 4000);
      fetchDatabasesAndNodes();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  }

  // Selected DB Price Breakdown
  const currentPrice = selectedDb
    ? calcManagedDbPrice({
        type: selectedDb.type,
        cpuLimit: selectedDb.cpuLimit,
        memoryLimitMb: selectedDb.memoryLimitMb,
        storageLimitGb: selectedDb.storageLimitGb,
        maxConnections: selectedDb.maxConnections,
        backupCount: backups.length,
      })
    : null;

  // Scale Estimator Price
  const scalePrice = calcManagedDbPrice({
    type: selectedDb?.type || 'postgres',
    cpuLimit: scaleCpu,
    memoryLimitMb: scaleRamMb,
    storageLimitGb: scaleStorageGb,
    maxConnections: scaleMaxConn,
    backupCount: backups.length,
  });

  // Provisioning Price Preview
  const provPrice = calcManagedDbPrice({
    type: provType,
    cpuLimit: provCpu,
    memoryLimitMb: provRamMb,
    storageLimitGb: provStorageGb,
    maxConnections: provMaxConn,
    backupCount: 0,
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Managed DB Engines
            </span>
            <span className="text-xs text-text-faint">• Transparent Monthly Pricing & Snapshot Dump Costs</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Managed Database Clusters</h1>
          <p className="text-xs text-text-muted mt-1">
            Dedicated PostgreSQL, MySQL, Redis, and MongoDB engines with live query console, real snapshot dumps ($2/dump), dynamic cgroup scaling, and IP whitelisting.
          </p>
        </div>
        <button
          onClick={() => setShowProvisionModal(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Provision Engine
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-white hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-text-muted animate-pulse">Loading database clusters...</div>
      ) : databases.length === 0 ? (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-white">No Managed Database Engines Active</p>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Click &quot;Provision Engine&quot; to launch a dedicated PostgreSQL, MySQL, Redis, or MongoDB database container on your worker nodes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">
              Active Databases ({databases.length})
            </h2>
            <div className="space-y-2">
              {databases.map((db) => {
                const isSelected = selectedDb?.id === db.id;
                const dbPrice = calcManagedDbPrice({
                  type: db.type,
                  cpuLimit: db.cpuLimit,
                  memoryLimitMb: db.memoryLimitMb,
                  storageLimitGb: db.storageLimitGb,
                  maxConnections: db.maxConnections,
                  backupCount: selectedDb?.id === db.id ? backups.length : 0,
                });
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
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm font-semibold text-white">{db.dbName || db.id}</p>
                      <span className="text-xs font-bold text-emerald-400 font-mono">${dbPrice.totalUsd}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted mt-2">
                      <span>{db.cpuLimit || 1} vCPU • {db.memoryLimitMb || 2048}MB</span>
                      <span>Port: {db.internalPort || 'Auto'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details & Control Panel (8 cols) */}
          {selectedDb && (
            <div className="lg:col-span-8 space-y-6">
              {/* Header Box & Quick Actions */}
              <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase">{selectedDb.type} Engine</span>
                      <span className="text-xs text-text-muted">• v{selectedDb.dbVersion || 'latest'}</span>
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
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 pb-2">
                  {[
                    { id: 'overview', label: 'Overview & Pricing' },
                    { id: 'query', label: 'Query Console' },
                    { id: 'scaling', label: 'Scaling & Cost' },
                    { id: 'backups', label: 'Backups ($2/dump)' },
                    { id: 'migration', label: isDevUser ? 'Node Migration' : 'Node Migration (Dev Only)' },
                    { id: 'security', label: 'Access & Security' },
                    { id: 'connection', label: 'Connections' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as ActiveTab)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        activeTab === tab.id
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow'
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB 1: OVERVIEW & PRICING */}
                {activeTab === 'overview' && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                        <span className="text-[10px] text-text-muted uppercase font-semibold block">CPU Provisioned</span>
                        <span className="text-lg font-bold text-white">{selectedDb.cpuLimit || 1} vCPU</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                        <span className="text-[10px] text-text-muted uppercase font-semibold block">Memory RAM</span>
                        <span className="text-lg font-bold text-white">{selectedDb.memoryLimitMb || 2048} MB</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                        <span className="text-[10px] text-text-muted uppercase font-semibold block">Max Connections</span>
                        <span className="text-lg font-bold text-white">{selectedDb.maxConnections || 100}</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                        <span className="text-[10px] text-text-muted uppercase font-semibold block">Storage Limit</span>
                        <span className="text-lg font-bold text-white">{selectedDb.storageLimitGb || 25} GB</span>
                      </div>
                    </div>

                    {/* PRICING BREAKDOWN CARD */}
                    {currentPrice && (
                      <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-500/30 rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Monthly Pricing & Cost Breakdown</span>
                          <div className="text-right">
                            <span className="text-xl font-extrabold text-emerald-400 font-mono">${currentPrice.totalUsd}/mo</span>
                            <span className="text-[10px] text-text-muted block">LKR {currentPrice.totalLkr.toLocaleString()} / month</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                            <span className="text-[10px] text-text-muted block">Engine Base ({selectedDb.type})</span>
                            <span className="font-mono text-white">${currentPrice.engineBaseCost}.00 / mo</span>
                          </div>
                          <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                            <span className="text-[10px] text-text-muted block">CPU ({selectedDb.cpuLimit || 1} vCPU)</span>
                            <span className="font-mono text-white">${currentPrice.cpuCost}.00 / mo</span>
                          </div>
                          <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                            <span className="text-[10px] text-text-muted block">RAM ({selectedDb.memoryLimitMb || 2048} MB)</span>
                            <span className="font-mono text-white">${currentPrice.ramCost}.00 / mo</span>
                          </div>
                          <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                            <span className="text-[10px] text-text-muted block">Storage ({selectedDb.storageLimitGb || 25} GB)</span>
                            <span className="font-mono text-white">${currentPrice.storageCost.toFixed(2)} / mo</span>
                          </div>
                          <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                            <span className="text-[10px] text-text-muted block">Connections ({selectedDb.maxConnections || 100})</span>
                            <span className="font-mono text-white">${currentPrice.connCost.toFixed(2)} / mo</span>
                          </div>
                          <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                            <span className="text-[10px] text-text-muted block">Snapshot Dumps ({backups.length})</span>
                            <span className="font-mono text-emerald-400">${currentPrice.backupsCost.toFixed(2)} / mo</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-2 text-xs">
                      <h4 className="font-semibold text-white">Engine Metadata</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-text-muted">
                        <div>Host: <span className="text-white font-mono">{selectedDb.internalHost || 'local'}</span></div>
                        <div>Internal Port: <span className="text-white font-mono">{selectedDb.internalPort || 5432}</span></div>
                        <div>Database Name: <span className="text-white font-mono">{selectedDb.dbName || 'app'}</span></div>
                        <div>Allowed IPs: <span className="text-white font-mono">{selectedDb.allowedIps?.join(', ') || '0.0.0.0/0'}</span></div>
                        <div>Created: <span className="text-white font-mono">{new Date(selectedDb.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: QUERY CONSOLE */}
                {activeTab === 'query' && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Interactive Query Console</span>
                      <div className="flex gap-2">
                        {selectedDb.type === 'postgres' && (
                          <button
                            onClick={() => setQueryInput('SELECT * FROM pg_tables WHERE schemaname = \'public\';')}
                            className="px-2 py-1 rounded bg-white/5 text-[10px] text-text-muted hover:text-white"
                          >
                            Sample Tables Query
                          </button>
                        )}
                        {selectedDb.type === 'mysql' && (
                          <button
                            onClick={() => setQueryInput('SHOW TABLES;')}
                            className="px-2 py-1 rounded bg-white/5 text-[10px] text-text-muted hover:text-white"
                          >
                            Show Tables
                          </button>
                        )}
                        {selectedDb.type === 'redis' && (
                          <button
                            onClick={() => setQueryInput('KEYS *')}
                            className="px-2 py-1 rounded bg-white/5 text-[10px] text-text-muted hover:text-white"
                          >
                            List Keys
                          </button>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleExecuteQuery} className="space-y-3">
                      <textarea
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        rows={4}
                        placeholder="Enter query command..."
                        className="w-full bg-black/80 border border-white/10 rounded-xl p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-emerald-500"
                      />

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isExecutingQuery}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                        >
                          {isExecutingQuery ? 'Executing Query...' : 'Run Query'}
                        </button>
                      </div>
                    </form>

                    {queryResult && (
                      <div className="p-4 bg-black/90 border border-white/10 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-text-muted border-b border-white/10 pb-2">
                          <span>Execution Status: <span className={queryResult.ok ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{queryResult.ok ? 'SUCCESS (0)' : `ERROR (${queryResult.exitCode})`}</span></span>
                          <span>Time: {queryResult.executionTimeMs} ms</span>
                        </div>
                        <pre className="font-mono text-xs text-white max-h-60 overflow-y-auto whitespace-pre-wrap">
                          {queryResult.rawOutput || '(No output returned)'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: SCALING & DYNAMIC COST ESTIMATOR */}
                {activeTab === 'scaling' && (
                  <div className="space-y-5 pt-2">
                    {/* DYNAMIC COST ESTIMATOR BANNER */}
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white uppercase block">Estimated Scale Price</span>
                        <span className="text-[11px] text-text-muted">Calculated in real time based on configured cgroups</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-emerald-400 font-mono">${scalePrice.totalUsd}/mo</span>
                        <span className="text-[10px] text-text-muted block">LKR {scalePrice.totalLkr.toLocaleString()} / mo</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white mb-2">Preset Compute Tiers</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {PRESET_TIERS.map((tier) => {
                          const tierPrice = calcManagedDbPrice({
                            type: selectedDb.type,
                            cpuLimit: tier.cpu,
                            memoryLimitMb: tier.memoryMb,
                            storageLimitGb: tier.storageGb,
                            maxConnections: tier.maxConn,
                            backupCount: backups.length,
                          });
                          return (
                            <button
                              key={tier.name}
                              type="button"
                              onClick={() => {
                                setScaleCpu(tier.cpu);
                                setScaleRamMb(tier.memoryMb);
                                setScaleStorageGb(tier.storageGb);
                                setScaleMaxConn(tier.maxConn);
                              }}
                              className="p-3 bg-white/[0.02] border border-white/10 rounded-xl hover:border-emerald-500/40 text-left transition-all"
                            >
                              <span className="text-xs font-bold text-white block">{tier.name}</span>
                              <span className="text-[11px] font-bold text-emerald-400 block">${tierPrice.totalUsd}/mo</span>
                              <span className="text-[10px] text-text-muted block mt-1">{tier.cpu} vCPU • {tier.memoryMb}MB</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <form onSubmit={handleScaleSubmit} className="space-y-4 border-t border-white/10 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">
                            CPU Cores Limit ({scaleCpu} vCPU) — <span className="text-emerald-400">${scalePrice.cpuCost}/mo</span>
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="16"
                            step="0.5"
                            value={scaleCpu}
                            onChange={(e) => setScaleCpu(parseFloat(e.target.value))}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">
                            RAM Memory ({scaleRamMb} MB) — <span className="text-emerald-400">${scalePrice.ramCost}/mo</span>
                          </label>
                          <input
                            type="range"
                            min="256"
                            max="32768"
                            step="256"
                            value={scaleRamMb}
                            onChange={(e) => setScaleRamMb(parseInt(e.target.value, 10))}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">
                            Storage Allocation ({scaleStorageGb} GB) — <span className="text-emerald-400">${scalePrice.storageCost.toFixed(2)}/mo</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={scaleStorageGb}
                            onChange={(e) => setScaleStorageGb(parseInt(e.target.value, 10))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">
                            Max Connections ({scaleMaxConn}) — <span className="text-emerald-400">${scalePrice.connCost.toFixed(2)}/mo</span>
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="5000"
                            value={scaleMaxConn}
                            onChange={(e) => setScaleMaxConn(parseInt(e.target.value, 10))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isScaling}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl disabled:opacity-50"
                      >
                        {isScaling ? 'Scaling cgroups & billing...' : `Apply Resource Scale ($${scalePrice.totalUsd}/mo)`}
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 4: BACKUPS ($2/DUMP COST) */}
                {activeTab === 'backups' && (
                  <div className="space-y-4 pt-2">
                    <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Snapshot Backup Storage Pricing</span>
                        <span className="text-[11px] text-text-muted">Each snapshot dump costs <strong>$2.00 / month</strong> for node storage retention.</span>
                      </div>
                      <span className="text-sm font-bold text-violet-300 font-mono font-bold">${backups.length * 2}.00 / mo ({backups.length} snapshots)</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">Snapshot Dumps & Restores</h4>
                        <p className="text-[11px] text-text-muted">Real container dumps stored on node storage.</p>
                      </div>
                      <button
                        onClick={handleCreateBackup}
                        disabled={isCreatingBackup}
                        className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-semibold rounded-xl"
                      >
                        {isCreatingBackup ? 'Creating Dump...' : '+ Take Snapshot Dump ($2/mo)'}
                      </button>
                    </div>

                    {loadingBackups ? (
                      <div className="text-xs text-text-muted animate-pulse">Loading snapshot backups...</div>
                    ) : backups.length === 0 ? (
                      <div className="text-xs text-text-muted py-4 text-center">No snapshot backups found.</div>
                    ) : (
                      <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
                        {backups.map((b) => (
                          <div key={b.backupId} className="p-3.5 bg-white/[0.01] flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-white font-mono block">{b.backupId}</span>
                              <span className="text-[10px] text-text-muted">
                                Size: {(b.sizeBytes / 1024 / 1024).toFixed(2)} MB • Cost: $2.00/mo • Created: {new Date(b.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRestoreBackup(b.backupId)}
                              disabled={isRestoringBackup === b.backupId}
                              className="px-3 py-1 bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-xs font-semibold rounded-lg"
                            >
                              {isRestoringBackup === b.backupId ? 'Restoring...' : 'Restore'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: NODE MIGRATION (RESTRICTED TO DEV ROLE ONLY) */}
                {activeTab === 'migration' && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        Cluster Compute Node Migration
                        {!isDevUser && (
                          <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-semibold uppercase">
                            Dev Superuser Restricted
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-text-muted">Relocate database instance live to another registered compute node.</p>
                    </div>

                    {!isDevUser ? (
                      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center space-y-2">
                        <p className="text-xs font-bold text-red-300 flex items-center gap-1"><IconLock size={11} className="inline" /> Node Migration Restricted</p>
                        <p className="text-xs text-text-muted max-w-md mx-auto">
                          As per platform security policy, database container node migration is restricted exclusively to dev superusers (`role: dev`). Regular customers and standard admin roles cannot initiate database node relocations.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleMigrateSubmit} className="space-y-4 bg-white/[0.02] border border-white/10 p-4 rounded-xl">
                        <div>
                          <label className="block text-xs font-semibold text-text-muted mb-1">Target Compute Node</label>
                          <select
                            value={targetNodeId}
                            onChange={(e) => setTargetNodeId(e.target.value)}
                            className="w-full bg-[#121324] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          >
                            <option value="">Auto Select Optimal Node</option>
                            {nodes.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.label || n.ip} ({n.ip}) - {n.region || 'global'}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={isMigrating}
                          className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-black font-bold text-xs rounded-xl disabled:opacity-50"
                        >
                          {isMigrating ? 'Migrating Container...' : 'Migrate Database to Node'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* TAB 6: SECURITY & USERS */}
                {activeTab === 'security' && (
                  <div className="space-y-6 pt-2">
                    {/* DB User Accounts */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white">Database User Accounts ({dbUsers.length})</h4>
                        <button
                          onClick={() => setShowAddUserModal(true)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-xs font-semibold text-white rounded-xl"
                        >
                          + Add DB User
                        </button>
                      </div>

                      {createdUserNotice && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-300">
                          {createdUserNotice}
                        </div>
                      )}

                      {dbUsers.length === 0 ? (
                        <div className="text-xs text-text-muted py-2">No custom DB users created.</div>
                      ) : (
                        <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
                          {dbUsers.map((u) => (
                            <div key={u.id} className="p-3 bg-white/[0.01] flex items-center justify-between">
                              <div>
                                <span className="text-xs font-bold text-white font-mono">{u.username}</span>
                                <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 font-semibold border border-violet-500/20">
                                  Role: {u.role}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteUser(u.username)}
                                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold rounded"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* IP Whitelist */}
                    <form onSubmit={handleUpdateIpWhitelist} className="space-y-3 border-t border-white/10 pt-4">
                      <h4 className="text-xs font-bold text-white">IP Whitelist Firewall</h4>
                      <div>
                        <label className="block text-[11px] text-text-muted mb-1">Allowed IPs (comma separated CIDRs)</label>
                        <input
                          type="text"
                          value={ipWhitelistInput}
                          onChange={(e) => setIpWhitelistInput(e.target.value)}
                          placeholder="0.0.0.0/0, 192.168.1.1/32"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-white/10 hover:bg-white/15 text-xs font-bold text-white rounded-xl">
                        Update Firewall Rules
                      </button>
                    </form>

                    {/* Master Password Rotation */}
                    <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">Master Password</h4>
                        <p className="text-[11px] text-text-muted">Rotate root/master database password live on container engine.</p>
                      </div>
                      <button
                        onClick={() => setShowRotatePassModal(true)}
                        className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-xl"
                      >
                        Rotate Password
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 7: CONNECTIONS */}
                {activeTab === 'connection' && (
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-white">Connection String & DSN</h4>
                    {loadingConn ? (
                      <div className="text-xs text-text-muted animate-pulse">Loading connection keys...</div>
                    ) : connDetails ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-black/80 border border-white/10 rounded-xl font-mono text-xs text-emerald-400 break-all select-all flex items-center justify-between">
                          <span>
                            {showPassword
                              ? connDetails.connectionString
                              : connDetails.connectionString.replace(encodeURIComponent(connDetails.password || ''), '••••••••')}
                          </span>
                          <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="px-2 py-1 text-[10px] bg-white/10 text-white rounded hover:bg-white/20"
                          >
                            {showPassword ? 'Hide' : 'Reveal'}
                          </button>
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
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROVISION MODAL */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0c16] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Provision Managed Database Cluster</h3>
              <button onClick={() => setShowProvisionModal(false)} className="text-text-muted hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Master DB Username</label>
                  <input
                    type="text"
                    value={provUsername}
                    onChange={(e) => setProvUsername(e.target.value)}
                    placeholder="db_master"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Dynamic Cost Preview */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-white">Automated Plan Monthly Cost</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">${provPrice.totalUsd}/mo (LKR {provPrice.totalLkr.toLocaleString()})</span>
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
                  {isProvisioning ? 'Provisioning...' : `Provision Engine ($${provPrice.totalUsd}/mo)`}
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
              <button onClick={() => setShowAddUserModal(false)} className="text-text-muted hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Assigned Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full bg-[#121324] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="read_write">Read & Write</option>
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

      {/* ROTATE MASTER PASSWORD MODAL */}
      {showRotatePassModal && selectedDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b0c16] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Rotate Master Password</h3>
              <button onClick={() => setShowRotatePassModal(false)} className="text-text-muted hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>

            <form onSubmit={handleRotateMasterPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">New Master Password *</label>
                <input
                  type="password"
                  required
                  value={newMasterPass}
                  onChange={(e) => setNewMasterPass(e.target.value)}
                  placeholder="At least 8 characters..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRotatePassModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRotatingPass}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black disabled:opacity-50"
                >
                  {isRotatingPass ? 'Rotating...' : 'Rotate Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
