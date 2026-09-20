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
} from 'lucide-react';
import { api } from '@/lib/api';
import { SupabaseClientProject, Node } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import DatabaseMigrationScaleModal from '@/components/DatabaseMigrationScaleModal';

export default function UnifiedDevProjectsPage() {
  const { apiUser } = useAppUser();
  const isDev = apiUser?.role === 'dev' || apiUser?.role === 'admin';

  // Data state
  const [supabaseProjects, setSupabaseProjects] = useState<SupabaseClientProject[]>([]);
  const [managedDbs, setManagedDbs] = useState<any[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'supabase' | 'databases' | 'nodes'>('supabase');

  // Selected Supabase Project for detailed configuration
  const setSelectedSupabaseProject_State = useState<SupabaseClientProject | null>(null);
  const [selectedSupabaseProject, setSelectedSupabaseProject] = setSelectedSupabaseProject_State;

  // Supabase Studio Sub-Tab navigation state
  const [studioSubTab, setStudioSubTab] = useState<
    'overview' | 'sql' | 'auth' | 'storage' | 'advisors' | 'observability' | 'settings'
  >('overview');

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

  // Node port exposure form state
  const [selectedNodeForExpose, setSelectedNodeForExpose] = useState<string>('');
  const [exposePortNum, setExposePortNum] = useState<number>(8080);
  const [exposeSubdomain, setExposeSubdomain] = useState<string>('');
  const [exposeProtocol, setExposeProtocol] = useState<'http' | 'https' | 'tcp'>('http');
  const [nodeExposures, setNodeExposures] = useState<Record<string, any[]>>({});
  const [isExposingPort, setIsExposingPort] = useState(false);

  useEffect(() => {
    if (selectedSupabaseProject?.id) {
      loadProjectStudioData(selectedSupabaseProject.id);
    }
  }, [selectedSupabaseProject?.id]);

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

      setSupabaseProjects(supaRes.projects);
      if (supaRes.projects.length > 0) {
        setSelectedSupabaseProject(supaRes.projects[0]);
      }
      setManagedDbs(dbRes.databases || []);
      setNodes(nodeRes.nodes || []);
      if (nodeRes.nodes && nodeRes.nodes.length > 0) {
        setSupaNodeId(nodeRes.nodes[0].id);
        setSelectedNodeForExpose(nodeRes.nodes[0].id);
        loadNodeExposures(nodeRes.nodes[0].id);
      }
    } catch (err: any) {
      console.error('Failed loading projects hub data', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadNodeExposures(nodeId: string) {
    if (!nodeId) return;
    try {
      const res = await api.nodes.getPortExposures(nodeId);
      setNodeExposures((prev) => ({ ...prev, [nodeId]: res.exposures || [] }));
    } catch {
      // best-effort
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
        setActionNotice(`Supabase Stack "${res.project.name}" provisioned successfully!`);
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

  async function handleExposePort(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNodeForExpose || !exposePortNum) return;
    setIsExposingPort(true);

    try {
      const res = await api.nodes.exposePort(selectedNodeForExpose, {
        port: Number(exposePortNum),
        subdomain: exposeSubdomain.trim() || undefined,
        protocol: exposeProtocol,
      });
      await loadNodeExposures(selectedNodeForExpose);
      setActionNotice(`Port ${exposePortNum} exposed at ${res.exposure.url}`);
      setExposeSubdomain('');
    } catch (err: any) {
      setActionNotice(`Failed exposing port: ${err?.error || err?.message || 'Error'}`);
    } finally {
      setIsExposingPort(false);
    }
  }

  async function handleDeletePortExposure(nodeId: string, exposureId: string) {
    if (!confirm('Are you sure you want to remove this port exposure and DNS record?')) return;
    try {
      await api.nodes.deletePortExposure(nodeId, exposureId);
      await loadNodeExposures(nodeId);
    } catch {
      alert('Failed deleting port exposure');
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
            <span className="text-xs text-text-muted font-mono">Autonomous Orchestration</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Unified Projects & Databases Hub</h1>
          <p className="text-xs text-text-muted mt-1">
            Manage Self-Hosted Supabase Stacks, Managed Databases, and Node Port Exposures in one place.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-violet-500/25 transition-all flex items-center gap-2"
        >
          <span>+ Provision New Project / DB</span>
        </button>
      </div>

      {/* ACTION NOTICE BANNER */}
      {actionNotice && (
        <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl flex items-center justify-between text-xs text-violet-300 font-mono">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-text-muted hover:text-white font-bold">
            ✕
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

        <button
          onClick={() => setActiveTab('nodes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'nodes'
              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-md'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Node Domain & Port Exposure</span>
          <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-[10px]">{nodes.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* TAB 1: SUPABASE STACKS & MULTI-PROJECT STUDIO */}
          {activeTab === 'supabase' && (
            <div className="space-y-6">
              {supabaseProjects.length === 0 ? (
                <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-10 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-black mx-auto">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">No Supabase Stacks Provisioned</h3>
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    Deploy a full self-hosted Supabase environment including Postgres, Auth (GoTrue), Storage, and Supabase Studio on any target VPS host node.
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
                <div className="space-y-6">
                  {/* MULTI-PROJECT SWITCHER & TOP CONTROL BAR */}
                  <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="flex-1 md:w-80">
                        <label className="block text-[10px] text-text-muted uppercase font-mono font-bold">Active Supabase Project / Tenant</label>
                        <select
                          value={selectedSupabaseProject?.id || ''}
                          onChange={(e) => {
                            const found = supabaseProjects.find((p) => p.id === e.target.value);
                            if (found) setSelectedSupabaseProject(found);
                          }}
                          className="w-full bg-[#121324] border border-emerald-500/30 rounded-xl px-3 py-1.5 text-sm text-white font-bold font-mono focus:outline-none focus:border-emerald-500"
                        >
                          {supabaseProjects.map((proj) => (
                            <option key={proj.id} value={proj.id}>
                              {proj.name} ({proj.nodeIp || '127.0.0.1'}) - {proj.status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedSupabaseProject && (
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
                          <span>Sync Data</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedSupabaseProject && (
                    <div className="space-y-6">
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
                          <span>Overview & Launch</span>
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
                          <span>SQL Console</span>
                        </button>

                        <button
                          onClick={() => setStudioSubTab('auth')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            studioSubTab === 'auth'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-text-muted hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Auth Users ({authUsers.length})</span>
                        </button>

                        <button
                          onClick={() => setStudioSubTab('storage')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            studioSubTab === 'storage'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-text-muted hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Folder className="w-3.5 h-3.5" />
                          <span>Storage Buckets ({storageBuckets.length})</span>
                        </button>

                        <button
                          onClick={() => setStudioSubTab('advisors')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            studioSubTab === 'advisors'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-text-muted hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Advisors Linter</span>
                        </button>

                        <button
                          onClick={() => setStudioSubTab('observability')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                            studioSubTab === 'observability'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-text-muted hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Observability & Logs</span>
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
                          <span>Settings & Keys</span>
                        </button>
                      </div>

                      {/* SUB-TAB 1: OVERVIEW */}
                      {studioSubTab === 'overview' && (
                        <div className="space-y-6">
                          <div className="bg-[#0b0c16] border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden space-y-4 shadow-xl">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-emerald-400 font-mono text-8xl font-black">
                              SUPABASE
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                                  Self-Hosted Supabase Stack
                                </span>
                                <h2 className="text-xl font-black text-white mt-0.5">{selectedSupabaseProject.name}</h2>
                                <p className="text-xs text-text-muted font-mono mt-1">
                                  ID: {selectedSupabaseProject.id} | Host: {selectedSupabaseProject.nodeIp || '127.0.0.1'}
                                </p>
                              </div>

                              <a
                                href={selectedSupabaseProject.studioUrl || `http://${selectedSupabaseProject.nodeIp || 'localhost'}:${selectedSupabaseProject.studioPort || 8000}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
                              >
                                <span>Launch Studio UI</span>
                                <ExternalLink className="w-4 h-4" />
                              </a>
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
                                <div className="text-xs text-violet-300 font-bold truncate">
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

                      {/* SUB-TAB 2: SQL CONSOLE */}
                      {studioSubTab === 'sql' && (
                        <div className="space-y-4">
                          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4">
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
                                className="w-full bg-[#05060b] border border-white/10 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
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
                            <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-3 font-mono">
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
                          {/* CREATE AUTH USER FORM */}
                          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4">
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
                          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4 font-mono">
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
                          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4">
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
                              <div key={b.id} className="p-4 bg-[#0b0c16] border border-white/10 rounded-2xl space-y-2">
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
                          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-emerald-400" />
                              <span>Security & Performance Advisors</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                              <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                                <h4 className="font-bold text-amber-400 uppercase text-[11px]">Security Linter Audit</h4>
                                {advisorsData.security.length === 0 ? (
                                  <p className="text-emerald-400 text-xs">✓ No critical security advisories detected.</p>
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
                                  <p className="text-emerald-400 text-xs">✓ Database indexes & query plans optimized.</p>
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
                          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4">
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
                                className="bg-[#121324] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                              >
                                <option value="all">All Services</option>
                                <option value="postgres">PostgreSQL Engine</option>
                                <option value="auth">GoTrue Auth</option>
                                <option value="storage">Storage API</option>
                                <option value="kong">Kong API Gateway</option>
                                <option value="pg-meta">Postgres Meta</option>
                              </select>
                            </div>

                            <div className="p-4 bg-[#05060b] border border-white/10 rounded-xl font-mono max-h-96 overflow-y-auto space-y-1.5">
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
                        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
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

          {/* TAB 3: NODE DOMAIN & PORT EXPOSURE */}
          {activeTab === 'nodes' && (
            <div className="space-y-6">
              <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6">
                <div>
                  <h2 className="text-base font-bold text-white">Node Domain Pointing & Port Exposures</h2>
                  <p className="text-xs text-text-muted">
                    Expose internal container/node ports to dedicated platform subdomains automatically powered by Cloudflare DNS.
                  </p>
                </div>

                {/* SELECT HOST NODE */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] p-4 rounded-xl border border-white/10">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Target VPS Host Node</label>
                    <select
                      value={selectedNodeForExpose}
                      onChange={(e) => {
                        setSelectedNodeForExpose(e.target.value);
                        loadNodeExposures(e.target.value);
                      }}
                      className="bg-[#121324] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500 font-mono"
                    >
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.ip}) - {n.cpuCores} Cores / {n.ramMb} MB
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-xs text-emerald-400 font-mono">
                    Auto DNS: node-&lt;label&gt;.shanutechx.com
                  </div>
                </div>

                {/* EXPOSE PORT FORM */}
                <form onSubmit={handleExposePort} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white/[0.01] p-4 rounded-xl border border-white/5">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Port Number</label>
                    <input
                      type="number"
                      placeholder="e.g. 8080"
                      value={exposePortNum}
                      onChange={(e) => setExposePortNum(Number(e.target.value))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">Custom Subdomain (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. my-app"
                      value={exposeSubdomain}
                      onChange={(e) => setExposeSubdomain(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1">Protocol</label>
                    <select
                      value={exposeProtocol}
                      onChange={(e: any) => setExposeProtocol(e.target.value)}
                      className="w-full bg-[#121324] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                      <option value="tcp">TCP</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isExposingPort}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-500/25 disabled:opacity-50"
                    >
                      {isExposingPort ? 'Exposing...' : '+ Expose Port & Point Domain'}
                    </button>
                  </div>
                </form>

                {/* CURRENT EXPOSURES FOR SELECTED NODE */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Port Exposures</h3>

                  {!(nodeExposures[selectedNodeForExpose]?.length) ? (
                    <p className="text-xs text-text-muted py-4">No ports exposed on this node yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {nodeExposures[selectedNodeForExpose].map((exp) => (
                        <div key={exp.id} className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl flex items-center justify-between font-mono">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-bold uppercase">
                                Port {exp.port}
                              </span>
                              <a
                                href={exp.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-cyan-400 hover:underline"
                              >
                                {exp.domain} ↗
                              </a>
                            </div>
                            <p className="text-[10px] text-text-muted mt-1">{exp.label || 'Exposed Service'}</p>
                          </div>

                          <button
                            onClick={() => handleDeletePortExposure(exp.nodeId, exp.id)}
                            className="px-2 py-1 rounded text-red-400 hover:bg-red-500/10 text-xs font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                    <label className="block text-xs font-semibold text-text-muted mb-1">Target Host VPS Compute Node</label>
                    <select
                      value={supaNodeId}
                      onChange={(e) => setSupaNodeId(e.target.value)}
                      className="w-full bg-[#121324] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      {nodes.length === 0 ? (
                        <option value="">Default (Main Node)</option>
                      ) : (
                        nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.label} ({n.ip}) - {n.cpuCores || 4} Cores / {n.ramMb || 8192} MB RAM
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">
                      ⚡ Auto-creates unproxied DNS A-record (proxied: false): supabase-&lt;name&gt;.shanutechx.com ➔ Node IP
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
                      className="w-full bg-[#121324] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50"
                >
                  {isProvisioning ? 'Provisioning...' : 'Provision Resource'}
                </button>
              </div>
            </form>
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

