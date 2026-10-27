'use client';

import { useState, useEffect } from 'react';
import {
  Zap,
  Database,
  Globe,
  Settings,
  Key,
  Code,
  Users,
  Folder,
  ShieldAlert,
  Activity,
  Terminal,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Play,
  Square,
  RotateCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Server,
  AlertTriangle,
  Send,
  Cpu,
  HardDrive,
  Layers,
  Maximize2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { SupabaseClientProject, Node } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import DatabaseMigrationScaleModal from '@/components/DatabaseMigrationScaleModal';

export default function UnifiedDevProjectsPage() {
  const { apiUser } = useAppUser();
  const isDev = apiUser?.role === 'dev';

  // Data state
  const [supabaseProjects, setSupabaseProjects] = useState<SupabaseClientProject[]>([]);
  const [managedDbs, setManagedDbs] = useState<any[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'supabase' | 'databases'>('supabase');

  // Selected Supabase Project for detailed configuration
  const [selectedSupabaseProject, setSelectedSupabaseProject] = useState<SupabaseClientProject | null>(null);

  // Supabase Studio Sub-Tab navigation state
  const [studioSubTab, setStudioSubTab] = useState<
    'overview' | 'studio' | 'keys' | 'tables' | 'sql' | 'auth' | 'storage' | 'advisors' | 'observability' | 'settings'
  >('overview');

  function getStudioUrl(proj: SupabaseClientProject | null | undefined): string {
    if (!proj) return '#';
    if (proj.studioUrl) return proj.studioUrl;
    const host = proj.nodeIp || 'localhost';
    const port = proj.studioPort || 8000;
    return `http://${host}:${port}`;
  }

  // Table browser state
  const [selectedSchema, setSelectedSchema] = useState<string>('public');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[] | null>(null);
  const [isLoadingTableData, setIsLoadingTableData] = useState(false);

  // Interactive Project Studio Data State
  const [projectSchemas, setProjectSchemas] = useState<any[]>([]);
  const [projectTables, setProjectTables] = useState<any[]>([]);
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM public.profiles LIMIT 50;');
  const [sqlResult, setSqlResult] = useState<any | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  const [authUsers, setAuthUsers] = useState<any[]>([]);
  const [newAuthEmail, setNewAuthEmail] = useState('');
  const [newAuthPass, setNewAuthPass] = useState('');
  const [isCreatingAuthUser, setIsCreatingAuthUser] = useState(false);

  const [storageBuckets, setStorageBuckets] = useState<any[]>([]);
  const [newBucketId, setNewBucketId] = useState('');
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketPublic, setNewBucketPublic] = useState(true);
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);

  const [advisorsData, setAdvisorsData] = useState<{ security: any[]; performance: any[] }>({
    security: [],
    performance: [],
  });
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const [logsData, setLogsData] = useState<any[]>([]);
  const [logsServiceFilter, setLogsServiceFilter] = useState('all');
  const [isLoadingStudioData, setIsLoadingStudioData] = useState(false);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Key reveal toggle state (key: string -> boolean)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  // Action status loading state
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Modals state
  const [projectDeleteModal, setProjectDeleteModal] = useState<SupabaseClientProject | null>(null);
  const [projectMigrateModal, setProjectMigrateModal] = useState<SupabaseClientProject | null>(null);
  const [targetMigrateNodeId, setTargetMigrateNodeId] = useState<string>('');
  const [projectLogsModal, setProjectLogsModal] = useState<{ project: SupabaseClientProject; logs: any[] } | null>(null);

  // Selected Database for Migration & Scaling modal
  const [selectedDbForScale, setSelectedDbForScale] = useState<any | null>(null);

  // New Provisioning Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCategory, setCreateCategory] = useState<'supabase' | 'database'>('supabase');

  // Supabase creation form
  const [supaName, setSupaName] = useState('');
  const [supaEmail, setSupaEmail] = useState('');
  const [supaNodeId, setSupaNodeId] = useState('');

  // Database creation form
  const [dbName, setDbName] = useState('');
  const [dbType, setDbType] = useState<'postgres' | 'mysql' | 'redis' | 'mongodb'>('postgres');

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Selected DB Password reveal state
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  // Supabase project inline settings form
  const [editDbPass, setEditDbPass] = useState('');
  const [editJwtSecret, setEditJwtSecret] = useState('');
  const [editStorageMb, setEditStorageMb] = useState(5120);
  const [isSavingSupabaseSettings, setIsSavingSupabaseSettings] = useState(false);

  // Search filter for projects
  const [projectSearch, setProjectSearch] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedSupabaseProject?.id) {
      loadProjectStudioData(selectedSupabaseProject.id);
    }
  }, [selectedSupabaseProject?.id]);

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function toggleKeyReveal(keyId: string) {
    setRevealedKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  }

  async function loadTableData(tableName: string, schema: string = 'public') {
    if (!selectedSupabaseProject) return;
    setSelectedTable(tableName);
    setIsLoadingTableData(true);
    setTableData(null);
    try {
      const res = await api.devSupabase.executeQuery(
        `SELECT * FROM "${schema}"."${tableName}" LIMIT 100;`,
        selectedSupabaseProject.id,
      );
      setTableData(Array.isArray(res) ? res : res.rows || []);
    } catch (err: any) {
      setTableData([]);
    } finally {
      setIsLoadingTableData(false);
    }
  }

  async function loadProjectStudioData(projectId: string) {
    if (!projectId) return;
    setIsLoadingStudioData(true);
    try {
      const [schemasRes, tablesRes, bucketsRes, usersRes, advisorsRes, metricsRes, logsRes] = await Promise.all([
        api.devSupabase.getSchemas(projectId).catch(() => ({ schemas: [] })),
        api.devSupabase.getTables(projectId).catch(() => ({ tables: [] })),
        api.devSupabase.getBuckets(projectId).catch(() => ({ buckets: [] })),
        api.devSupabase.getAuthUsers(projectId).catch(() => ({ users: [], total: 0 })),
        api.devSupabase.getAdvisors(projectId).catch(() => ({ security: [], performance: [] })),
        api.devSupabase.getObservability(projectId).catch(() => ({ metrics: null })),
        api.devSupabase.getLogs(logsServiceFilter, projectId).catch(() => ({ logs: [] })),
      ]);

      setProjectSchemas(schemasRes.schemas || []);
      setProjectTables(tablesRes.tables || []);
      setStorageBuckets(bucketsRes.buckets || []);
      setAuthUsers(usersRes.users || []);
      setAdvisorsData(advisorsRes || { security: [], performance: [] });
      setMetricsData(metricsRes.metrics || null);
      setLogsData(logsRes.logs || []);
    } catch (err) {
      console.error('Failed loading studio data for project', err);
    } finally {
      setIsLoadingStudioData(false);
    }
  }

  async function handleStartProject(proj: SupabaseClientProject) {
    setActionLoading((prev) => ({ ...prev, [`start-${proj.id}`]: true }));
    try {
      const res = await api.devSupabase.startProject(proj.id);
      setSupabaseProjects((prev) => prev.map((p) => (p.id === proj.id ? res.project : p)));
      if (selectedSupabaseProject?.id === proj.id) setSelectedSupabaseProject(res.project);
      setActionNotice(`Supabase project "${proj.name}" started successfully.`);
    } catch (err: any) {
      setActionNotice(`Failed starting project: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`start-${proj.id}`]: false }));
    }
  }

  async function handleStopProject(proj: SupabaseClientProject) {
    setActionLoading((prev) => ({ ...prev, [`stop-${proj.id}`]: true }));
    try {
      const res = await api.devSupabase.stopProject(proj.id);
      setSupabaseProjects((prev) => prev.map((p) => (p.id === proj.id ? res.project : p)));
      if (selectedSupabaseProject?.id === proj.id) setSelectedSupabaseProject(res.project);
      setActionNotice(`Supabase project "${proj.name}" stopped.`);
    } catch (err: any) {
      setActionNotice(`Failed stopping project: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`stop-${proj.id}`]: false }));
    }
  }

  async function handleRestartProject(proj: SupabaseClientProject) {
    setActionLoading((prev) => ({ ...prev, [`restart-${proj.id}`]: true }));
    try {
      const res = await api.devSupabase.restartProject(proj.id);
      setSupabaseProjects((prev) => prev.map((p) => (p.id === proj.id ? res.project : p)));
      if (selectedSupabaseProject?.id === proj.id) setSelectedSupabaseProject(res.project);
      setActionNotice(`Supabase project "${proj.name}" restarted successfully.`);
    } catch (err: any) {
      setActionNotice(`Failed restarting project: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`restart-${proj.id}`]: false }));
    }
  }

  async function handleRetryProject(proj: SupabaseClientProject) {
    setActionLoading((prev) => ({ ...prev, [`retry-${proj.id}`]: true }));
    try {
      const res = await api.devSupabase.retryProject(proj.id);
      setSupabaseProjects((prev) => prev.map((p) => (p.id === proj.id ? res.project : p)));
      if (selectedSupabaseProject?.id === proj.id) setSelectedSupabaseProject(res.project);
      setActionNotice(`Provisioning retry initiated for "${proj.name}".`);
    } catch (err: any) {
      setActionNotice(`Retry failed: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`retry-${proj.id}`]: false }));
    }
  }

  async function handleMigrateProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectMigrateModal || !targetMigrateNodeId) return;
    const projId = projectMigrateModal.id;
    setActionLoading((prev) => ({ ...prev, [`migrate-${projId}`]: true }));
    try {
      const res = await api.devSupabase.migrateProject(projId, targetMigrateNodeId);
      setSupabaseProjects((prev) => prev.map((p) => (p.id === projId ? res.project : p)));
      if (selectedSupabaseProject?.id === projId) setSelectedSupabaseProject(res.project);
      setActionNotice(`Project "${projectMigrateModal.name}" migrated successfully to node ${res.project.nodeLabel || res.project.nodeIp}.`);
      setProjectMigrateModal(null);
    } catch (err: any) {
      setActionNotice(`Migration failed: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`migrate-${projId}`]: false }));
    }
  }

  async function handleOpenProjectLogs(proj: SupabaseClientProject) {
    try {
      const res = await api.devSupabase.getProjectLogs(proj.id);
      setProjectLogsModal({ project: proj, logs: res.logs || [] });
    } catch {
      setProjectLogsModal({ project: proj, logs: [] });
    }
  }

  async function handleDeleteProjectConfirm() {
    if (!projectDeleteModal) return;
    const projId = projectDeleteModal.id;
    setActionLoading((prev) => ({ ...prev, [`delete-${projId}`]: true }));
    try {
      await api.devSupabase.deleteProject(projId);
      setSupabaseProjects((prev) => prev.filter((p) => p.id !== projId));
      if (selectedSupabaseProject?.id === projId) {
        const remaining = supabaseProjects.filter((p) => p.id !== projId);
        setSelectedSupabaseProject(remaining.length > 0 ? remaining[0] : null);
      }
      setActionNotice(`Supabase project "${projectDeleteModal.name}" deleted.`);
      setProjectDeleteModal(null);
    } catch (err: any) {
      setActionNotice(`Delete failed: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`delete-${projId}`]: false }));
    }
  }

  async function handleExecuteSql(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedSupabaseProject || !sqlQuery.trim()) return;
    setIsExecutingSql(true);
    try {
      const res = await api.devSupabase.executeQuery(sqlQuery, selectedSupabaseProject.id);
      setSqlResult(res);
      setActionNotice(`Query executed successfully on project "${selectedSupabaseProject.name}"`);
    } catch (err: any) {
      setSqlResult({ error: err?.error || err?.message || 'SQL execution failed' });
    } finally {
      setIsExecutingSql(false);
    }
  }

  async function handleCreateAuthUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupabaseProject || !newAuthEmail || !newAuthPass) return;
    setIsCreatingAuthUser(true);
    try {
      await api.devSupabase.createAuthUser({
        email: newAuthEmail,
        password: newAuthPass,
        projectId: selectedSupabaseProject.id,
      });
      const res = await api.devSupabase.getAuthUsers(selectedSupabaseProject.id);
      setAuthUsers(res.users || []);
      setNewAuthEmail('');
      setNewAuthPass('');
      setActionNotice(`Auth User "${newAuthEmail}" created for project "${selectedSupabaseProject.name}"`);
    } catch (err: any) {
      setActionNotice(`Failed to create Auth User: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setIsCreatingAuthUser(false);
    }
  }

  async function handleDeleteAuthUser(userId: string) {
    if (!selectedSupabaseProject || !confirm('Are you sure you want to delete this auth user?')) return;
    try {
      await api.devSupabase.deleteAuthUser(userId, selectedSupabaseProject.id);
      const res = await api.devSupabase.getAuthUsers(selectedSupabaseProject.id);
      setAuthUsers(res.users || []);
      setActionNotice('Auth User deleted successfully');
    } catch (err: any) {
      setActionNotice(`Failed deleting user: ${err?.error || err?.message || 'Error'}`);
    }
  }

  async function handleCreateBucket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupabaseProject || !newBucketId || !newBucketName) return;
    setIsCreatingBucket(true);
    try {
      await api.devSupabase.createBucket({
        id: newBucketId,
        name: newBucketName,
        isPublic: newBucketPublic,
        projectId: selectedSupabaseProject.id,
      });
      const res = await api.devSupabase.getBuckets(selectedSupabaseProject.id);
      setStorageBuckets(res.buckets || []);
      setNewBucketId('');
      setNewBucketName('');
      setActionNotice(`Storage Bucket "${newBucketName}" created successfully!`);
    } catch (err: any) {
      setActionNotice(`Failed to create bucket: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setIsCreatingBucket(false);
    }
  }

  async function loadAllData() {
    setLoading(true);
    try {
      const [supaRes, dbRes, nodeRes] = await Promise.all([
        api.devSupabase.listProjects().catch(() => ({ projects: [], total: 0 })),
        api.managedDatabases.list().catch(() => ({ databases: [] })),
        api.nodes.list().catch(() => ({ nodes: [] })),
      ]);

      const fetchedProjects = supaRes.projects || [];
      setSupabaseProjects(fetchedProjects);
      if (fetchedProjects.length > 0) {
        setSelectedSupabaseProject(fetchedProjects[0]);
      }
      setManagedDbs(dbRes.databases || []);
      const fetchedNodes = nodeRes.nodes || [];
      setNodes(fetchedNodes);
      if (fetchedNodes.length > 0) {
        // Automatically default to the primary Main VPS Node
        const mainNode = fetchedNodes.find(
          (n) => n.roleTags?.includes('main-node') || n.label.toLowerCase().includes('main')
        ) || fetchedNodes[0];
        setSupaNodeId(mainNode ? mainNode.id : '');
      }
    } catch (err: any) {
      console.error('Failed loading projects hub data', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsProvisioning(true);
    setActionNotice(null);

    try {
      if (createCategory === 'supabase') {
        if (!supaName || !supaEmail) {
          setActionNotice('Project Name and Client Email are required.');
          setIsProvisioning(false);
          return;
        }
        const res = await api.devSupabase.createProject({
          name: supaName,
          clientEmail: supaEmail,
          nodeId: supaNodeId || undefined,
        });
        setSupabaseProjects((prev) => [res.project, ...prev]);
        setSelectedSupabaseProject(res.project);
        setActionNotice(`Supabase Stack "${res.project.name}" provisioned successfully on node ${res.project.nodeLabel || res.project.nodeIp || 'Optimal VPS'}!`);
      } else {
        if (!dbName) {
          setActionNotice('Database Cluster Name is required.');
          setIsProvisioning(false);
          return;
        }
        const res = await api.managedDatabases.create({
          type: dbType,
          dbName,
        });
        setManagedDbs((prev) => [res.database, ...prev]);
        setActionNotice(`Managed Database "${dbName}" provisioned successfully!`);
      }

      setShowCreateModal(false);
      setSupaName('');
      setSupaEmail('');
      setDbName('');
    } catch (err: any) {
      setActionNotice(`Provisioning failed: ${err?.error || err?.message || 'Unknown error'}`);
    } finally {
      setIsProvisioning(false);
    }
  }

  async function handleSaveSupabaseConfig() {
    if (!selectedSupabaseProject) return;
    setIsSavingSupabaseSettings(true);
    setActionNotice(null);

    try {
      const updatePayload: Record<string, any> = {
        storageLimitMb: editStorageMb,
      };
      if (editDbPass.trim()) updatePayload.dbPassword = editDbPass.trim();
      if (editJwtSecret.trim()) updatePayload.jwtSecret = editJwtSecret.trim();

      const res = await api.devSupabase.updateProjectConfig(selectedSupabaseProject.id, updatePayload);
      setSelectedSupabaseProject(res.project);
      setSupabaseProjects((prev) => prev.map((p) => (p.id === res.project.id ? res.project : p)));
      setActionNotice('Supabase project configuration updated successfully!');
      setEditDbPass('');
      setEditJwtSecret('');
    } catch (err: any) {
      setActionNotice(`Update failed: ${err?.error || err?.message || 'Failed updating configuration'}`);
    } finally {
      setIsSavingSupabaseSettings(false);
    }
  }

  async function handleRevealDbPassword(dbId: string) {
    try {
      const res = await api.managedDatabases.revealPassword(dbId);
      setRevealedPasswords((prev) => ({ ...prev, [dbId]: res.password }));
    } catch {
      alert('Failed to decrypt database password');
    }
  }

  if (!isDev) {
    return (
      <div className="p-8 text-center text-text-muted">
        Access restricted. Developer permissions required.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* HEADER & ACTION BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-mono font-semibold tracking-wide uppercase">
              Dev Studio Hub
            </span>
            <span className="text-xs text-text-muted font-mono">Multi-Node Autonomous Orchestration</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Unified Projects & Databases Hub</h1>
          <p className="text-xs text-text-muted mt-1">
            Provision and manage isolated Supabase Backends distributed across VPS compute nodes with one-click Studio UI access.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-md transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Project / DB</span>
        </button>
      </div>

      {/* ACTION NOTICE BANNER */}
      {actionNotice && (
        <div className="p-4 bg-white/5 border border-white/15 rounded-2xl flex items-center justify-between text-xs text-neutral-300 font-mono">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-text-muted hover:text-white font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('supabase')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'supabase'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Self-Hosted Supabase Stacks</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px]">{supabaseProjects.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('databases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'databases'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Managed Databases</span>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-[10px]">{managedDbs.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* TAB 1: SUPABASE STACKS & MULTI-PROJECT STUDIO */}
          {activeTab === 'supabase' && (
            <div className="space-y-8">

              {/* MULTI-NODE WORKLOAD DISTRIBUTION BANNER */}
              <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-3 font-mono">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Multi-Node VPS Compute Distribution</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    Auto Load Balancing: Active (Lowest CPU / RAM Load First)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                  {nodes.length === 0 ? (
                    <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-text-muted">
                      Main Platform Host Node (Localhost)
                    </div>
                  ) : (
                    nodes.map((node) => {
                      const projCount = supabaseProjects.filter((p) => p.nodeId === node.id || (!p.nodeId && node.ip === '127.0.0.1')).length;
                      return (
                        <div key={node.id} className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white truncate">{node.label}</span>
                            <span className={`w-2 h-2 rounded-full ${node.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                          </div>
                          <p className="text-[10px] text-text-muted">IP: {node.ip}</p>
                          <div className="flex items-center justify-between text-[10px] text-emerald-300 pt-1 border-t border-white/5">
                            <span>Projects: <strong>{projCount}</strong></span>
                            <span>CPU: <strong>{node.cpuUsedPct ?? 14}%</strong></span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* CLOUD MULTI-PROJECT CONTROLLER & QUICK SWITCHER */}
              {supabaseProjects.length > 0 && (
                <div className="bg-[#0b0c16] border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-mono shadow-lg">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-text-muted uppercase font-bold">Cloud Project Selector:</span>
                    </div>
                    <select
                      value={selectedSupabaseProject?.id || ''}
                      onChange={(e) => {
                        const found = supabaseProjects.find((p) => p.id === e.target.value);
                        if (found) setSelectedSupabaseProject(found);
                      }}
                      className="bg-[#0a0a0c] border border-emerald-500/40 text-emerald-300 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-400"
                    >
                      {supabaseProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} [{p.status}] — Node: {p.nodeLabel || p.nodeIp || 'localhost'} (Studio: {p.studioPort || 8000})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedSupabaseProject && (
                      <a
                        href={getStudioUrl(selectedSupabaseProject)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                      >
                        <span>Launch Studio UI</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setCreateCategory('supabase');
                        setShowCreateModal(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>New Stack</span>
                    </button>
                  </div>
                </div>
              )}

              {/* PROJECT CARDS GRID / LIST VIEW */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Provisioned Supabase Backends</span>
                  </h2>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-text-muted focus:outline-none focus:border-emerald-500 font-mono w-44"
                    />
                    <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                      Showing {supabaseProjects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()) || (p.nodeLabel || '').toLowerCase().includes(projectSearch.toLowerCase())).length} of {supabaseProjects.length}
                    </span>
                  </div>
                </div>

                {supabaseProjects.length === 0 ? (
                  <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-10 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-black mx-auto">
                      <Zap className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-white">No Supabase Stacks Provisioned</h3>
                    <p className="text-xs text-text-muted max-w-md mx-auto">
                      Deploy a dedicated self-hosted Supabase environment with isolated Postgres DB, GoTrue Auth, Storage, and Studio across your VPS compute nodes.
                    </p>
                    <button
                      onClick={() => {
                        setCreateCategory('supabase');
                        setShowCreateModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 transition-all"
                    >
                      + Provision Supabase Stack
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {supabaseProjects
                      .filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()) || (p.nodeLabel || '').toLowerCase().includes(projectSearch.toLowerCase()))
                      .map((proj) => {
                      const isSelected = selectedSupabaseProject?.id === proj.id;
                      const isAnonRevealed = revealedKeys[`anon-${proj.id}`];
                      const isServiceRevealed = revealedKeys[`service-${proj.id}`];
                      const isDbUriRevealed = revealedKeys[`dburi-${proj.id}`];

                      const statusColor =
                        proj.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : proj.status === 'PROVISIONING'
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse'
                          : proj.status === 'STOPPED'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : proj.status === 'FAILED'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/30';

                      return (
                        <div
                          key={proj.id}
                          className={`bg-[#0b0c16] border rounded-2xl p-6 space-y-5 transition-all shadow-xl relative overflow-hidden ${
                            isSelected ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          {/* Top Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${statusColor}`}>
                                  {proj.status}
                                </span>
                                <span className="text-[11px] text-text-muted font-mono">
                                  Created {new Date(proj.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <h3 className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
                                <span>{proj.name}</span>
                              </h3>
                              <p className="text-xs text-text-muted font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Host Node:</span>
                                <span className="text-emerald-300 font-bold">
                                  {proj.nodeLabel || proj.nodeIp || 'Main VPS'}
                                </span>
                                <span>({proj.nodeIp || '127.0.0.1'}:{proj.studioPort || 8000})</span>
                              </p>
                            </div>

                            {/* Launch Studio Button */}
                            <a
                              href={getStudioUrl(proj)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all shrink-0"
                            >
                              <span>Launch Studio</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          {/* Error Banner if Provisioning Failed */}
                          {proj.status === 'FAILED' && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs font-mono">
                              <div className="flex items-center justify-between text-red-400 font-bold">
                                <span className="flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4" /> Provisioning Failed
                                </span>
                                <button
                                  onClick={() => handleRetryProject(proj)}
                                  disabled={actionLoading[`retry-${proj.id}`]}
                                  className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px] transition-all flex items-center gap-1"
                                >
                                  <RotateCw className={`w-3 h-3 ${actionLoading[`retry-${proj.id}`] ? 'animate-spin' : ''}`} />
                                  <span>Retry</span>
                                </button>
                              </div>
                              <p className="text-text-muted text-[11px]">{proj.errorMessage || 'Unknown provisioning error occurred.'}</p>
                            </div>
                          )}

                          {/* Resource Metrics Bar */}
                          {proj.resourceUsage && (
                            <div className="grid grid-cols-4 gap-2 font-mono text-[11px] bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                              <div>
                                <span className="text-text-muted text-[9px] uppercase block">CPU Load</span>
                                <span className="font-bold text-emerald-400 flex items-center gap-1">
                                  <Cpu className="w-3 h-3 inline text-text-muted" /> {proj.resourceUsage.cpuPct}%
                                </span>
                              </div>
                              <div>
                                <span className="text-text-muted text-[9px] uppercase block">RAM</span>
                                <span className="font-bold text-cyan-400 flex items-center gap-1">
                                  <Activity className="w-3 h-3 inline text-text-muted" /> {proj.resourceUsage.ramMb} MB
                                </span>
                              </div>
                              <div>
                                <span className="text-text-muted text-[9px] uppercase block">Storage</span>
                                <span className="font-bold text-white flex items-center gap-1">
                                  <HardDrive className="w-3 h-3 inline text-text-muted" /> {proj.resourceUsage.diskMb} MB
                                </span>
                              </div>
                              <div>
                                <span className="text-text-muted text-[9px] uppercase block">DB Size</span>
                                <span className="font-bold text-amber-400 flex items-center gap-1">
                                  <Database className="w-3 h-3 inline text-text-muted" /> {proj.resourceUsage.dbSizeMb} MB
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Connection Keys & Secrets Section */}
                          <div className="space-y-2.5 font-mono text-xs">
                            {/* Anon Key */}
                            <div className="p-2.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-text-muted uppercase font-bold">
                                <span>Anon Public API Key</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleKeyReveal(`anon-${proj.id}`)}
                                    className="hover:text-white transition-colors"
                                  >
                                    {isAnonRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => handleCopy(proj.anonKey, `anon-${proj.id}`)}
                                    className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                                  >
                                    {copiedKey === `anon-${proj.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                              <div className="text-[11px] text-emerald-300 truncate select-all">
                                {isAnonRevealed ? proj.anonKey : '••••••••••••••••••••••••••••••••••••••••'}
                              </div>
                            </div>

                            {/* Service Key */}
                            <div className="p-2.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-text-muted uppercase font-bold">
                                <span>Service Role Secret Key</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleKeyReveal(`service-${proj.id}`)}
                                    className="hover:text-white transition-colors"
                                  >
                                    {isServiceRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => handleCopy(proj.serviceKey, `service-${proj.id}`)}
                                    className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                                  >
                                    {copiedKey === `service-${proj.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                              <div className="text-[11px] text-amber-300 truncate select-all">
                                {isServiceRevealed ? proj.serviceKey : '••••••••••••••••••••••••••••••••••••••••'}
                              </div>
                            </div>

                            {/* DB Direct Connection String */}
                            <div className="p-2.5 bg-black/40 border border-white/10 rounded-xl space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-text-muted uppercase font-bold">
                                <span>PostgreSQL Connection String</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleKeyReveal(`dburi-${proj.id}`)}
                                    className="hover:text-white transition-colors"
                                  >
                                    {isDbUriRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => handleCopy(proj.dbUrl || '', `dburi-${proj.id}`)}
                                    className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                                  >
                                    {copiedKey === `dburi-${proj.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                              <div className="text-[11px] text-cyan-300 truncate select-all">
                                {isDbUriRevealed ? (proj.dbUrl || '') : `postgresql://postgres:••••••••@${proj.nodeIp || 'localhost'}:${proj.dbPort || 5432}/${proj.dbName}`}
                              </div>
                            </div>
                          </div>

                          {/* Control Actions Toolbar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10 font-mono text-xs">
                            <div className="flex items-center gap-1.5">
                              {proj.status === 'ACTIVE' ? (
                                <button
                                  onClick={() => handleStopProject(proj)}
                                  disabled={actionLoading[`stop-${proj.id}`]}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-bold transition-all flex items-center gap-1"
                                  title="Stop Service"
                                >
                                  <Square className="w-3 h-3" />
                                  <span>Stop</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartProject(proj)}
                                  disabled={actionLoading[`start-${proj.id}`]}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold transition-all flex items-center gap-1"
                                  title="Start Service"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Start</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleRestartProject(proj)}
                                disabled={actionLoading[`restart-${proj.id}`]}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white border border-white/10 font-bold transition-all flex items-center gap-1"
                                title="Restart Stack"
                              >
                                <RotateCw className={`w-3 h-3 ${actionLoading[`restart-${proj.id}`] ? 'animate-spin' : ''}`} />
                                <span>Restart</span>
                              </button>

                              <button
                                onClick={() => {
                                  setProjectMigrateModal(proj);
                                  setTargetMigrateNodeId(proj.nodeId || (nodes[0]?.id || ''));
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-violet-500/20 text-neutral-300 border border-white/15 font-bold transition-all flex items-center gap-1"
                                title="Migrate / Rebalance to another node"
                              >
                                <Send className="w-3 h-3" />
                                <span>Migrate</span>
                              </button>

                              <button
                                onClick={() => handleOpenProjectLogs(proj)}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white border border-white/10 font-bold transition-all flex items-center gap-1"
                                title="View Container Logs"
                              >
                                <Terminal className="w-3 h-3" />
                                <span>Logs</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedSupabaseProject(proj)}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-white/5 hover:bg-white/10 text-text-muted hover:text-white border border-white/10'
                                }`}
                              >
                                {isSelected ? 'Active Studio' : 'Select Studio'}
                              </button>

                              <button
                                onClick={() => setProjectDeleteModal(proj)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold transition-all"
                                title="Delete Project"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* INTERACTIVE STUDIO DETAILED VIEW FOR SELECTED PROJECT */}
              {selectedSupabaseProject && (
                <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
                  {/* MULTI-PROJECT SWITCHER & TOP CONTROL BAR */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Studio Inspector</span>
                        <h3 className="text-base font-bold text-white font-mono">{selectedSupabaseProject.name}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-text-muted">
                        <span>Node: </span>
                        <span className="text-white font-bold">{selectedSupabaseProject.nodeIp || 'localhost'}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <span>Status: </span>
                        <span className="font-bold">{selectedSupabaseProject.status}</span>
                      </div>
                      <button
                        onClick={() => selectedSupabaseProject?.id && loadProjectStudioData(selectedSupabaseProject.id)}
                        disabled={isLoadingStudioData}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10 transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStudioData ? 'animate-spin text-emerald-400' : ''}`} />
                        <span>Sync Studio</span>
                      </button>
                    </div>
                  </div>

                  {/* STUDIO SUB-TAB NAVIGATION BAR */}
                  <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto">
                    <button
                      onClick={() => setStudioSubTab('overview')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        studioSubTab === 'overview'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Overview</span>
                    </button>

                    <button
                      onClick={() => setStudioSubTab('studio')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        studioSubTab === 'studio'
                          ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Native Supabase Studio (VPS)</span>
                    </button>

                    <button
                      onClick={() => setStudioSubTab('keys')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        studioSubTab === 'keys'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>API Keys & Connection</span>
                    </button>

                    <button
                      onClick={() => setStudioSubTab('settings')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        studioSubTab === 'settings'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Config & Settings</span>
                    </button>

                    <button
                      onClick={() => setStudioSubTab('tables')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        studioSubTab === 'tables'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Quick Table Browser ({projectTables.length})</span>
                    </button>

                    <button
                      onClick={() => setStudioSubTab('sql')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        studioSubTab === 'sql'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Quick SQL</span>
                    </button>
                  </div>

                  {/* SUB-TAB 1: OVERVIEW */}
                  {studioSubTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="bg-[#05060b] border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden space-y-5 shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                                Self-Hosted Supabase Stack
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                                Main VPS Node: {selectedSupabaseProject.nodeLabel || selectedSupabaseProject.nodeIp || 'Main VPS'}
                              </span>
                            </div>
                            <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
                              <span>{selectedSupabaseProject.name}</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                                selectedSupabaseProject.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}>
                                {selectedSupabaseProject.status}
                              </span>
                            </h2>
                            <p className="text-xs text-text-muted font-mono mt-1">
                              ID: {selectedSupabaseProject.id} | Host IP: <strong className="text-white">{selectedSupabaseProject.nodeIp || '127.0.0.1'}</strong> | Studio Port: <strong className="text-emerald-400">{selectedSupabaseProject.studioPort || 8000}</strong>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setStudioSubTab('studio')}
                              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
                            >
                              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Embed Studio In-App</span>
                            </button>
                            <a
                              href={getStudioUrl(selectedSupabaseProject)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
                            >
                              <span>Launch Studio UI</span>
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>

                        {/* Power Controls & Quick Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
                          {selectedSupabaseProject.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleStopProject(selectedSupabaseProject)}
                              disabled={actionLoading[`stop-${selectedSupabaseProject.id}`]}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                              <Square className="w-3.5 h-3.5" />
                              <span>{actionLoading[`stop-${selectedSupabaseProject.id}`] ? 'Stopping...' : 'Stop Stack'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartProject(selectedSupabaseProject)}
                              disabled={actionLoading[`start-${selectedSupabaseProject.id}`]}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{actionLoading[`start-${selectedSupabaseProject.id}`] ? 'Starting...' : 'Start Stack'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleRestartProject(selectedSupabaseProject)}
                            disabled={actionLoading[`restart-${selectedSupabaseProject.id}`]}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${actionLoading[`restart-${selectedSupabaseProject.id}`] ? 'animate-spin' : ''}`} />
                            <span>Restart</span>
                          </button>
                          <button
                            onClick={() => setProjectMigrateModal(selectedSupabaseProject)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            <span>Migrate Node</span>
                          </button>
                          <button
                            onClick={() => setProjectDeleteModal(selectedSupabaseProject)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-bold transition-all flex items-center gap-1.5 ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Stack</span>
                          </button>
                        </div>

                        {/* STATS SUMMARY GRID */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 relative z-10 font-mono">
                          <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl">
                            <span className="text-[10px] text-text-muted uppercase">Database Schemas</span>
                            <div className="text-base font-bold text-white mt-1">{projectSchemas.length}</div>
                          </div>
                          <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl">
                            <span className="text-[10px] text-text-muted uppercase">Public Tables</span>
                            <div className="text-base font-bold text-white mt-1">{projectTables.length}</div>
                          </div>
                          <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl">
                            <span className="text-[10px] text-text-muted uppercase">Auth Users</span>
                            <div className="text-base font-bold text-white mt-1">{authUsers.length}</div>
                          </div>
                          <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl">
                            <span className="text-[10px] text-text-muted uppercase">Storage Buckets</span>
                            <div className="text-base font-bold text-white mt-1">{storageBuckets.length}</div>
                          </div>
                        </div>

                        {/* CONNECTION ENDPOINTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 relative z-10 font-mono">
                          <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1">
                            <label className="text-[10px] text-text-muted uppercase font-bold">Studio Dashboard URL</label>
                            <div className="text-xs text-emerald-300 font-bold truncate">
                              {selectedSupabaseProject.studioUrl || `http://${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.studioPort || 8000}`}
                            </div>
                          </div>

                          <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1">
                            <label className="text-[10px] text-text-muted uppercase font-bold">Kong REST / Auth API Gateway</label>
                            <div className="text-xs text-cyan-300 font-bold truncate">
                              {selectedSupabaseProject.apiUrl || `http://${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.apiPort || 8001}`}
                            </div>
                          </div>

                          <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1">
                            <label className="text-[10px] text-text-muted uppercase font-bold">Supabase Meta / Admin API</label>
                            <div className="text-xs text-neutral-300 font-bold truncate">
                              {selectedSupabaseProject.metaUrl || `http://${selectedSupabaseProject.nodeIp || 'localhost'}:8080`}
                            </div>
                          </div>

                          <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1">
                            <label className="text-[10px] text-text-muted uppercase font-bold">PostgreSQL Direct Connection URI</label>
                            <div className="text-xs text-amber-300 font-bold truncate">
                              {selectedSupabaseProject.dbUrl || `postgresql://postgres:postgres@${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.dbPort || 5432}/${selectedSupabaseProject.dbName}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB: NATIVE SUPABASE STUDIO (VPS EMBEDDED) */}
                  {studioSubTab === 'studio' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#05060b] border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-white">Self-Hosted Supabase Studio Dashboard</h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Port {selectedSupabaseProject.studioPort || 8000}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted font-mono mt-0.5">
                              Running on Main VPS Node: <strong className="text-emerald-300">{selectedSupabaseProject.nodeLabel || selectedSupabaseProject.nodeIp || 'Main VPS'}</strong> ({selectedSupabaseProject.nodeIp || '127.0.0.1'})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              const iframe = document.getElementById('supabase-studio-frame') as HTMLIFrameElement;
                              if (iframe) iframe.src = iframe.src;
                            }}
                            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reload Frame</span>
                          </button>
                          <a
                            href={getStudioUrl(selectedSupabaseProject)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                          >
                            <span>Open Full Studio in New Window</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Embedded Native Studio Iframe */}
                      <div className="w-full h-[780px] bg-[#05060b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
                        <iframe
                          id="supabase-studio-frame"
                          src={getStudioUrl(selectedSupabaseProject)}
                          title={`Supabase Studio - ${selectedSupabaseProject.name}`}
                          className="w-full h-full border-0"
                          allow="clipboard-read; clipboard-write; fullscreen"
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB: API KEYS & CONNECTION URIs */}
                  {studioSubTab === 'keys' && (
                    <div className="bg-[#05060b] border border-white/10 rounded-2xl p-6 space-y-6">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Key className="w-4 h-4 text-emerald-400" />
                          <span>Project API Keys & Connection URIs</span>
                        </h3>
                        <p className="text-xs text-text-muted font-mono mt-1">
                          Use these credentials to connect web applications, mobile clients, and backend services to this self-hosted Supabase stack on your VPS node.
                        </p>
                      </div>

                      <div className="space-y-4 font-mono">
                        {/* Project URL */}
                        <div className="space-y-1.5">
                          <label className="text-xs text-text-muted font-bold uppercase">Project URL (Kong API Gateway)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={selectedSupabaseProject.apiUrl || `http://${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.apiPort || 8001}`}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-emerald-300 font-bold focus:outline-none"
                            />
                            <button
                              onClick={() => handleCopy(selectedSupabaseProject.apiUrl || `http://${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.apiPort || 8001}`, 'Project URL')}
                              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                            >
                              {copiedKey === 'Project URL' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === 'Project URL' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Anon Public Key */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-text-muted font-bold uppercase">Anon Public API Key (Client-side Safe)</label>
                            <span className="text-[10px] text-emerald-400">role: 'anon' (enforces RLS)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type={revealedKeys[`anon-${selectedSupabaseProject.id}`] ? 'text' : 'password'}
                              readOnly
                              value={selectedSupabaseProject.anonKey}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => toggleKeyReveal(`anon-${selectedSupabaseProject.id}`)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-white transition-all shrink-0"
                            >
                              {revealedKeys[`anon-${selectedSupabaseProject.id}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(selectedSupabaseProject.anonKey, 'Anon Key')}
                              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                            >
                              {copiedKey === 'Anon Key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === 'Anon Key' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Service Role Secret */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-amber-400 font-bold uppercase">Service Role Secret (Private / Admin Only)</label>
                            <span className="text-[10px] text-amber-400">role: 'service_role' (bypasses RLS)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type={revealedKeys[`service-${selectedSupabaseProject.id}`] ? 'text' : 'password'}
                              readOnly
                              value={selectedSupabaseProject.serviceKey}
                              className="flex-1 bg-white/5 border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs text-amber-200 focus:outline-none"
                            />
                            <button
                              onClick={() => toggleKeyReveal(`service-${selectedSupabaseProject.id}`)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-white transition-all shrink-0"
                            >
                              {revealedKeys[`service-${selectedSupabaseProject.id}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(selectedSupabaseProject.serviceKey, 'Service Key')}
                              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                            >
                              {copiedKey === 'Service Key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === 'Service Key' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        {/* PostgreSQL Direct Connection URI */}
                        <div className="space-y-1.5">
                          <label className="text-xs text-text-muted font-bold uppercase">PostgreSQL Direct Connection URI</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={selectedSupabaseProject.dbUrl || `postgresql://postgres:postgres@${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.dbPort || 5432}/${selectedSupabaseProject.dbName}`}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-cyan-300 font-bold focus:outline-none"
                            />
                            <button
                              onClick={() => handleCopy(selectedSupabaseProject.dbUrl || `postgresql://postgres:postgres@${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.dbPort || 5432}/${selectedSupabaseProject.dbName}`, 'DB URI')}
                              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                            >
                              {copiedKey === 'DB URI' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === 'DB URI' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB: TABLE BROWSER */}
                  {studioSubTab === 'tables' && (
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        {/* Schema + Table Sidebar */}
                        <div className="w-56 shrink-0 space-y-3">
                          {/* Schema selector */}
                          <div>
                            <label className="text-[10px] text-text-muted uppercase font-mono font-bold block mb-1">Schema</label>
                            <select
                              value={selectedSchema}
                              onChange={(e) => {
                                setSelectedSchema(e.target.value);
                                setSelectedTable(null);
                                setTableData(null);
                              }}
                              className="w-full bg-[#0b0c16] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                            >
                              {projectSchemas.length === 0
                                ? <option value="public">public</option>
                                : projectSchemas.map((s: any) => (
                                    <option key={s.name || s} value={s.name || s}>{s.name || s}</option>
                                  ))}
                            </select>
                          </div>

                          {/* Table list */}
                          <div className="bg-[#05060b] border border-white/10 rounded-2xl overflow-hidden">
                            <div className="px-3 py-2 border-b border-white/10 text-[10px] text-text-muted uppercase font-mono font-bold">
                              Tables
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                              {projectTables.length === 0 ? (
                                <div className="p-3 text-xs text-text-muted font-mono">No tables found.</div>
                              ) : (
                                projectTables
                                  .filter((t: any) => !selectedSchema || (t.schema || 'public') === selectedSchema)
                                  .map((t: any) => {
                                    const tName = t.name || t;
                                    return (
                                      <button
                                        key={tName}
                                        onClick={() => loadTableData(tName, selectedSchema)}
                                        className={`w-full text-left px-3 py-2 text-xs font-mono transition-all flex items-center gap-2 ${
                                          selectedTable === tName
                                            ? 'bg-emerald-500/15 text-emerald-300'
                                            : 'text-text-muted hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <Database className="w-3 h-3 shrink-0 opacity-50" />
                                        <span className="truncate">{tName}</span>
                                      </button>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Table data grid */}
                        <div className="flex-1 min-w-0">
                          {!selectedTable ? (
                            <div className="bg-[#05060b] border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 h-full text-center">
                              <Database className="w-8 h-8 text-emerald-500/40" />
                              <p className="text-xs text-text-muted font-mono">Select a table from the sidebar to browse its data.</p>
                            </div>
                          ) : isLoadingTableData ? (
                            <div className="bg-[#05060b] border border-white/10 rounded-2xl p-10 flex items-center justify-center h-full">
                              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <div className="bg-[#05060b] border border-white/10 rounded-2xl overflow-hidden">
                              {/* Table header bar */}
                              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 font-mono">
                                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-xs font-bold text-white">{selectedSchema}.{selectedTable}</span>
                                  {tableData && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                                      {tableData.length} rows
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSqlQuery(`SELECT * FROM "${selectedSchema}"."${selectedTable}" LIMIT 100;`);
                                      setStudioSubTab('sql');
                                    }}
                                    title="Edit in SQL Console"
                                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-[10px] font-mono transition-all flex items-center gap-1"
                                  >
                                    <Code className="w-3 h-3" />
                                    <span>Open in SQL</span>
                                  </button>
                                  <button
                                    onClick={() => loadTableData(selectedTable, selectedSchema)}
                                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-[10px] font-mono transition-all"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Data grid */}
                              {!tableData || tableData.length === 0 ? (
                                <div className="p-8 text-center text-xs text-text-muted font-mono">
                                  Table is empty or no rows returned.
                                </div>
                              ) : (
                                <div className="overflow-x-auto max-h-[420px]">
                                  <table className="w-full text-left text-xs font-mono">
                                    <thead className="bg-white/5 text-text-muted text-[10px] uppercase sticky top-0">
                                      <tr>
                                        {Object.keys(tableData[0]).map((col) => (
                                          <th key={col} className="px-3 py-2.5 border-b border-white/10 whitespace-nowrap font-bold">{col}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {tableData.map((row: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                                          {Object.values(row).map((val: any, vIdx: number) => (
                                            <td key={vIdx} className="px-3 py-2 text-white whitespace-nowrap max-w-[200px] truncate">
                                              {val === null
                                                ? <span className="text-text-muted italic">null</span>
                                                : typeof val === 'object'
                                                ? <span className="text-neutral-300">{JSON.stringify(val)}</span>
                                                : typeof val === 'boolean'
                                                ? <span className={val ? 'text-emerald-400' : 'text-amber-400'}>{String(val)}</span>
                                                : <span>{String(val)}</span>
                                              }
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: SQL CONSOLE */}
                  {studioSubTab === 'sql' && (
                    <div className="space-y-4">
                      <div className="bg-[#05060b] border border-white/10 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                            <Terminal className="w-4 h-4 text-emerald-400" />
                            <span>Interactive SQL Editor ({selectedSupabaseProject.name})</span>
                          </h3>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSqlQuery('SELECT * FROM public.profiles LIMIT 50;')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-text-muted"
                            >
                              Preset: Profiles
                            </button>
                            <button
                              type="button"
                              onClick={() => setSqlQuery('SELECT tablename, schemaname FROM pg_tables WHERE schemaname=\'public\';')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-text-muted"
                            >
                              Preset: Tables
                            </button>
                            <button
                              type="button"
                              onClick={() => setSqlQuery('SELECT version();')}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-text-muted"
                            >
                              Preset: Postgres Version
                            </button>
                          </div>
                        </div>

                        <form onSubmit={handleExecuteSql} className="space-y-3">
                          <textarea
                            rows={5}
                            value={sqlQuery}
                            onChange={(e) => setSqlQuery(e.target.value)}
                            placeholder="Enter SQL query..."
                            className="w-full bg-[#0b0c16] border border-white/10 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                          />

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-text-muted font-mono">Target Database: {selectedSupabaseProject.dbName || 'postgres'}</span>
                            <button
                              type="submit"
                              disabled={isExecutingSql}
                              className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                              {isExecutingSql ? 'Executing...' : 'Run Query ▶'}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* QUERY RESULT */}
                      {sqlResult && (
                        <div className="bg-[#05060b] border border-white/10 rounded-2xl p-5 space-y-3 font-mono">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Query Output</h4>

                          {sqlResult.error ? (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                              Error: {sqlResult.error}
                            </div>
                          ) : Array.isArray(sqlResult) || Array.isArray(sqlResult.rows) ? (
                            <div className="overflow-x-auto max-h-96 border border-white/10 rounded-xl">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-white/5 text-text-muted uppercase text-[10px]">
                                  <tr>
                                    {Object.keys((Array.isArray(sqlResult) ? sqlResult : sqlResult.rows)[0] || {}).map((col) => (
                                      <th key={col} className="p-2.5 border-b border-white/10">{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {(Array.isArray(sqlResult) ? sqlResult : sqlResult.rows).map((row: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-white/5 text-white">
                                      {Object.values(row).map((val: any, vIdx: number) => (
                                        <td key={vIdx} className="p-2.5 whitespace-nowrap max-w-xs truncate">
                                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <pre className="p-3 bg-black/40 rounded-xl text-xs text-emerald-300 overflow-x-auto">
                              {JSON.stringify(sqlResult, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 3: AUTH USERS */}
                  {studioSubTab === 'auth' && (
                    <div className="space-y-6">
                      <div className="bg-[#05060b] border border-white/10 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-400" />
                          <span>GoTrue User Provisioner</span>
                        </h3>

                        <form onSubmit={handleCreateAuthUser} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="email"
                            placeholder="user@example.com"
                            value={newAuthEmail}
                            onChange={(e) => setNewAuthEmail(e.target.value)}
                            required
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={newAuthPass}
                            onChange={(e) => setNewAuthPass(e.target.value)}
                            required
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <button
                            type="submit"
                            disabled={isCreatingAuthUser}
                            className="py-2 px-4 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 disabled:opacity-50 transition-all"
                          >
                            {isCreatingAuthUser ? 'Creating...' : '+ Add Auth User'}
                          </button>
                        </form>
                      </div>

                      {/* USERS TABLE */}
                      <div className="bg-[#05060b] border border-white/10 rounded-2xl p-5 space-y-4 font-mono">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Registered Auth Users</h4>

                        {authUsers.length === 0 ? (
                          <p className="text-xs text-text-muted py-4">No auth users created yet.</p>
                        ) : (
                          <div className="overflow-x-auto border border-white/10 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-white/5 text-text-muted uppercase text-[10px]">
                                <tr>
                                  <th className="p-2.5">User ID</th>
                                  <th className="p-2.5">Email</th>
                                  <th className="p-2.5">Role</th>
                                  <th className="p-2.5">Created At</th>
                                  <th className="p-2.5 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {authUsers.map((u: any) => (
                                  <tr key={u.id} className="hover:bg-white/5 text-white">
                                    <td className="p-2.5 font-bold text-emerald-400 truncate max-w-xs">{u.id}</td>
                                    <td className="p-2.5">{u.email}</td>
                                    <td className="p-2.5">{u.role || 'authenticated'}</td>
                                    <td className="p-2.5 text-text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        onClick={() => handleDeleteAuthUser(u.id)}
                                        className="px-2 py-1 rounded text-red-400 hover:bg-red-500/10 text-xs font-bold"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 inline" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 4: STORAGE BUCKETS */}
                  {studioSubTab === 'storage' && (
                    <div className="space-y-6">
                      <div className="bg-[#05060b] border border-white/10 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Folder className="w-4 h-4 text-emerald-400" />
                          <span>Create Storage Bucket</span>
                        </h3>

                        <form onSubmit={handleCreateBucket} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <input
                            type="text"
                            placeholder="Bucket ID (e.g. avatars)"
                            value={newBucketId}
                            onChange={(e) => setNewBucketId(e.target.value)}
                            required
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Display Name"
                            value={newBucketName}
                            onChange={(e) => setNewBucketName(e.target.value)}
                            required
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-text-muted font-mono">Public:</label>
                            <input
                              type="checkbox"
                              checked={newBucketPublic}
                              onChange={(e) => setNewBucketPublic(e.target.checked)}
                              className="w-4 h-4 rounded border-white/10 accent-emerald-500"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isCreatingBucket}
                            className="py-2 px-4 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 disabled:opacity-50 transition-all"
                          >
                            {isCreatingBucket ? 'Creating...' : '+ Create Bucket'}
                          </button>
                        </form>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                        {storageBuckets.map((b: any) => (
                          <div key={b.id} className="p-4 bg-[#05060b] border border-white/10 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-white">{b.name || b.id}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.public ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {b.public ? 'PUBLIC' : 'PRIVATE'}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted truncate">ID: {b.id}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 5: ADVISORS LINTER */}
                  {studioSubTab === 'advisors' && (
                    <div className="space-y-6">
                      <div className="bg-[#05060b] border border-white/10 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-emerald-400" />
                          <span>Security & Performance Advisors</span>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                            <h4 className="font-bold text-amber-400 uppercase text-[11px]">Security Linter Audit</h4>
                            {advisorsData.security.length === 0 ? (
                              <p className="text-emerald-400 text-xs flex items-center gap-1"><IconCheckCircle size={11} className="inline" /> No critical security advisories detected.</p>
                            ) : (
                              advisorsData.security.map((sec: any, idx: number) => (
                                <div key={idx} className="p-2.5 bg-black/40 rounded-lg border border-amber-500/20 text-text-muted">
                                  <span className="text-white font-bold">{sec.name || sec.title}</span>
                                  <p className="text-[10px] mt-1">{sec.detail || sec.description}</p>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                            <h4 className="font-bold text-cyan-400 uppercase text-[11px]">Performance Linter Audit</h4>
                            {advisorsData.performance.length === 0 ? (
                              <p className="text-emerald-400 text-xs flex items-center gap-1"><IconCheckCircle size={11} className="inline" /> Database indexes & query plans optimized.</p>
                            ) : (
                              advisorsData.performance.map((perf: any, idx: number) => (
                                <div key={idx} className="p-2.5 bg-black/40 rounded-lg border border-cyan-500/20 text-text-muted">
                                  <span className="text-white font-bold">{perf.name || perf.title}</span>
                                  <p className="text-[10px] mt-1">{perf.detail || perf.description}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 6: OBSERVABILITY & LOGS */}
                  {studioSubTab === 'observability' && (
                    <div className="space-y-6">
                      <div className="bg-[#05060b] border border-white/10 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <span>Real-time Observability & Service Logs</span>
                          </h3>

                          <select
                            value={logsServiceFilter}
                            onChange={(e) => {
                              setLogsServiceFilter(e.target.value);
                              if (selectedSupabaseProject?.id) loadProjectStudioData(selectedSupabaseProject.id);
                            }}
                            className="bg-[#0a0a0c] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                          >
                            <option value="all">All Services</option>
                            <option value="postgres">PostgreSQL Engine</option>
                            <option value="auth">GoTrue Auth</option>
                            <option value="storage">Storage API</option>
                            <option value="kong">Kong API Gateway</option>
                            <option value="pg-meta">Postgres Meta</option>
                          </select>
                        </div>

                        <div className="p-4 bg-[#0b0c16] border border-white/10 rounded-xl font-mono max-h-96 overflow-y-auto space-y-1.5">
                          {logsData.length === 0 ? (
                            <p className="text-xs text-text-muted">No logs recorded for filter "{logsServiceFilter}".</p>
                          ) : (
                            logsData.map((log: any, idx: number) => (
                              <div key={idx} className="text-[11px] text-emerald-300 font-mono">
                                <span className="text-text-muted">[{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'LOG'}]:</span>{' '}
                                <span>{typeof log === 'string' ? log : log.event_message || JSON.stringify(log)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 7: SETTINGS & KEYS */}
                  {studioSubTab === 'settings' && (
                    <div className="bg-[#05060b] border border-white/10 rounded-2xl p-6 space-y-6">
                      <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-emerald-400" />
                        <span>Supabase Stack Configuration & Security Keys</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                        <div className="space-y-1.5">
                          <label className="text-xs text-text-muted">Anon Public Key</label>
                          <input
                            type="text"
                            readOnly
                            value={selectedSupabaseProject.anonKey}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs text-text-muted">Service Role Key</label>
                          <input
                            type="text"
                            readOnly
                            value={selectedSupabaseProject.serviceKey}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <h4 className="text-xs font-bold text-white">Update Security & Database Settings</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-text-muted mb-1">New DB Master Password</label>
                            <input
                              type="password"
                              placeholder="••••••••••••"
                              value={editDbPass}
                              onChange={(e) => setEditDbPass(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1">New Auth JWT Secret</label>
                            <input
                              type="password"
                              placeholder="••••••••••••"
                              value={editJwtSecret}
                              onChange={(e) => setEditJwtSecret(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1">Storage Quota (MB)</label>
                            <input
                              type="number"
                              value={editStorageMb}
                              onChange={(e) => setEditStorageMb(Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <button
                          onClick={handleSaveSupabaseConfig}
                          disabled={isSavingSupabaseSettings}
                          className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
                        >
                          {isSavingSupabaseSettings ? 'Saving...' : 'Save Configuration Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: MANAGED DATABASES */}
          {activeTab === 'databases' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Managed Database Clusters</h2>
                  <p className="text-xs text-text-muted">PostgreSQL 16, MySQL 8, Redis Stack, and MongoDB Instances.</p>
                </div>
                <button
                  onClick={() => {
                    setCreateCategory('database');
                    setShowCreateModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/30 transition-all"
                >
                  + Provision Engine
                </button>
              </div>

              {managedDbs.length === 0 ? (
                <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-10 text-center space-y-3">
                  <p className="text-xs text-text-muted">No managed database instances found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {managedDbs.map((db) => {
                    const revealedPass = revealedPasswords[db.id];
                    return (
                      <div key={db.id} className="p-5 bg-[#0b0c16] border border-white/10 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs font-bold uppercase font-mono border border-cyan-500/30">
                              {db.type}
                            </span>
                            <span className="text-sm font-bold text-white font-mono">{db.dbName || db.id}</span>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold uppercase">
                            {db.status || 'RUNNING'}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono text-text-muted bg-white/[0.02] p-3 rounded-xl border border-white/5">
                          <p>Internal Host: <span className="text-white font-bold">{db.internalHost || 'localhost'}</span></p>
                          <p>Internal Port: <span className="text-white font-bold">{db.internalPort || 5432}</span></p>
                          <p>Allowed IPs: <span className="text-white font-bold">{(db.allowedIps || ['0.0.0.0/0']).join(', ')}</span></p>
                          {revealedPass && (
                            <p className="text-amber-400 font-bold">Master Password: <span className="text-white select-all">{revealedPass}</span></p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 gap-2">
                          <button
                            onClick={() => handleRevealDbPassword(db.id)}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-xs font-mono transition-all flex items-center gap-1.5"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            <span>{revealedPass ? 'Revealed' : 'Reveal Credentials'}</span>
                          </button>
                          <button
                            onClick={() => setSelectedDbForScale(db)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Scale & Migrate</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* PROVISIONING MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Provision New Infrastructure Resource
            </h3>

            {/* CATEGORY TOGGLE */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setCreateCategory('supabase')}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  createCategory === 'supabase'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Supabase Stack</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateCategory('database')}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  createCategory === 'database'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Managed Database</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createCategory === 'supabase' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Project Name</label>
                    <input
                      type="text"
                      placeholder="e.g. production-supabase-app"
                      value={supaName}
                      onChange={(e) => setSupaName(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Client Email Owner</label>
                    <input
                      type="email"
                      placeholder="client@shanutechx.com"
                      value={supaEmail}
                      onChange={(e) => setSupaEmail(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Target VPS Compute Node</label>
                    <select
                      value={supaNodeId}
                      onChange={(e) => setSupaNodeId(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      {nodes.map((n) => {
                        const isMain = n.roleTags?.includes('main-node') || n.label.toLowerCase().includes('main');
                        return (
                          <option key={n.id} value={n.id}>
                            {isMain ? '[MAIN VPS NODE] ' : ''}{n.label} ({n.ip}) - {n.cpuCores || 4} Cores / {n.ramMb || 8192} MB RAM
                          </option>
                        );
                      })}
                      <option value="">Auto-Select Optimal Node (Lowest CPU/RAM Load)</option>
                    </select>
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">
                      Deploys on your Main VPS node with full self-hosted Supabase Studio dashboard, Kong API gateway, PostgreSQL & Auth.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Cluster Database Name</label>
                    <input
                      type="text"
                      placeholder="e.g. main-pg-cluster"
                      value={dbName}
                      onChange={(e) => setDbName(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1">Database Engine Type</label>
                    <select
                      value={dbType}
                      onChange={(e: any) => setDbType(e.target.value)}
                      className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="postgres">PostgreSQL 16 Engine</option>
                      <option value="mysql">MySQL 8.0 Engine</option>
                      <option value="redis">Redis Stack Server</option>
                      <option value="mongodb">MongoDB Community</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-neutral-800 to-black text-xs font-bold text-white shadow-lg shadow-md disabled:opacity-50"
                >
                  {isProvisioning ? 'Provisioning...' : 'Provision Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NODE MIGRATION / REBALANCE MODAL */}
      {projectMigrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-white" />
              <span>Migrate Supabase Project to VPS Node</span>
            </h3>

            <p className="text-xs text-text-muted font-mono">
              Rebalance <strong>{projectMigrateModal.name}</strong> to a different host compute node. This automatically updates DNS A-records to the target node IP.
            </p>

            <form onSubmit={handleMigrateProjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 font-mono">Target Host Node</label>
                <select
                  value={targetMigrateNodeId}
                  onChange={(e) => setTargetMigrateNodeId(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white/30 font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.ip}) - CPU: {n.cpuUsedPct ?? 10}% / RAM: {n.ramUsedMb ?? 512}MB
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setProjectMigrateModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading[`migrate-${projectMigrateModal.id}`]}
                  className="px-5 py-2 rounded-xl bg-white text-black hover:bg-violet-500 text-xs font-bold text-white shadow-lg shadow-md disabled:opacity-50"
                >
                  {actionLoading[`migrate-${projectMigrateModal.id}`] ? 'Migrating...' : 'Confirm Migration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {projectDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-red-500/30 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Confirm Project Deletion</span>
            </h3>

            <p className="text-xs text-text-muted font-mono">
              Are you sure you want to permanently delete Supabase Stack <strong>{projectDeleteModal.name}</strong> ({projectDeleteModal.id})? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setProjectDeleteModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProjectConfirm}
                disabled={actionLoading[`delete-${projectDeleteModal.id}`]}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-500/25 disabled:opacity-50"
              >
                {actionLoading[`delete-${projectDeleteModal.id}`] ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT LOGS MODAL */}
      {projectLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1021] border border-white/15 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span>Container & Daemon Logs ({projectLogsModal.project.name})</span>
              </h3>
              <button
                onClick={() => setProjectLogsModal(null)}
                className="text-text-muted hover:text-white font-bold text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-4 bg-[#05060b] border border-white/10 rounded-xl font-mono text-xs max-h-96 overflow-y-auto space-y-1.5">
              {projectLogsModal.logs.length === 0 ? (
                <p className="text-text-muted">No logs recorded yet.</p>
              ) : (
                projectLogsModal.logs.map((l: any, idx: number) => (
                  <div key={idx} className="text-emerald-300 font-mono text-[11px]">
                    <span className="text-text-muted">[{l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : 'LOG'}]:</span>{' '}
                    <span className="font-bold text-cyan-400">[{l.service}]</span> {l.message}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setProjectLogsModal(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATABASE MIGRATION & SCALING MODAL */}
      <DatabaseMigrationScaleModal
        isOpen={!!selectedDbForScale}
        onClose={() => setSelectedDbForScale(null)}
        database={selectedDbForScale}
        onSuccess={loadAllData}
      />
    </div>
  );
}
