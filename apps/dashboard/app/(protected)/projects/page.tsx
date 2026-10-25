'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Project, Node } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Modal,
  Input,
  useToast,
} from '@/components/ui';
import {
  FolderPlus,
  Search,
  Database,
  Server,
  Users,
  Terminal,
  Table as TableIcon,
  Archive,
  Trash2,
  Play,
  XCircle,
  Clock,
  ExternalLink,
  Shield,
  Layers,
  Cpu,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatusDot({ status }: { status: Project['status'] }) {
  const map = {
    running: 'bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.6)] animate-pulse',
    pending: 'bg-amber-400 animate-ping',
    failed: 'bg-red-400',
    archived: 'bg-slate-500',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[status] || 'bg-gray-400'}`} />;
}

export default function ProjectsPage() {
  const { apiUser } = useAppUser();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'pending' | 'failed' | 'archived'>('all');
  const { toast } = useToast();

  // Create Project Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [nodeId, setNodeId] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete Project Confirmation Modal State
  const [deleteModalProj, setDeleteModalProj] = useState<Project | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      api.projects.list(),
      api.nodes.list().catch(() => ({ nodes: [] })),
    ])
      .then(([projRes, nodeRes]) => {
        setProjects(projRes.projects || []);
        setNodes(nodeRes.nodes || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.projects.create({
        name: name.trim(),
        description: description.trim() || undefined,
        region: region || 'us-east-1',
      });
      toast(`Project Created: Project "${res.project.name}" provisioned successfully.`);
      setCreateModalOpen(false);
      setName('');
      setDescription('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteProject() {
    if (!deleteModalProj) return;
    if (confirmName.trim() !== deleteModalProj.name) {
      toast('Validation Error: Project name does not match confirmation input.', 'error');
      return;
    }
    setDeleting(true);
    try {
      await api.projects.delete(deleteModalProj.id);
      toast(`Project Deleted: Project "${deleteModalProj.name}" has been permanently removed.`);
      setDeleteModalProj(null);
      setConfirmName('');
      loadData();
    } catch (err: any) {
      toast(`Deletion Failed: ${err.message || 'Could not delete project.'}`, 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filteredProjects = (projects || []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.dbName?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title="Projects & Managed Databases Hub"
        description="Organize your workloads into isolated projects and manage dedicated PostgreSQL database containers with built-in REST APIs, visual schema tools, and user access controls."
        action={
          <Button
            variant="primary"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 shadow-lg shadow-md"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create Project</span>
          </Button>
        }
      />

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="uppercase tracking-wider text-[10px]">Total Projects</span>
            <Layers className="w-4 h-4 text-white" />
          </div>
          <p className="text-2xl font-black text-white">{projects?.length ?? 0}</p>
        </div>

        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="uppercase tracking-wider text-[10px]">Active Running</span>
            <Play className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {projects?.filter((p) => p.status === 'running').length ?? 0}
          </p>
        </div>

        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="uppercase tracking-wider text-[10px]">Managed Databases</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-cyan-300">
            {projects?.reduce((acc, p) => acc + (p.databases?.length || (p.dbName ? 1 : 0)), 0) ?? 0}
          </p>
        </div>

        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="uppercase tracking-wider text-[10px]">VPS Compute Nodes</span>
            <Server className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-300">{nodes.length || 1}</p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0b0c16] border border-white/10 rounded-2xl p-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-violet transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {(['all', 'running', 'pending', 'failed', 'archived'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                statusFilter === filter
                  ? 'bg-accent-violet/20 text-accent-violet-light border border-accent-violet/40 shadow-sm'
                  : 'text-text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {filter}
            </button>
          ))}

          <button
            onClick={loadData}
            title="Refresh Projects"
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/5 transition-all ml-2"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {projects === null && <Spinner label="Loading projects hub..." />}

      {projects !== null && filteredProjects.length === 0 && (
        <EmptyState
          message={
            search || statusFilter !== 'all'
              ? 'No projects matching filter criteria.'
              : 'No projects created yet. Click "Create Project" to launch your first database workload.'
          }
        />
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const dbCount = project.databases?.length || (project.dbName ? 1 : 0);
          const callerRole = project.callerRole || 'owner';

          return (
            <Card
              key={project.id}
              className="border border-white/10 bg-[#0b0c16] hover:border-accent-violet/40 hover:bg-white/[0.02] transition-all h-full space-y-5 flex flex-col justify-between group shadow-xl relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 via-indigo-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Database className="w-5 h-5 text-accent-violet-light" />
                    </div>
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-bold text-base text-white group-hover:text-accent-violet-light transition-colors line-clamp-1"
                      >
                        {project.name}
                      </Link>
                      {project.description ? (
                        <p className="text-xs text-text-muted line-clamp-1 mt-0.5">{project.description}</p>
                      ) : (
                        <p className="font-mono text-[11px] text-text-faint mt-0.5">{project.dbName}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusDot status={project.status} />
                    <span className="text-xs text-text-muted capitalize font-medium">{project.status}</span>
                  </div>
                </div>

                {/* Metadata Pill Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/40 p-3 rounded-xl border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-faint uppercase block">Node Compute</span>
                    <span className="text-text-primary font-semibold truncate block">
                      {project.node?.label || 'Local VPS'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-faint uppercase block">Databases</span>
                    <span className="text-cyan-400 font-semibold block">{dbCount} DB Engine{dbCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-faint uppercase block">Your Role</span>
                    <span className="text-emerald-400 font-semibold capitalize block">{callerRole}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-faint uppercase block">Created</span>
                    <span className="text-text-muted block">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="px-2 py-1 rounded bg-white/5 text-text-muted border border-white/5 flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    SQL Runner
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 text-text-muted border border-white/5 flex items-center gap-1">
                    <TableIcon className="w-3 h-3 text-cyan-400" />
                    Table Editor
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 text-text-muted border border-white/5 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-white" />
                    PgBouncer Pool
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <Link href={`/projects/${project.id}`}>
                  <Button variant="primary" size="sm" className="text-xs flex items-center gap-1.5">
                    <span>Open Hub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2"
                    onClick={() => {
                      setDeleteModalProj(project);
                      setConfirmName('');
                    }}
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* CREATE PROJECT MODAL */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Project"
        width="max-w-md"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <p className="text-xs text-text-muted">
            Projects hold your managed database clusters, schema definitions, and team member permissions.
          </p>

          <Input
            label="Project Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production E-Commerce"
            required
          />

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the workload..."
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-violet transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Target Compute Node (optional)</label>
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet"
            >
              <option value="">Auto-Select Optimal Worker Node</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label} ({n.ip})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={creating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        open={!!deleteModalProj}
        onClose={() => setDeleteModalProj(null)}
        title="Delete Project & Managed Databases"
        width="max-w-md"
      >
        {deleteModalProj && (
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 space-y-1">
              <p className="font-bold">⚠️ Warning: Irreversible Action</p>
              <p>
                Deleting <strong>{deleteModalProj.name}</strong> will terminate all associated PostgreSQL container engines, drop database tables, and revoke access for all members.
              </p>
            </div>

            <p className="text-xs text-text-muted">
              To confirm deletion, type <strong className="text-white font-mono">{deleteModalProj.name}</strong> below:
            </p>

            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deleteModalProj.name}
              className="font-mono text-xs"
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <Button variant="ghost" onClick={() => setDeleteModalProj(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteProject}
                loading={deleting}
                disabled={confirmName.trim() !== deleteModalProj.name}
              >
                Permanently Delete Project
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
