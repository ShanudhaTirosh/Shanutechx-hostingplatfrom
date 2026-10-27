'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabaseAdmin, ClientSupabaseProject } from '@/lib/supabaseAdmin';

const ACTIVE_PROJECT_STORAGE_KEY = 'shanutechx_active_supabase_project_id';

interface SupabaseProjectContextType {
  projects: ClientSupabaseProject[];
  activeProject: ClientSupabaseProject | null;
  setActiveProject: (project: ClientSupabaseProject | null) => void;
  loading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
}

const SupabaseProjectContext = createContext<SupabaseProjectContextType>({
  projects: [],
  activeProject: null,
  setActiveProject: () => {},
  loading: true,
  error: null,
  refreshProjects: async () => {},
});

export function SupabaseProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ClientSupabaseProject[]>([]);
  const [activeProject, setActiveProjectState] = useState<ClientSupabaseProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeProjectRef = useRef<ClientSupabaseProject | null>(null);
  activeProjectRef.current = activeProject;

  const setActiveProject = useCallback((project: ClientSupabaseProject | null) => {
    setActiveProjectState(project);
    if (typeof window !== 'undefined') {
      try {
        if (project?.id) {
          localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, project.id);
        } else {
          localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
        }
      } catch {}
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await supabaseAdmin.projects.list();
      const list = res.projects || [];
      setProjects(list);
      setError(null);

      const savedId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) : null;
      const currentActive = activeProjectRef.current;

      if (currentActive) {
        const updated = list.find((p) => p.id === currentActive.id);
        if (updated) {
          setActiveProjectState(updated);
        } else if (list.length > 0) {
          setActiveProject(list[0]);
        } else {
          setActiveProject(null);
        }
      } else if (savedId) {
        const found = list.find((p) => p.id === savedId);
        if (found) {
          setActiveProjectState(found);
        } else if (list.length > 0) {
          setActiveProject(list[0]);
        }
      } else if (list.length > 0) {
        setActiveProject(list[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed loading Supabase projects');
    } finally {
      setLoading(false);
    }
  }, [setActiveProject]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Background polling if any project is in PROVISIONING state
  useEffect(() => {
    const hasProvisioning = projects.some((p) => p.status === 'PROVISIONING');
    if (!hasProvisioning) return;

    const timer = setInterval(() => {
      refreshProjects().catch(() => {});
    }, 6000);

    return () => clearInterval(timer);
  }, [projects, refreshProjects]);

  return (
    <SupabaseProjectContext.Provider
      value={{
        projects,
        activeProject,
        setActiveProject,
        loading,
        error,
        refreshProjects,
      }}
    >
      {children}
    </SupabaseProjectContext.Provider>
  );
}

export function useSupabaseProject() {
  const ctx = useContext(SupabaseProjectContext);
  if (!ctx) {
    throw new Error('useSupabaseProject must be used within a SupabaseProjectProvider');
  }
  return ctx;
}
