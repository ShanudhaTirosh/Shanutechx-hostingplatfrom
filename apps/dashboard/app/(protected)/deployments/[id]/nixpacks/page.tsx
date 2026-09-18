'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, Button, useToast, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function NixpacksPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  const { toast } = useToast();

  const [builder, setBuilder] = useState<'NIXPACKS' | 'RAILWAYPACK' | 'DOCKERFILE' | 'AUTO'>('AUTO');
  const [runtimeVersion, setRuntimeVersion] = useState('nodejs_20');
  const [rootDir, setRootDir] = useState('');
  const [watchPathsText, setWatchPathsText] = useState('');
  const [startCmd, setStartCmd] = useState('');
  const [installCmd, setInstallCmd] = useState('');
  const [buildCmd, setBuildCmd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadNixpacksData() {
    setLoading(true);
    try {
      const res = await api.get(`/deployments/${deploymentId}/nixpacks`);
      setRootDir(res.rootDir || '');
      setWatchPathsText((res.watchPaths || []).join('\n'));

      const cfg = res.nixpacksConfig || {};
      setBuilder(cfg.builder || 'AUTO');
      setRuntimeVersion(cfg.runtimeVersion || 'nodejs_20');

      const phases = cfg.phases || {};
      setInstallCmd((phases.install?.cmds || []).join('\n'));
      setBuildCmd((phases.build?.cmds || []).join('\n'));
      setStartCmd(phases.start?.cmd || '');
    } catch (err: any) {
      toast(err.message || 'Failed to load Nixpacks configuration', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNixpacksData();
  }, [deploymentId]);

  async function handleSaveNixpacks(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const watchPaths = watchPathsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const nixpacksConfig = {
        builder,
        runtimeVersion,
        phases: {
          install: installCmd ? { cmds: installCmd.split('\n').filter(Boolean) } : undefined,
          build: buildCmd ? { cmds: buildCmd.split('\n').filter(Boolean) } : undefined,
          start: startCmd ? { cmd: startCmd } : undefined,
        },
        watchPaths,
        rootDir: rootDir.trim() || null,
      };

      await api.put(`/deployments/${deploymentId}/nixpacks`, nixpacksConfig);
      toast('Build engine & workspace settings saved successfully!', 'success');
      await loadNixpacksData();
    } catch (err: any) {
      toast(err.message || 'Failed to save buildpack settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Build Engine & Workspace Hub"
          description="Configure automated multi-phase build engines, workspace subfolders, and path watch triggers."
        />
        <Button variant="secondary" size="sm" onClick={() => router.push(`/deployments/${deploymentId}`)} className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Deployment</span>
        </Button>
      </div>

      <form onSubmit={handleSaveNixpacks} className="space-y-6">
        {/* Builder Engine & Runtime Selection */}
        <Card title="Builder Engine & Runtime Version" description="Choose the automated build engine and pin exact runtime package versions.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Builder Engine</label>
              <select
                value={builder}
                onChange={(e) => setBuilder(e.target.value as any)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="AUTO">Auto Detect (Smart Buildpack / Dockerfile)</option>
                <option value="NIXPACKS">Smart Buildpack Engine</option>
                <option value="RAILWAYPACK">Container Build Engine</option>
                <option value="DOCKERFILE">Dockerfile Only</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Runtime Version Pin</label>
              <select
                value={runtimeVersion}
                onChange={(e) => setRuntimeVersion(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="nodejs_20">Node.js 20 LTS</option>
                <option value="nodejs_18">Node.js 18 LTS</option>
                <option value="python311">Python 3.11</option>
                <option value="python310">Python 3.10</option>
                <option value="go_121">Go 1.21</option>
                <option value="openjdk_17">Java OpenJDK 17</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Monorepo Settings */}
        <Card title="Monorepo Root Directory & Watch Paths" description="Scope builds to a subfolder and trigger redeploys only on matching file path changes.">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Root Directory Path</label>
              <input
                type="text"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                placeholder="e.g. apps/web or packages/backend"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Relative directory path from repository root containing the app source code.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Watch Paths (One per line)</label>
              <textarea
                rows={3}
                value={watchPathsText}
                onChange={(e) => setWatchPathsText(e.target.value)}
                placeholder="apps/web/**&#10;packages/shared/**"
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Only commits modifying files in these globs will trigger automatic Git push redeployments.
              </p>
            </div>
          </div>
        </Card>

        {/* Multi-Phase Override Commands */}
        <Card title="Multi-Phase Command Overrides" description="Override setup, install, build, and start commands for your custom build lifecycle.">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Install Phase Commands</label>
              <textarea
                rows={2}
                value={installCmd}
                onChange={(e) => setInstallCmd(e.target.value)}
                placeholder="npm ci"
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Build Phase Commands</label>
              <textarea
                rows={2}
                value={buildCmd}
                onChange={(e) => setBuildCmd(e.target.value)}
                placeholder="npm run build"
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">Start Command</label>
              <input
                type="text"
                value={startCmd}
                onChange={(e) => setStartCmd(e.target.value)}
                placeholder="npm run start"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save Build Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
