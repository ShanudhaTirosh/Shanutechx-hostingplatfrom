'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Play,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Table,
  Terminal,
  Database,
  Users,
  HardDrive,
  Cpu,
  Activity,
  Layers,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';
import { PageHeader, Card, Spinner, ErrorBanner, useToast } from '@/components/ui';
import {
  supabaseAdmin,
  SupabaseHealth,
  ClientSupabaseProject,
  getCentralStudioUrl,
  ProjectStats,
} from '@/lib/supabaseAdmin';
import { ServiceHealthBar } from '@/components/supabase/ServiceHealthBar';
import { ProjectSwitcher } from '@/components/supabase/ProjectSwitcher';

type StudioSubView =
  | 'overview'
  | 'editor'
  | 'sql'
  | 'database'
  | 'auth'
  | 'storage'
  | 'functions'
  | 'realtime'
  | 'settings'
  | 'api'
  | 'telemetry';

const SUBVIEW_PATHS: Record<StudioSubView, string> = {
  overview: '',
  editor: '/editor',
  sql: '/sql',
  database: '/database/tables',
  auth: '/auth/users',
  storage: '/storage/buckets',
  functions: '/functions',
  realtime: '/realtime/inspector',
  settings: '/settings/general',
  api: '/api',
  telemetry: '',
};

import { useSearchParams } from 'next/navigation';
import { useSupabaseProject } from '@/lib/SupabaseProjectContext';

