'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { api } from '@/lib/api';
import { Project, ProjectTable, ManagedDatabase, ManagedDatabaseUser, Node } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import {
  Card,
  Button,
  Badge,
  Spinner,
  ErrorBanner,
  EmptyState,
  Input,
  PageHeader,
  Tabs,
  useToast,
  Modal,
} from '@/components/ui';
import { CreateTablePanel } from '@/components/CreateTablePanel';
import {
  Database,
  Table as TableIcon,
  Terminal,
  Key,
  Shield,
  Users as UsersIcon,
  Puzzle,
  Save,
  Activity,
  Settings,
  Plus,
  Play,
  Square,
  RotateCw,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sliders,
  AlertTriangle,
  FileText,
  Search,
  ChevronRight,
  Download,
  Upload,
  UserPlus,
  Server,
  Layers,
  ArrowRight,
  RefreshCw,
  GitBranch,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type TabId =
  | 'databases'
  | 'table-editor'
  | 'sql-runner'
  | 'schema-erd'
  | 'connection'
  | 'users'
  | 'extensions'
  | 'backups'
  | 'monitoring'
  | 'settings';

const PRESET_TIERS = [
  { name: 'Micro', cpu: 0.5, memoryMb: 512, storageGb: 10, maxConn: 50 },
  { name: 'Starter', cpu: 1.0, memoryMb: 2048, storageGb: 25, maxConn: 100 },
  { name: 'Growth', cpu: 2.0, memoryMb: 4096, storageGb: 50, maxConn: 250 },
  { name: 'Performance', cpu: 4.0, memoryMb: 8192, storageGb: 100, maxConn: 500 },
  { name: 'Enterprise', cpu: 8.0, memoryMb: 16384, storageGb: 250, maxConn: 1000 },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { apiUser } = useAppUser();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [databases, setDatabases] = useState<ManagedDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useState<ManagedDatabase | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('databases');
  const [error, setError] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  // Table Editor state
  const [tables, setTables] = useState<ProjectTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<any[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);
  const [insertRowModalOpen, setInsertRowModalOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});

  // SQL Editor state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM information_schema.tables WHERE table_schema = \'public\';');
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [sqlResult, setSqlResult] = useState<any | null>(null);
  const [savedSnippets, setSavedSnippets] = useState<Array<{ id: string; title: string; query: string; createdAt: string }>>([]);
  const [snippetTitle, setSnippetTitle] = useState('');
  const [saveSnippetModalOpen, setSaveSnippetModalOpen] = useState(false);
  const [sqlHistory, setSqlHistory] = useState<Array<{ query: string; timestamp: string; durationMs: number; ok: boolean }>>([]);

  // Schema & ERD state
  const [schemaData, setSchemaData] = useState<{ tables: any[] } | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Connection & Security state
  const [connDetails, setConnDetails] = useState<any | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [usePgBouncer, setUsePgBouncer] = useState(true);
  const [sslMode, setSslMode] = useState<'require' | 'prefer' | 'disable'>('require');
  const [ipWhitelist, setIpWhitelist] = useState<string>('0.0.0.0/0');
  const [savingIpWhitelist, setSavingIpWhitelist] = useState(false);

  // DB Users state
  const [dbUsers, setDbUsers] = useState<ManagedDatabaseUser[]>([]);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [newDbUsername, setNewDbUsername] = useState('');
  const [newDbUserPass, setNewDbUserPass] = useState('');
  const [newDbUserRole, setNewDbUserRole] = useState<'admin' | 'read_write' | 'read_only'>('read_write');
  const [createdUserPasswordNotice, setCreatedUserPasswordNotice] = useState<string | null>(null);

  // Extensions state
  const [extensions, setExtensions] = useState<Array<{ name: string; description?: string; isEnabled?: boolean; enabled?: boolean; installedVersion?: string; comment?: string }>>([]);
  const [loadingExtensions, setLoadingExtensions] = useState(false);

  // Backups state
  const [backups, setBackups] = useState<any[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Monitoring state
  const [metrics, setMetrics] = useState<any | null>(null);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [logSearch, setLogSearch] = useState('');

  // Settings & Members state
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [inviteMemberEmail, setInviteMemberEmail] = useState('');
  const [inviteMemberRole, setInviteMemberRole] = useState<'admin' | 'developer' | 'read_only'>('developer');
  const [invitingMember, setInvitingMember] = useState(false);

  // Provision Database Modal
  const [provDbModalOpen, setProvDbModalOpen] = useState(false);
  const [provEngine, setProvEngine] = useState<'postgres' | 'mysql' | 'redis' | 'mongodb'>('postgres');
  const [provDbName, setProvDbName] = useState('app_db');
  const [provMasterUser, setProvMasterUser] = useState('db_master');
  const [provCpu, setProvCpu] = useState(1);
  const [provRamMb, setProvRamMb] = useState(2048);
  const [provStorageGb, setProvStorageGb] = useState(25);
  const [provMaxConn, setProvMaxConn] = useState(100);
  const [isProvisioningDb, setIsProvisioningDb] = useState(false);

  const TABS = [
    { label: 'Databases', value: 'databases' },
    { label: 'Table Editor', value: 'table-editor' },
    { label: 'SQL Editor', value: 'sql-runner' },
    { label: 'Schema & ERD', value: 'schema-erd' },
    { label: 'Connection & SSL', value: 'connection' },
    { label: 'DB Users & Access', value: 'users' },
    { label: 'Extensions', value: 'extensions' },
    { label: 'Backups & Restore', value: 'backups' },
    { label: 'Monitoring & Logs', value: 'monitoring' },
    { label: 'Settings & Members', value: 'settings' },
  ];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const loadProject = useCallback(() => {
    api.projects
      .get(params.id)
      .then((d) => {
        setProject(d.project);
        setEditProjectName(d.project.name);
        setEditProjectDesc(d.project.description || '');
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  const loadDatabases = useCallback(() => {
    api.managedDatabases
      .listByProject(params.id)
      .then((d) => {
        setDatabases(d.databases || []);
        if (d.databases?.length > 0 && !selectedDb) {
          setSelectedDb(d.databases[0]);
        }
      })
      .catch(() => {});
  }, [params.id, selectedDb]);

  const loadNodes = useCallback(() => {
    api.nodes.list().then((d) => setNodes(d.nodes || [])).catch(() => {});
  }, []);

  const loadTables = useCallback(() => {
    api.projects
      .tables(params.id)
      .then((d) => {
        setTables(d.tables || []);
        if (!selectedTable && d.tables?.length > 0) {
          setSelectedTable(d.tables[0].name);
        }
      })
      .catch(() => {});
  }, [params.id, selectedTable]);

  useEffect(() => {
    loadProject();
    loadDatabases();
    loadNodes();
  }, [loadProject, loadDatabases, loadNodes]);

  // Load details whenever selected database changes
  useEffect(() => {
    if (!selectedDb?.id) return;

    // Load connection details
    api.managedDatabases
      .getConnection(selectedDb.id)
      .then((c) => {
        setConnDetails(c);
        setIpWhitelist(c.allowedIps?.join(', ') || '0.0.0.0/0');
      })
      .catch(() => {});

    // Load DB Users
    api.managedDatabases.listUsers(selectedDb.id).then((u) => setDbUsers(u.users || [])).catch(() => {});

    // Load Extensions
    setLoadingExtensions(true);
    api.managedDatabases
      .getExtensions(selectedDb.id)
      .then((e) => setExtensions(e.extensions || []))
      .catch(() => {})
      .finally(() => setLoadingExtensions(false));

    // Load Backups
    api.managedDatabases.listBackups(selectedDb.id).then((b) => setBackups(b.backups || [])).catch(() => {});

    // Load Metrics
    api.managedDatabases.getMetrics(selectedDb.id).then((m) => setMetrics(m.metrics || null)).catch(() => {});

    // Load System Logs
    api.managedDatabases
      .getLogs(selectedDb.id)
      .then((l) => {
        if (typeof l.logs === 'string') {
          setSystemLogs([{ timestamp: new Date().toISOString(), message: l.logs }]);
        } else {
          setSystemLogs(l.logs || []);
        }
      })
      .catch(() => {});

    // Load Tables for Table Editor
    loadTables();

    // Load Saved Snippets
    api.projects.listSnippets(params.id).then((s) => setSavedSnippets(s.snippets || [])).catch(() => {});
  }, [selectedDb?.id, params.id, loadTables]);

  // Load Table Rows when selectedTable changes
  useEffect(() => {
    if (!selectedTable) return;
    setLoadingRows(true);
    api.projects
      .query(params.id, `SELECT * FROM "${selectedTable.replace(/"/g, '""')}" LIMIT 100;`)
      .then((res) => {
        if (res.ok && res.rows) {
          setTableRows(res.rows);
          if (res.rows.length > 0) {
            setTableColumns(Object.keys(res.rows[0]));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRows(false));
  }, [selectedTable, params.id]);

  // Load Schema for Schema & ERD tab
  const loadSchema = useCallback(() => {
    if (!selectedDb?.id) return;
    setLoadingSchema(true);
    api.managedDatabases
      .getSchema(selectedDb.id)
      .then((s) => setSchemaData(s))
      .catch(() => {})
      .finally(() => setLoadingSchema(false));
  }, [selectedDb?.id]);

  useEffect(() => {
    if (activeTab === 'schema-erd') {
      loadSchema();
    }
  }, [activeTab, loadSchema]);

  async function handleProvisionDatabase(e: React.FormEvent) {
    e.preventDefault();
    setIsProvisioningDb(true);
    try {
      const res = await api.managedDatabases.create({
        projectId: params.id,
        type: provEngine,
        dbName: provDbName.trim() || 'main_db',
        masterUsername: provMasterUser.trim() || 'db_master',
        cpuLimit: provCpu,
        memoryLimitMb: provRamMb,
        storageLimitGb: provStorageGb,
        maxConnections: provMaxConn,
      });
      toast(`Database Provisioned: Engine "${res.database.dbName}" is now initializing.`);
      setProvDbModalOpen(false);
      loadDatabases();
    } catch (err: any) {
      toast(`Provisioning Failed: ${err.message}`, 'error');
    } finally {
      setIsProvisioningDb(false);
    }
  }

  async function handleExecuteSql(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!sqlQuery.trim()) return;

    // Destructive query safeguard
    const isDestructive = /drop|truncate|delete\s+from\s+[^\s]+\s*$/i.test(sqlQuery);
    if (isDestructive && !confirm('Warning: This SQL statement contains destructive operations (DROP/TRUNCATE/DELETE). Execute anyway?')) {
      return;
    }

    setIsExecutingSql(true);
    const startMs = Date.now();
    try {
      const res = await api.projects.query(params.id, sqlQuery.trim());
      const durationMs = Date.now() - startMs;
      setSqlResult(res);
      setSqlHistory((prev) => [
        { query: sqlQuery.trim(), timestamp: new Date().toLocaleTimeString(), durationMs, ok: Boolean(res.ok) },
        ...prev.slice(0, 19),
      ]);
    } catch (err: any) {
      const durationMs = Date.now() - startMs;
      setSqlResult({ ok: false, exitCode: 1, rawOutput: err.message, executionTimeMs: durationMs });
      setSqlHistory((prev) => [
        { query: sqlQuery.trim(), timestamp: new Date().toLocaleTimeString(), durationMs, ok: false },
        ...prev.slice(0, 19),
      ]);
    } finally {
      setIsExecutingSql(false);
    }
  }

  async function handleSaveSnippet() {
    if (!snippetTitle.trim() || !sqlQuery.trim()) return;
    try {
      const res = await api.projects.createSnippet(params.id, { title: snippetTitle.trim(), query: sqlQuery.trim() });
      setSavedSnippets((prev) => [res.snippet, ...prev]);
      setSaveSnippetModalOpen(false);
      setSnippetTitle('');
      toast(`Snippet Saved: Saved "${res.snippet.title}" to project library.`);
    } catch (err: any) {
      toast(`Error: ${err.message}`, 'error');
    }
  }

  async function handleToggleExtension(extName: string, currentlyEnabled: boolean) {
    if (!selectedDb?.id) return;
    try {
      const res = await api.managedDatabases.toggleExtension(selectedDb.id, extName, !currentlyEnabled);
      if (res.extensions) setExtensions(res.extensions);
      toast(`Extension Updated: Extension "${extName}" ${!currentlyEnabled ? 'enabled' : 'disabled'}.`);
    } catch (err: any) {
      toast(`Extension Toggle Error: ${err.message}`, 'error');
    }
  }

  async function handleCreateBackup() {
    if (!selectedDb?.id) return;
    setCreatingBackup(true);
    try {
      const res = await api.managedDatabases.backup(selectedDb.id);
      toast(`Snapshot Backup Created: Backup dump "${res.backup.backupId}" created.`);
      const bRes = await api.managedDatabases.listBackups(selectedDb.id);
      setBackups(bRes.backups || []);
    } catch (err: any) {
      toast(`Backup Error: ${err.message}`, 'error');
    } finally {
      setCreatingBackup(false);
    }
  }

  async function handleCreateDbUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDb?.id || !newDbUsername.trim()) return;
    try {
      const res = await api.managedDatabases.createUser(selectedDb.id, {
        username: newDbUsername.trim(),
        password: newDbUserPass.trim() || undefined,
        role: newDbUserRole,
      });
      setCreateUserModalOpen(false);
      setCreatedUserPasswordNotice(`User '${res.user.username}' created! Password: ${res.user.password || '(configured)'}`);
      setNewDbUsername('');
      setNewDbUserPass('');
      const uRes = await api.managedDatabases.listUsers(selectedDb.id);
      setDbUsers(uRes.users || []);
    } catch (err: any) {
      toast(`Failed creating user: ${err.message}`, 'error');
    }
  }

  async function handleUpdateIpWhitelist(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDb?.id) return;
    setSavingIpWhitelist(true);
    try {
      const ips = ipWhitelist.split(',').map((s) => s.trim()).filter(Boolean);
      await api.managedDatabases.updateConfig(selectedDb.id, { allowedIps: ips });
      toast('Security Updated: IP allowlist rules saved to network firewall.');
    } catch (err: any) {
      toast(`Update Failed: ${err.message}`, 'error');
    } finally {
      setSavingIpWhitelist(false);
    }
  }

  async function handleUpdateProjectSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setSavingProjectSettings(true);
    try {
      const res = await api.projects.update(project.id, {
        name: editProjectName.trim(),
        description: editProjectDesc.trim(),
      });
      setProject(res.project);
      toast('Project Saved: Project settings updated.');
    } catch (err: any) {
      toast(`Save Failed: ${err.message}`, 'error');
    } finally {
      setSavingProjectSettings(false);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !inviteMemberEmail.trim()) return;
    setInvitingMember(true);
    try {
      await api.projects.addMember(project.id, {
        email: inviteMemberEmail.trim(),
        role: inviteMemberRole,
      });
      loadProject();
      setInviteMemberEmail('');
      toast(`Member Added: User "${inviteMemberEmail}" added as ${inviteMemberRole}.`);
    } catch (err: any) {
      toast(`Invite Failed: ${err.message}`, 'error');
    } finally {
      setInvitingMember(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!project || !confirm('Remove this member from project?')) return;
    try {
      await api.projects.removeMember(project.id, userId);
      loadProject();
      toast('Member Removed: Member access revoked.');
    } catch (err: any) {
      toast(`Error: ${err.message}`, 'error');
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!project) return <Spinner label="Loading project hub..." />;

  const isOwnerOrAdmin = project.callerRole === 'owner' || project.callerRole === 'admin';

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-accent-violet/20 text-accent-violet-light border border-accent-violet/30">
                Project Hub
              </span>
              <span className="text-xs text-text-muted font-mono">• Node: {project.node?.label || 'Local VPS'}</span>
              <span className="text-xs text-emerald-400 font-mono font-bold capitalize">
                Role: {project.callerRole}
              </span>
            </div>

            <h1 className="text-2xl font-black text-white mt-1.5 flex items-center gap-3">
              <span>{project.name}</span>
            </h1>
            <p className="text-xs text-text-muted mt-1">{project.description || 'No description configured.'}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => setProvDbModalOpen(true)}
              className="flex items-center gap-2 shadow-lg shadow-emerald-500/20 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Provision Database Engine</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
              ← Projects List
            </Button>
          </div>
        </div>

        {/* Database Selector Pill Bar */}
        {databases.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-3 border-t border-white/10 font-mono text-xs">
            <span className="text-text-muted font-bold uppercase text-[10px]">Select Database Container:</span>
            {databases.map((db) => {
              const isSelected = selectedDb?.id === db.id;
              return (
                <button
                  key={db.id}
                  onClick={() => setSelectedDb(db)}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md font-bold'
                      : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/40">{db.type}</span>
                  <span>{db.dbName}</span>
                  <span className={`w-2 h-2 rounded-full ${db.status === 'running' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Tab Navigation */}
      <Tabs tabs={TABS} active={activeTab} onChange={(v) => setActiveTab(v as TabId)} />

      {/* TAB 1: DATABASES HUB */}
      {activeTab === 'databases' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <span>Managed Database Containers ({databases.length})</span>
            </h2>

            <Button variant="primary" size="sm" onClick={() => setProvDbModalOpen(true)}>
              + New Database
            </Button>
          </div>

          {databases.length === 0 ? (
            <EmptyState message="No database containers provisioned in this project yet. Click 'Provision Database Engine' to launch PostgreSQL." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {databases.map((db) => {
                const isSelected = selectedDb?.id === db.id;
                return (
                  <div
                    key={db.id}
                    className={`bg-[#0b0c16] border rounded-2xl p-6 space-y-4 shadow-xl transition-all ${
                      isSelected ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {db.type} Engine
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                            db.status === 'running'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {db.status}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mt-1">{db.dbName}</h3>
                      </div>

                      <button
                        onClick={() => setSelectedDb(db)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                          isSelected ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/5 text-text-muted hover:text-white'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/40 p-3 rounded-xl border border-white/5">
                      <div>
                        <span className="text-[10px] text-text-faint uppercase block">Port</span>
                        <span className="text-white font-bold">{db.internalPort || 5432}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-faint uppercase block">Master User</span>
                        <span className="text-white font-bold">{db.masterUsername}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-faint uppercase block">Compute</span>
                        <span className="text-emerald-400 font-bold">{db.cpuLimit || 1} vCPU • {db.memoryLimitMb || 2048}MB</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-faint uppercase block">Storage</span>
                        <span className="text-cyan-400 font-bold">{db.storageLimitGb || 25} GB</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 font-mono text-xs">
                      <span className="text-text-muted text-[11px]">
                        Created {new Date(db.createdAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await api.managedDatabases.action(db.id, 'restart');
                            toast(`Container Restart: Restart signal sent to ${db.dbName}`);
                            loadDatabases();
                          }}
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-[11px]"
                        >
                          Restart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TABLE EDITOR */}
      {activeTab === 'table-editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tables Sidebar */}
          <div className="lg:col-span-3 space-y-3 bg-[#0b0c16] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Tables ({tables.length})</span>
              <Button size="sm" variant="ghost" onClick={() => setCreateTableModalOpen(true)} className="p-1 text-emerald-400">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-1 font-mono text-xs">
              {tables.map((tbl) => (
                <button
                  key={tbl.name}
                  onClick={() => setSelectedTable(tbl.name)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center justify-between ${
                    selectedTable === tbl.name
                      ? 'bg-accent-violet/20 text-accent-violet-light font-bold border border-accent-violet/30'
                      : 'text-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{tbl.name}</span>
                  <span className="text-[10px] text-text-faint">{tbl.rowCount} rows</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table Data Spreadsheet Grid */}
          <div className="lg:col-span-9 space-y-4 bg-[#0b0c16] border border-white/10 rounded-2xl p-6">
            {selectedTable ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">{selectedTable}</h3>
                    <p className="text-xs text-text-muted font-mono">{tableRows.length} rows loaded (limit 100)</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => setInsertRowModalOpen(true)}>
                      + Insert Row
                    </Button>
                  </div>
                </div>

                {loadingRows ? (
                  <Spinner label="Loading table data..." />
                ) : tableRows.length === 0 ? (
                  <EmptyState message="No rows found in this table." />
                ) : (
                  <div className="overflow-x-auto border border-white/10 rounded-xl">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-white/5 border-b border-white/10 text-text-muted uppercase text-[10px]">
                        <tr>
                          {tableColumns.map((col) => (
                            <th key={col} className="px-4 py-3 border-r border-white/5">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-text-primary">
                        {tableRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                            {tableColumns.map((col) => (
                              <td key={col} className="px-4 py-2.5 border-r border-white/5 max-w-xs truncate">
                                {row[col] === null ? (
                                  <span className="text-text-faint italic">null</span>
                                ) : typeof row[col] === 'object' ? (
                                  JSON.stringify(row[col])
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="Select a table from the sidebar to inspect its contents." />
            )}
          </div>

          <CreateTablePanel
            open={createTableModalOpen}
            onClose={() => setCreateTableModalOpen(false)}
            onTableCreated={loadTables}
            onSubmit={async (sql) => {
              await api.projects.query(params.id, sql);
            }}
          />
        </div>
      )}

      {/* TAB 3: SQL EDITOR */}
      {activeTab === 'sql-runner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Saved Snippets Library (3 cols) */}
          <div className="lg:col-span-3 space-y-3 bg-[#0b0c16] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Saved Snippets</span>
              <Button size="sm" variant="ghost" onClick={() => setSaveSnippetModalOpen(true)} className="text-xs p-1">
                <Save className="w-3.5 h-3.5" />
              </Button>
            </div>

            {savedSnippets.length === 0 ? (
              <p className="text-xs text-text-faint italic">No saved snippets yet.</p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {savedSnippets.map((snip) => (
                  <button
                    key={snip.id}
                    onClick={() => setSqlQuery(snip.query)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-primary transition-all truncate block"
                  >
                    {snip.title}
                  </button>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-white/10">
              <span className="text-[10px] text-text-muted uppercase font-bold block mb-2">Execution History</span>
              <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-[11px]">
                {sqlHistory.map((h, i) => (
                  <div key={i} className="p-2 rounded bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={h.ok ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {h.ok ? 'OK' : 'ERR'}
                      </span>
                      <span className="text-text-faint">{h.durationMs}ms</span>
                    </div>
                    <p className="text-text-muted truncate">{h.query}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monaco SQL Editor & Execution Console (9 cols) */}
          <div className="lg:col-span-9 space-y-4 bg-[#0b0c16] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono uppercase">PostgreSQL Query Runner</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSaveSnippetModalOpen(true)}>
                  Save Snippet
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleExecuteSql()} loading={isExecutingSql}>
                  Run Query (Ctrl+Enter)
                </Button>
              </div>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden h-64">
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme="vs-dark"
                value={sqlQuery}
                onChange={(v) => setSqlQuery(v || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'Fira Code, monospace',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>

            {/* Results Grid */}
            {sqlResult && (
              <div className="p-4 bg-black/80 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-2">
                  <span className="text-text-muted">
                    Status:{' '}
                    <strong className={sqlResult.ok ? 'text-emerald-400' : 'text-red-400'}>
                      {sqlResult.ok ? 'SUCCESS' : 'FAILED'}
                    </strong>
                  </span>
                  <span className="text-text-muted">Execution Time: {sqlResult.executionTimeMs || 0} ms</span>
                </div>

                {sqlResult.rows && sqlResult.rows.length > 0 ? (
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left font-mono text-xs text-text-primary">
                      <thead className="bg-white/5 border-b border-white/10 text-[10px] text-text-muted uppercase">
                        <tr>
                          {Object.keys(sqlResult.rows[0]).map((key) => (
                            <th key={key} className="px-3 py-2 border-r border-white/5">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sqlResult.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            {Object.keys(sqlResult.rows[0]).map((key) => (
                              <td key={key} className="px-3 py-1.5 border-r border-white/5 max-w-xs truncate">
                                {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="font-mono text-xs text-emerald-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {sqlResult.rawOutput || '(No rows returned)'}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SCHEMA & ERD */}
      {activeTab === 'schema-erd' && (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-violet-400" />
                <span>Visual Schema Inspector & Entity Relationship Diagram</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Tables, primary keys, column data types, and foreign key relations inside container &quot;{selectedDb?.dbName}&quot;.
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={loadSchema} loading={loadingSchema}>
              Refresh ERD
            </Button>
          </div>

          {loadingSchema ? (
            <Spinner label="Building schema relationship graph..." />
          ) : !schemaData || !schemaData.tables || schemaData.tables.length === 0 ? (
            <EmptyState message="No database tables found in schema 'public'." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {schemaData.tables.map((table: any) => (
                <div
                  key={table.name}
                  className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3 font-mono text-xs shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <TableIcon className="w-3.5 h-3.5" />
                      {table.name}
                    </span>
                    <span className="text-[10px] text-text-faint">{table.columns?.length || 0} columns</span>
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {table.columns?.map((col: any) => (
                      <div
                        key={col.name}
                        className="flex items-center justify-between p-1.5 rounded bg-white/[0.02] hover:bg-white/[0.05]"
                      >
                        <div className="flex items-center gap-2">
                          {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                          <span className="text-text-primary font-semibold truncate">{col.name}</span>
                        </div>
                        <span className="text-[10px] text-text-muted font-mono">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CONNECTION & SECURITY */}
      {activeTab === 'connection' && (
        <div className="space-y-6">
          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white font-mono uppercase">Multi-Language Connection Strings</h3>

            {connDetails && (
              <div className="space-y-4 font-mono text-xs">
                {/* DSN URI */}
                <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-text-muted text-[10px] uppercase font-bold">
                    <span>Direct Connection URI</span>
                    <button
                      onClick={() => handleCopy(connDetails.connectionString, 'dsn')}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      {copiedLabel === 'dsn' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-emerald-300 break-all select-all font-mono">{connDetails.connectionString}</p>
                </div>

                {/* PgBouncer Pooled URI */}
                <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-text-muted text-[10px] uppercase font-bold">
                    <span>PgBouncer Connection Pool URI (Port :6543)</span>
                    <button
                      onClick={() => handleCopy(connDetails.connectionString.replace(':5432', ':6543'), 'pool')}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedLabel === 'pool' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-cyan-300 break-all select-all font-mono">
                    {connDetails.connectionString.replace(':5432', ':6543')}
                  </p>
                </div>

                {/* Node.js / Prisma Snippet */}
                <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-1">
                  <span className="text-text-muted text-[10px] uppercase font-bold block">Prisma schema.prisma</span>
                  <p className="text-violet-300 select-all font-mono">
                    datasource db &#123; provider = &quot;postgresql&quot; url = env(&quot;DATABASE_URL&quot;) &#125;
                  </p>
                </div>
              </div>
            )}

            {/* Network Security Firewall */}
            <form onSubmit={handleUpdateIpWhitelist} className="border-t border-white/10 pt-6 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase font-mono">IP Allowlist Firewall Rules</h4>
              <p className="text-xs text-text-muted">
                Comma-separated IPv4 or CIDR blocks allowed to communicate with this database container.
              </p>

              <Input
                value={ipWhitelist}
                onChange={(e) => setIpWhitelist(e.target.value)}
                placeholder="0.0.0.0/0, 192.168.1.1/32"
                className="font-mono text-xs"
              />

              <Button variant="primary" size="sm" type="submit" loading={savingIpWhitelist}>
                Save Firewall Rules
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: DB USERS */}
      {activeTab === 'users' && (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white font-mono uppercase">Database Users & Privileges</h3>
            <Button variant="primary" size="sm" onClick={() => setCreateUserModalOpen(true)}>
              + Create DB User
            </Button>
          </div>

          {createdUserPasswordNotice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono flex items-center justify-between">
              <span>{createdUserPasswordNotice}</span>
              <button onClick={() => setCreatedUserPasswordNotice(null)} className="text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          )}

          <div className="space-y-3 font-mono text-xs">
            {dbUsers.map((u) => (
              <div key={u.id} className="p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{u.username}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {u.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">Created {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 text-xs"
                    onClick={async () => {
                      if (!selectedDb?.id || !confirm(`Delete user '${u.username}'?`)) return;
                      await api.managedDatabases.deleteUser(selectedDb.id, u.username);
                      const res = await api.managedDatabases.listUsers(selectedDb.id);
                      setDbUsers(res.users || []);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Create User Modal */}
          <Modal open={createUserModalOpen} onClose={() => setCreateUserModalOpen(false)} title="Create Database User">
            <form onSubmit={handleCreateDbUser} className="space-y-4">
              <Input
                label="Username *"
                value={newDbUsername}
                onChange={(e) => setNewDbUsername(e.target.value)}
                placeholder="e.g. readonly_app"
                required
              />

              <Input
                label="Password (optional, generated if blank)"
                type="password"
                value={newDbUserPass}
                onChange={(e) => setNewDbUserPass(e.target.value)}
                placeholder="••••••••••••"
              />

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Role / Privilege</label>
                <select
                  value={newDbUserRole}
                  onChange={(e) => setNewDbUserRole(e.target.value as any)}
                  className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-xs text-text-primary"
                >
                  <option value="admin">Admin (Full DDL & DML permissions)</option>
                  <option value="read_write">Read-Write (SELECT, INSERT, UPDATE, DELETE)</option>
                  <option value="read_only">Read-Only (SELECT queries only)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <Button variant="ghost" type="button" onClick={() => setCreateUserModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Create User
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* TAB 7: EXTENSIONS */}
      {activeTab === 'extensions' && (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
          <h3 className="text-base font-bold text-white font-mono uppercase">PostgreSQL Extensions</h3>

          {loadingExtensions ? (
            <Spinner label="Fetching extension registry..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
              {extensions.map((ext) => (
                <div
                  key={ext.name}
                  className="p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-white block">{ext.name}</span>
                    <span className="text-[10px] text-text-muted block">{ext.comment || 'Extension plugin'}</span>
                  </div>

                  <button
                    onClick={() => handleToggleExtension(ext.name, Boolean(ext.enabled ?? ext.isEnabled))}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      (ext.enabled ?? ext.isEnabled)
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/5 text-text-muted hover:text-white border border-white/10'
                    }`}
                  >
                    {(ext.enabled ?? ext.isEnabled) ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: BACKUPS */}
      {activeTab === 'backups' && (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white font-mono uppercase">Snapshot Backup Ledger</h3>
            <Button variant="primary" size="sm" onClick={handleCreateBackup} loading={creatingBackup}>
              + Create Snapshot Dump ($2/mo)
            </Button>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {backups.map((b) => (
              <div key={b.backupId} className="p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-400 block">{b.filename}</span>
                  <span className="text-[10px] text-text-muted block">
                    Created {new Date(b.createdAt).toLocaleString()} • Size: {(b.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!selectedDb?.id || !confirm(`Restore database to backup '${b.backupId}'?`)) return;
                    await api.managedDatabases.restore(selectedDb.id, b.backupId);
                    toast('Database Restored: Container restored from dump.');
                  }}
                >
                  Restore Snapshot
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: MONITORING & LOGS */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-text-muted text-[10px] uppercase block">CPU Utilization</span>
              <span className="text-2xl font-bold text-emerald-400">{metrics?.cpuPct ?? 12}%</span>
            </div>
            <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-text-muted text-[10px] uppercase block">Memory RAM</span>
              <span className="text-2xl font-bold text-cyan-400">{metrics?.ramMb ?? 256} MB</span>
            </div>
            <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-text-muted text-[10px] uppercase block">Disk Storage</span>
              <span className="text-2xl font-bold text-violet-400">{metrics?.diskMb ?? 420} MB</span>
            </div>
            <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-text-muted text-[10px] uppercase block">Active Connections</span>
              <span className="text-2xl font-bold text-amber-400">{metrics?.activeConnections ?? 3}</span>
            </div>
          </div>

          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4 font-mono text-xs">
            <span className="text-xs font-bold text-white uppercase block">Container Output & Connection Logs</span>
            <div className="p-4 bg-black/90 border border-white/10 rounded-xl max-h-80 overflow-y-auto space-y-1 text-emerald-400">
              {systemLogs.map((log, i) => (
                <div key={i} className="text-[11px] whitespace-pre-wrap">
                  <span className="text-text-faint">[{log.timestamp || new Date().toISOString()}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: SETTINGS & MEMBERS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Project Rename Form */}
          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white font-mono uppercase">Project Settings</h3>

            <form onSubmit={handleUpdateProjectSettings} className="space-y-4">
              <Input label="Project Name" value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} />

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Description</label>
                <textarea
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-violet"
                />
              </div>

              <Button variant="primary" size="sm" type="submit" loading={savingProjectSettings}>
                Save Project Changes
              </Button>
            </form>
          </div>

          {/* Members Management */}
          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white font-mono uppercase">Project Team Members & Access Roles</h3>

            <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row items-center gap-3">
              <Input
                placeholder="User email address..."
                value={inviteMemberEmail}
                onChange={(e) => setInviteMemberEmail(e.target.value)}
                className="w-full sm:w-80 text-xs"
                required
              />

              <select
                value={inviteMemberRole}
                onChange={(e) => setInviteMemberRole(e.target.value as any)}
                className="bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-xs text-text-primary"
              >
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="read_only">Read-Only</option>
              </select>

              <Button variant="primary" size="sm" type="submit" loading={invitingMember}>
                Add Member
              </Button>
            </form>

            <div className="space-y-2 font-mono text-xs">
              {project.members?.map((m) => (
                <div key={m.id} className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{m.user?.email || m.userId}</span>
                    <span className="text-[10px] text-text-muted block font-mono">Role: {m.role}</span>
                  </div>

                  {m.role !== 'owner' && isOwnerOrAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.userId)} className="text-red-400 text-xs">
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PROVISION DATABASE MODAL */}
      <Modal open={provDbModalOpen} onClose={() => setProvDbModalOpen(false)} title="Provision Managed Database Engine" width="max-w-xl">
        <form onSubmit={handleProvisionDatabase} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Database Engine</label>
            <select
              value={provEngine}
              onChange={(e) => setProvEngine(e.target.value as any)}
              className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-xs text-text-primary"
            >
              <option value="postgres">PostgreSQL (Default - Supported Full Hub Features)</option>
              <option value="mysql">MySQL / MariaDB</option>
              <option value="redis">Redis Key-Value</option>
              <option value="mongodb">MongoDB Document Store</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Database Name *" value={provDbName} onChange={(e) => setProvDbName(e.target.value)} required />
            <Input label="Master Username *" value={provMasterUser} onChange={(e) => setProvMasterUser(e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">Preset Compute Tiers</label>
            <div className="grid grid-cols-5 gap-2 font-mono text-xs">
              {PRESET_TIERS.map((tier) => (
                <button
                  key={tier.name}
                  type="button"
                  onClick={() => {
                    setProvCpu(tier.cpu);
                    setProvRamMb(tier.memoryMb);
                    setProvStorageGb(tier.storageGb);
                    setProvMaxConn(tier.maxConn);
                  }}
                  className="p-2 bg-white/5 border border-white/10 hover:border-emerald-500/40 rounded-xl text-left transition-all"
                >
                  <span className="font-bold text-white block text-[11px]">{tier.name}</span>
                  <span className="text-[10px] text-text-muted block">{tier.cpu}vCPU</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setProvDbModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isProvisioningDb}>
              Provision Container Engine
            </Button>
          </div>
        </form>
      </Modal>

      {/* SAVE SNIPPET MODAL */}
      <Modal open={saveSnippetModalOpen} onClose={() => setSaveSnippetModalOpen(false)} title="Save SQL Snippet">
        <div className="space-y-4">
          <Input label="Snippet Title *" value={snippetTitle} onChange={(e) => setSnippetTitle(e.target.value)} placeholder="e.g. List Active Users" />
          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button variant="ghost" onClick={() => setSaveSnippetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveSnippet}>
              Save to Library
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
