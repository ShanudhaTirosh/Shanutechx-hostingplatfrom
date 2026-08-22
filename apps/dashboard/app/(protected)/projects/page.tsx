'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Project } from '@/lib/types';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function StatusDot({ status }: { status: Project['status'] }) {
  const map = {
    running: 'bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.5)]',
    pending: 'bg-amber-400',
    failed: 'bg-red-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status]}`} />;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.projects
      .list()
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        description="Managed PostgreSQL databases with instant REST APIs, table editor and SQL runner."
      />

      {error && <ErrorBanner message={error} />}
      {projects === null && <Spinner label="Loading projects…" />}
      {projects?.length === 0 && (
        <EmptyState message="No projects yet. Contact support to provision one for you." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="block group">
            <Card className="border border-white/[0.06] hover:border-accent-violet/30 hover:bg-white/[0.05] transition-all h-full space-y-4 cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/[0.06] flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-accent-violet-light">
                      <ellipse cx="12" cy="5" rx="9" ry="3" />
                      <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
                      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-text-primary group-hover:text-white transition-colors">
                      {project.name}
                    </p>
                    <p className="font-mono text-[10px] text-text-faint mt-0.5">{project.dbName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status={project.status} />
                  <span className="text-xs text-text-muted capitalize">{project.status}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                {project.node && (
                  <div className="flex justify-between text-text-muted">
                    <span>Node</span>
                    <span className="font-mono text-text-primary">{project.node.label}</span>
                  </div>
                )}
                {project.apiPort && (
                  <div className="flex justify-between text-text-muted">
                    <span>API Port</span>
                    <span className="font-mono text-emerald-400">{project.apiPort}</span>
                  </div>
                )}
                <div className="flex justify-between text-text-muted">
                  <span>User</span>
                  <span className="font-mono text-text-primary">{project.dbUsername}</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Created</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/[0.05]">
                <span className="text-xs text-text-faint flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                  </svg>
                  SQL Runner
                </span>
                <span className="text-xs text-text-faint flex items-center gap-1 ml-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                  </svg>
                  Table Editor
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