export default function SupabaseOverviewPage() {
  const searchParams = useSearchParams();
  const { activeProject, setActiveProject } = useSupabaseProject();
  const viewParam = searchParams.get('view') as StudioSubView | null;
  const [health, setHealth] = useState<SupabaseHealth | null>(null);
  const [activeSubView, setActiveSubView] = useState<StudioSubView>('overview');

  useEffect(() => {
    if (viewParam && SUBVIEW_PATHS[viewParam] !== undefined) {
      setActiveSubView(viewParam);
    }
  }, [viewParam]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabaseAdmin.health()
      .then((h) => setHealth(h))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Fetch telemetry whenever active project changes
  useEffect(() => {
    if (activeProject && activeProject.status === 'ACTIVE') {
      supabaseAdmin.projects
        .getStats(activeProject.id)
        .then((res) => {
          if (res.ok && res.stats) setStats(res.stats);
        })
        .catch(() => {});
    } else {
      setStats(null);
    }
  }, [activeProject?.id, activeProject?.status]);

  const currentStudioUrl = activeProject
    ? getCentralStudioUrl(activeProject, SUBVIEW_PATHS[activeSubView])
    : getCentralStudioUrl(null);

  const handleCopyUrl = () => {
    if (!currentStudioUrl) return;
    navigator.clipboard.writeText(currentStudioUrl);
    setCopiedUrl(true);
    toast('Studio URL copied to clipboard', 'success');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleReloadFrame = () => {
    setIframeKey((prev) => prev + 1);
    toast('Reloading Supabase Studio frame...', 'info');
  };

  const handleStartProject = async () => {
    if (!activeProject) return;
    setActionLoading(true);
    try {
      const res = await supabaseAdmin.projects.start(activeProject.id);
      setActiveProject(res.project);
      toast(`Project "${activeProject.name}" started successfully!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to start project', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryProject = async () => {
    if (!activeProject) return;
    setActionLoading(true);
    try {
      const res = await supabaseAdmin.projects.retry(activeProject.id);
      setActiveProject(res.project);
      toast(`Retrying provisioning for "${activeProject.name}"...`, 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to retry provisioning', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Spinner label="Connecting to Supabase Platform Control Plane..." />;

  return (
    <div className={`space-y-4 animate-fade-in ${isFullScreen ? 'fixed inset-0 z-50 bg-[#0a0a0f] p-4 flex flex-col' : ''}`}>
      {!isFullScreen && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <PageHeader
              title="Supabase Cloud Studio"
              description="Unified multi-project control dashboard for PostgreSQL, GoTrue Auth, Realtime, S3 Storage, and Edge Functions."
            />

            {activeProject && (
              <div className="flex items-center gap-2">
                <a
                  href={currentStudioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all shrink-0"
                >
                  <span>Launch Studio in New Window</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {error && <ErrorBanner message={error} />}

          {/* Unified Multi-Project Switcher Bar */}
          <ProjectSwitcher activeProject={activeProject} onSelectProject={setActiveProject} />
        </>
      )}

      {/* Main Studio Frame Container */}
      <div className={`glass rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col ${isFullScreen ? 'flex-1' : 'shadow-2xl'}`}>
        {/* Studio Sub-Navigation & Frame Controller Bar */}
        <div className="bg-[#0b0c16] border-b border-white/[0.06] p-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Sub-view Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
            {[
              { id: 'overview', label: 'Studio Home', icon: <Layers className="w-3.5 h-3.5" /> },
              { id: 'editor', label: 'Table Editor', icon: <Table className="w-3.5 h-3.5" /> },
              { id: 'sql', label: 'SQL Editor', icon: <Terminal className="w-3.5 h-3.5" /> },
              { id: 'database', label: 'Database', icon: <Database className="w-3.5 h-3.5" /> },
              { id: 'auth', label: 'Authentication', icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'storage', label: 'Storage', icon: <HardDrive className="w-3.5 h-3.5" /> },
              { id: 'functions', label: 'Functions', icon: <Zap className="w-3.5 h-3.5" /> },
              { id: 'realtime', label: 'Realtime', icon: <Activity className="w-3.5 h-3.5" /> },
              { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
              { id: 'api', label: 'API Keys', icon: <Shield className="w-3.5 h-3.5" /> },
              { id: 'telemetry', label: 'Metrics', icon: <Cpu className="w-3.5 h-3.5" /> },
            ].map((tab) => {
              const isActive = activeSubView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubView(tab.id as StudioSubView)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={isActive ? 'text-emerald-400' : 'text-text-muted'}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Frame Utility Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Direct Studio URL badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-[11px] font-mono text-text-muted max-w-[280px] truncate">
              <span className="truncate">{currentStudioUrl}</span>
            </div>

            <button
              onClick={handleCopyUrl}
              title="Copy Studio URL"
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-primary border border-white/[0.06] transition-all"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleReloadFrame}
              title="Reload Frame"
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-primary border border-white/[0.06] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-primary border border-white/[0.06] transition-all"
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <a
              href={currentStudioUrl}
              target="_blank"
              rel="noreferrer"
              title="Open current view in new window"
              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Studio Content Body */}
        <div className={`relative w-full bg-[#05060a] ${isFullScreen ? 'flex-1' : 'h-[820px]'}`}>
          {/* Active Subview: Metrics & Telemetry Tab */}
          {activeSubView === 'telemetry' ? (
            <div className="p-6 space-y-6 overflow-y-auto h-full">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Compute &amp; Resource Telemetry ({activeProject?.name || 'Default'})</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Real-time CPU, RAM, Disk, and Database statistics reported directly from host node container agents.
                </p>
              </div>

              {/* Resource Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1">
                  <p className="text-[10px] uppercase font-mono text-text-muted">CPU Utilization</p>
                  <p className="text-xl font-bold font-mono text-emerald-400">{stats?.cpuPct ?? 0}%</p>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full transition-all" style={{ width: `${Math.min(stats?.cpuPct ?? 0, 100)}%` }} />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1">
                  <p className="text-[10px] uppercase font-mono text-text-muted">Memory Usage</p>
                  <p className="text-xl font-bold font-mono text-teal-300">{stats?.ramMb ?? 0} MB</p>
                  <p className="text-[10px] text-text-faint">Allocated Limit: 1024 MB</p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1">
                  <p className="text-[10px] uppercase font-mono text-text-muted">Disk Storage</p>
                  <p className="text-xl font-bold font-mono text-amber-300">{stats?.diskMb ?? 0} MB</p>
                  <p className="text-[10px] text-text-faint">Limit: {activeProject?.storageLimitMb ?? 10240} MB</p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1">
                  <p className="text-[10px] uppercase font-mono text-text-muted">Postgres DB Size</p>
                  <p className="text-xl font-bold font-mono text-violet-300">{stats?.dbSizeMb ?? 0} MB</p>
                  <p className="text-[10px] text-text-faint">Catalog: {activeProject?.dbName || 'postgres'}</p>
                </div>
              </div>

              {/* Service Health Pulse */}
              {health && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Service Container Pulse</h4>
                  <ServiceHealthBar services={health.services} />
                </div>
              )}
            </div>
          ) : !activeProject ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-text-primary">No Supabase Project Selected</h3>
              <p className="text-xs text-text-muted max-w-sm">
                Select an existing project using the project switcher above, or provision a new project stack on your VPS compute nodes.
              </p>
            </div>
          ) : activeProject.status === 'PROVISIONING' ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center animate-pulse">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-300">Project Provisioning In Progress</h3>
                <p className="text-xs text-text-muted mt-1 max-w-md">
                  Setting up isolated PostgreSQL, GoTrue Auth, PostgREST, Storage, Realtime, and Kong Gateway containers for{' '}
                  <span className="text-text-primary font-bold">{activeProject.name}</span>.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-text-faint bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                <Activity className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Auto-refreshing state every 8 seconds...</span>
              </div>
            </div>
          ) : activeProject.status === 'STOPPED' || activeProject.status === 'SUSPENDED' ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-500/10 border border-slate-500/20 text-slate-400 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-200">Project Stack is Stopped</h3>
                <p className="text-xs text-text-muted mt-1 max-w-sm">
                  The container stack for <span className="text-text-primary font-bold">{activeProject.name}</span> is paused to conserve VPS resources.
                </p>
              </div>
              <button
                onClick={handleStartProject}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Start Project Stack</span>
              </button>
            </div>
          ) : activeProject.status === 'FAILED' ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-300">Provisioning Encountered an Error</h3>
                <p className="text-xs text-red-400/80 mt-1 max-w-md font-mono bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                  {activeProject.errorMessage || 'Unknown provisioning failure'}
                </p>
              </div>
              <button
                onClick={handleRetryProject}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md shadow-violet-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Retry Provisioning</span>
              </button>
            </div>
          ) : (
            /* ACTIVE: Interactive Supabase Studio Iframe */
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={currentStudioUrl}
              title={`Supabase Studio - ${activeProject.name}`}
              className="w-full h-full border-0 bg-[#05060a]"
              allow="clipboard-read; clipboard-write; fullscreen"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            />
          )}
        </div>
      </div>
    </div>
  );
}
