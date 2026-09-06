'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

import { supabaseAdmin, ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { ProjectConfigModal } from './ProjectConfigModal';

interface ProjectSwitcherProps {
  activeProject: ClientSupabaseProject | null;
  onSelectProject: (proj: ClientSupabaseProject) => void;
}

export function ProjectSwitcher({ activeProject, onSelectProject }: ProjectSwitcherProps) {
  const [projects, setProjects] = useState<ClientSupabaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // New Project Form
  const [name, setName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = () => {
    supabaseAdmin.projects
      .list()
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0 && !activeProject) {
          onSelectProject(res.projects[0]);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
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
        setProjects((prev: ClientSupabaseProject[]) => [...prev, res.project]);
        onSelectProject(res.project);
      })
      .catch((err) => alert(err.message))
      .finally(() => setCreating(false));
  };

  return (
    <div className="flex items-center justify-between glass p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase font-semibold text-text-faint tracking-wider">Active Supabase BaaS Project</p>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Dev User Studio
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p: ClientSupabaseProject) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="bg-transparent text-sm font-bold text-text-primary focus:outline-none cursor-pointer"
            >
              {projects.map((p: ClientSupabaseProject) => (
                <option key={p.id} value={p.id} className="bg-[#0f111a] text-text-primary">
                  {p.name} ({p.clientEmail})
                </option>
              ))}
            </select>
            {activeProject && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                {activeProject.dbName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeProject && (
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>View & Copy Config</span>
          </button>
        )}

        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <span>+ New Client Project</span>
        </button>
      </div>

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
              <button
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
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

              <div className="pt-2 flex justify-end gap-2">
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
                  className="px-4 py-2 rounded-lg bg-accent-violet text-white text-xs font-medium hover:opacity-90 transition-all shadow-glow-violet"
                >
                  {creating ? 'Provisioning...' : 'Provision Supabase Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
