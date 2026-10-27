'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Play, Square, RotateCcw, RefreshCw, Trash2, Plus, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { supabaseAdmin, ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { ProjectConfigModal } from './ProjectConfigModal';
import { useToast } from '@/components/ui';

interface ProjectSwitcherProps {
  activeProject: ClientSupabaseProject | null;
  onSelectProject: (proj: ClientSupabaseProject | null) => void;
}

type LifecycleAction = 'start' | 'stop' | 'restart' | 'retry' | 'delete';

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  ACTIVE:       { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  PROVISIONING: { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30',   dot: 'bg-amber-400 animate-pulse' },
  STOPPED:      { bg: 'bg-slate-500/20',   text: 'text-slate-300',   border: 'border-slate-500/30',   dot: 'bg-slate-400' },
  FAILED:       { bg: 'bg-red-500/20',     text: 'text-red-300',     border: 'border-red-500/30',     dot: 'bg-red-400 animate-pulse' },
  SUSPENDED:    { bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/30',  dot: 'bg-orange-400' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.ACTIVE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${s.bg} ${s.text} border ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {status}
    </span>
  );
}

export function ProjectSwitcher({ activeProject, onSelectProject }: ProjectSwitcherProps) {
  const [projects, setProjects] = useState<ClientSupabaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  // Track which specific "projectId:action" is in-flight, not just the project ID
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ClientSupabaseProject | null>(null);

  // New Project Form
  const [name, setName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const { toast } = useToast();

  // Use refs to avoid stale closures in the poll interval without re-creating the effect
  const activeProjectRef = useRef(activeProject);
  const onSelectProjectRef = useRef(onSelectProject);
  activeProjectRef.current = activeProject;
  onSelectProjectRef.current = onSelectProject;

  // Stable fetch — does not depend on activeProject/onSelectProject directly to avoid
  // infinite re-creation cycles. Uses refs instead.
  const fetchProjects = () => {
    return supabaseAdmin.projects
      .list()
      .then((res) => {
        setProjects(res.projects);
        const currentActive = activeProjectRef.current;
        if (!currentActive && res.projects.length > 0) {
          onSelectProjectRef.current(res.projects[0]);
        } else if (currentActive) {
          // Refresh the active project record so status/ports are up-to-date
          const refreshed = res.projects.find((p) => p.id === currentActive.id);
          if (refreshed) onSelectProjectRef.current(refreshed);
        }
      });
  };

  // Single mount effect — loads data once, then polls every 8 s only while PROVISIONING
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const load = () => {
      fetchProjects()
        .catch((err) => toast(err.message, 'error'))
        .finally(() => setLoading(false));
    };

    load();

    // Start/stop poll based on whether any project is PROVISIONING
    const setupPoll = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        setProjects((current) => {
          if (current.some((p) => p.status === 'PROVISIONING')) {
            fetchProjects().catch(() => {});
          }
          return current; // don't change state here; fetchProjects calls setProjects internally
        });
      }, 8000);
    };

    setupPoll();

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !clientEmail) return;
    setCreating(true);
    supabaseAdmin.projects
      .create({ name, clientEmail })
      .then((res) => {
        setName('');
        setClientEmail('');
        setShowModal(false);
        setProjects((prev) => [res.project, ...prev]);
        onSelectProject(res.project);
        toast(`Project "${res.project.name}" provisioning started`, 'success');
      })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setCreating(false));
  };

  const handleLifecycleAction = async (project: ClientSupabaseProject, action: LifecycleAction) => {
    if (action === 'delete') {
      setConfirmDelete(project);
      return;
    }

    // Key format: "projectId::action" — double colon prevents prefix collision
    const key = `${project.id}::${action}`;
    setActionLoading(key);
    try {
      let updated: ClientSupabaseProject;
      if (action === 'start') {
        const res = await supabaseAdmin.projects.start(project.id);
        updated = res.project;
        toast(`Project "${project.name}" started`, 'success');
      } else if (action === 'stop') {
        const res = await supabaseAdmin.projects.stop(project.id);
        updated = res.project;
        toast(`Project "${project.name}" stopped`, 'success');
      } else if (action === 'restart') {
        const res = await supabaseAdmin.projects.restart(project.id);
        updated = res.project;
        toast(`Project "${project.name}" restarted`, 'success');
      } else {
        // retry
        const res = await supabaseAdmin.projects.retry(project.id);
        updated = res.project;
        toast(`Retrying provisioning for "${project.name}"`, 'success');
      }
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (activeProject?.id === updated.id) onSelectProject(updated);
    } catch (err: any) {
      toast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    const key = `${target.id}::delete`;
    setActionLoading(key);
    try {
      await supabaseAdmin.projects.delete(target.id);
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== target.id);
        if (activeProject?.id === target.id) {
          // Select the first remaining project, or null if empty
          onSelectProjectRef.current(remaining[0] ?? null);
        }
        return remaining;
      });
      toast(`Project "${target.name}" deleted`, 'success');
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Exact key-match — no prefix collision possible with double-colon separator
  const isActing = (id: string, action?: LifecycleAction) => {
    if (!actionLoading) return false;
    if (action) return actionLoading === `${id}::${action}`;
    return actionLoading.startsWith(`${id}::`);
  };

  return (
    <>
      <div className="glass rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between p-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-text-faint tracking-wider">Supabase Project</p>
              {loading ? (
                <p className="text-xs text-text-muted">Loading projects...</p>
              ) : projects.length === 0 ? (
                <p className="text-xs text-text-muted italic">No projects yet</p>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <select
                    value={activeProject?.id || ''}
                    onChange={(e) => {
                      const found = projects.find((p) => p.id === e.target.value);
                      if (found) onSelectProject(found);
                    }}
                    className="bg-transparent text-sm font-bold text-text-primary focus:outline-none cursor-pointer max-w-[220px]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0f111a] text-text-primary">
                        {p.name} — {p.clientEmail}
                      </option>
                    ))}
                  </select>
                  {activeProject && <StatusBadge status={activeProject.status} />}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Open Studio URL — only when ACTIVE and we have a real URL */}
            {activeProject?.studioUrl && activeProject.status === 'ACTIVE' && (
              <a
                href={activeProject.studioUrl}
                target="_blank"
                rel="noreferrer"
                title="Open Supabase Studio"
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Lifecycle controls for active project */}
            {activeProject && (
              <>
                {(activeProject.status === 'STOPPED' || activeProject.status === 'SUSPENDED') && (
                  <button
                    onClick={() => handleLifecycleAction(activeProject, 'start')}
                    disabled={isActing(activeProject.id)}
                    title="Start project"
                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {isActing(activeProject.id, 'start')
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Play className="w-3.5 h-3.5" />}
                  </button>
                )}
                {activeProject.status === 'ACTIVE' && (
                  <>
                    <button
                      onClick={() => handleLifecycleAction(activeProject, 'restart')}
                      disabled={isActing(activeProject.id)}
                      title="Restart project"
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all disabled:opacity-50"
                    >
                      {isActing(activeProject.id, 'restart')
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleLifecycleAction(activeProject, 'stop')}
                      disabled={isActing(activeProject.id)}
                      title="Stop project"
                      className="p-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 transition-all disabled:opacity-50"
                    >
                      {isActing(activeProject.id, 'stop')
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Square className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
                {activeProject.status === 'FAILED' && (
                  <button
                    onClick={() => handleLifecycleAction(activeProject, 'retry')}
                    disabled={isActing(activeProject.id)}
                    title="Retry provisioning"
                    className="p-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 transition-all disabled:opacity-50"
                  >
                    {isActing(activeProject.id, 'retry')
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                )}

                {/* Config / keys modal */}
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">Config</span>
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleLifecycleAction(activeProject, 'delete')}
                  disabled={isActing(activeProject.id)}
                  title="Delete project"
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-50"
                >
                  {isActing(activeProject.id, 'delete')
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </>
            )}

            {/* New project */}
            <button
              onClick={() => setShowModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          </div>
        </div>

        {/* FAILED error detail strip */}
        {activeProject?.status === 'FAILED' && activeProject.errorMessage && (
          <div className="px-3 py-2 bg-red-500/5 border-t border-red-500/20 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-snug font-mono">{activeProject.errorMessage}</p>
          </div>
        )}

        {/* Compact info strip when ACTIVE */}
        {activeProject && activeProject.status === 'ACTIVE' && (
          <div className="px-3 py-2 bg-black/20 border-t border-white/[0.03] flex items-center gap-4 overflow-x-auto">
            <span className="text-[10px] text-text-faint font-mono whitespace-nowrap">
              DB: <span className="text-text-muted">{activeProject.dbName}</span>
            </span>
            {activeProject.nodeLabel && (
              <span className="text-[10px] text-text-faint font-mono whitespace-nowrap">
                Node: <span className="text-text-muted">{activeProject.nodeLabel}</span>
              </span>
            )}
            {activeProject.apiPort && (
              <span className="text-[10px] text-text-faint font-mono whitespace-nowrap">
                API: <span className="text-text-muted">:{activeProject.apiPort}</span>
              </span>
            )}
            {activeProject.studioPort && (
              <span className="text-[10px] text-text-faint font-mono whitespace-nowrap">
                Studio: <span className="text-text-muted">:{activeProject.studioPort}</span>
              </span>
            )}
            {activeProject.region && (
              <span className="text-[10px] text-text-faint font-mono whitespace-nowrap">
                Region: <span className="text-text-muted">{activeProject.region}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ProjectConfigModal */}
      <ProjectConfigModal
        project={activeProject}
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
          <div className="glass rounded-2xl p-6 border border-white/[0.1] max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="font-semibold text-sm text-text-primary">Create Supabase Client Project</h3>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase text-text-faint block mb-1">Project / App Name</label>
                <input
                  type="text"
                  placeholder="e.g. Client Mobile App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-text-faint block mb-1">Client / Owner Email</label>
                <input
                  type="email"
                  placeholder="e.g. client@company.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
                  required
                />
              </div>

              <p className="text-[10px] text-text-faint">
                A full 8-container Supabase stack (DB, Auth, PostgREST, Storage, Realtime, Kong, Meta, Studio) will be auto-provisioned on the optimal VPS node.
              </p>

              <div className="pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/[0.06] text-text-muted text-xs font-medium hover:bg-white/[0.1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-accent-violet text-white text-xs font-medium hover:opacity-90 transition-all shadow-glow-violet flex items-center gap-1.5"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {creating ? 'Provisioning...' : 'Provision Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="glass rounded-2xl p-6 border border-red-500/30 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary">Delete Project?</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  This will permanently remove <span className="text-red-300 font-bold">{confirmDelete.name}</span> and all its containers.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg bg-white/[0.06] text-text-muted text-xs font-medium hover:bg-white/[0.1]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-all"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
