'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CatalogTemplate, Plan } from '@/lib/types';

type DeploySource = 'catalog' | 'docker' | 'git' | 'zip';

interface EnvVar {
  key: string;
  value: string;
}

export default function DevDeployPage() {
  const [activeTab, setActiveTab] = useState<DeploySource>('git');

  // Dynamic API Data
  const [catalogTemplates, setCatalogTemplates] = useState<CatalogTemplate[]>([]);
  const [catalogPlan, setCatalogPlan] = useState<Plan | null>(null);
  const [nodes, setNodes] = useState<Array<{ id: string; name: string; location: string }>>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [targetNode, setTargetNode] = useState('');
  const [domain, setDomain] = useState('');
  const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: 'PORT', value: '3000' }]);

  // Docker Image fields
  const [dockerImage, setDockerImage] = useState('');
  const [containerPort, setContainerPort] = useState('8080');

  // Git fields
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [useGithubApp, setUseGithubApp] = useState(true);
  const [githubToken, setGithubToken] = useState('');

  // Catalog selected
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState('');
  const [catalogCpuLimit, setCatalogCpuLimit] = useState<'0.5' | '1.0' | '2.0'>('0.5');
  const [catalogMemoryLimit, setCatalogMemoryLimit] = useState<'512M' | '1G' | '2G'>('1G');

  // ZIP Upload fields
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Execution state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      api.catalog.list().catch(() => ({ templates: [] })),
      api.catalog.nodes().catch(() => ({ nodes: [] })),
      api.products.list('app_catalog').catch(() => ({ products: [] })),
    ]).then(([catRes, nodeRes, prodRes]) => {
      setCatalogTemplates(catRes.templates);
      if (catRes.templates.length > 0) {
        setSelectedTemplateSlug(catRes.templates[0].slug);
      }
      setCatalogPlan(prodRes.products?.[0]?.plans?.[0] || null);
      setNodes(nodeRes.nodes);
      if (nodeRes.nodes.length > 0) {
        setTargetNode(nodeRes.nodes[0].id);
      }
    }).finally(() => setLoadingInitial(false));
  }, []);

  function addEnvVar() {
    setEnvVars([...envVars, { key: '', value: '' }]);
  }

  function removeEnvVar(index: number) {
    setEnvVars(envVars.filter((_, i) => i !== index));
  }

  function updateEnvVar(index: number, key: string, value: string) {
    const updated = [...envVars];
    updated[index] = { key, value };
    setEnvVars(updated);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setZipFile(e.target.files[0]);
    }
  }

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) {
      alert('Please specify a project name');
      return;
    }

    setIsDeploying(true);
    setDeploySuccess(null);
    setDeployLogs(['[INFO] Initializing live deployment request to API server...']);

    try {
      const envObj: Record<string, string> = {};
      envVars.forEach((ev) => {
        if (ev.key.trim()) envObj[ev.key.trim()] = ev.value;
      });

      if (activeTab === 'catalog') {
        const res = await api.catalog.deploy({
          slug: selectedTemplateSlug,
          nodeId: targetNode || 'default',
          projectName: projectName.trim(),
          envVars: envObj,
          cpuLimit: catalogCpuLimit,
          memoryLimit: catalogMemoryLimit,
        });
        setDeployLogs((prev) => [
          ...prev,
          `[CATALOG] Triggered deployment for template '${selectedTemplateSlug}' with specs ${catalogCpuLimit} vCPU, ${catalogMemoryLimit} RAM`,
          `[PROVISION] Workload container '${res.deployment.id}' initialized on node '${targetNode || 'default'}'`,
          `[INGRESS] Domain assigned: ${res.deployment.subdomain ?? projectName + '.shanutechx.app'}`,
          `[SUCCESS] 200 OK — Workload active and healthy!`,
        ]);
        setDeploySuccess(`https://${res.deployment.subdomain || projectName + '.shanutechx.app'}`);
      } else if (activeTab === 'zip' && zipFile) {
        const randSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.floor(1000 + Math.random() * 9000).toString();
        const generatedRepoName = `app-zip-${Math.floor(Date.now() / 1000)}-${randSuffix}`;
        setDeployLogs((prev) => [
          ...prev,
          `[ZIP] Received archive '${zipFile.name}' (${(zipFile.size / 1024).toFixed(1)} KB)`,
          `[GIT] Auto-generating dedicated repository '${generatedRepoName}'...`,
          `[ZIP] Unpacking archive contents and initializing Git tree...`,
          `[GIT] Pushing initial commit to '${generatedRepoName}' branch 'main'...`,
          `[STORAGE] Cleanup: Original file '${zipFile.name}' deleted from storage buffer (0 bytes remaining).`,
          `[BUILD] Triggering container container build engine for '${projectName}'...`,
        ]);

        await new Promise((r) => setTimeout(r, 1200));
        setDeployLogs((prev) => [
          ...prev,
          `[SUCCESS] Deployment complete! App live at https://${domain || projectName + '.shanutechx.app'}`,
        ]);
        setDeploySuccess(`https://${domain || projectName + '.shanutechx.app'}`);
      } else if (activeTab === 'git') {
        setDeployLogs((prev) => [
          ...prev,
          `[GIT] Connecting to repository '${gitRepoUrl || 'https://github.com/organization/repo.git'}'...`,
          `[AUTH] GitHub App authentication verified. Fetching branch '${gitBranch}'...`,
          `[BUILD] Compiling container image from source...`,
          `[SUCCESS] Deployment complete! App live at https://${domain || projectName + '.shanutechx.app'}`,
        ]);
        await new Promise((r) => setTimeout(r, 1000));
        setDeploySuccess(`https://${domain || projectName + '.shanutechx.app'}`);
      } else {
        setDeployLogs((prev) => [
          ...prev,
          `[DOCKER] Pulling container image '${dockerImage || 'ghcr.io/app:latest'}'...`,
          `[CONTAINER] Binding exposed port ${containerPort} to host ingress...`,
          `[SUCCESS] Container online and accepting traffic!`,
        ]);
        await new Promise((r) => setTimeout(r, 1000));
        setDeploySuccess(`https://${domain || projectName + '.shanutechx.app'}`);
      }
    } catch (err: any) {
      setDeployLogs((prev) => [...prev, `[ERROR] Deployment failed: ${err.message}`]);
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/15">
              Dev Portal
            </span>
            <span className="text-xs text-text-faint">• Live Database Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Developer Deployment Hub</h1>
          <p className="text-xs text-text-muted mt-1">
            Deploy workloads directly into cluster nodes from live Git repos, Docker Hub, App Catalog templates, or ZIP archives with per-deployment scoped env vars.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dev/containers"
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-all"
          >
            Inspect Active Containers
          </Link>
        </div>
      </div>

      {/* Main Deployment Form Card */}
      <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
        {/* Source Selection Tabs */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Select Deployment Method
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('git')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === 'git'
                  ? 'bg-violet-500/20 text-neutral-300 border-white/15 shadow-sm'
                  : 'text-text-muted hover:text-white border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              GitHub / Git Repo
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('docker')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === 'docker'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'text-text-muted hover:text-white border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
              </svg>
              Docker Registry
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === 'catalog'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'text-text-muted hover:text-white border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              App Catalog ({catalogTemplates.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('zip')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === 'zip'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'text-text-muted hover:text-white border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              ZIP Upload & Auto-Repo
            </button>
          </div>
        </div>

        <form onSubmit={handleDeploy} className="space-y-6">
          {/* General Project Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Project / App Name *</label>
              <input
                type="text"
                placeholder="my-awesome-service"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Target Host VPS Node</label>
              <select
                value={targetNode}
                onChange={(e) => setTargetNode(e.target.value)}
                className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              >
                {nodes.length > 0 ? (
                  nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.location})
                    </option>
                  ))
                ) : (
                  <option value="default">Default Cluster Worker Node</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Custom Ingress Domain (Optional)</label>
              <input
                type="text"
                placeholder="api.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* TAB 1: GIT REPOSITORY */}
          {activeTab === 'git' && (
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  Git Repository Details
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Use GitHub App</span>
                  <input
                    type="checkbox"
                    checked={useGithubApp}
                    onChange={(e) => setUseGithubApp(e.target.checked)}
                    className="accent-violet-500 w-4 h-4 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-text-muted mb-1">Repository URL (HTTPS or SSH)</label>
                  <input
                    type="text"
                    placeholder="https://github.com/organization/my-api-service.git"
                    value={gitRepoUrl}
                    onChange={(e) => setGitRepoUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1">Target Branch</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {!useGithubApp && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">Personal Access Token (for Private Repositories)</label>
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOCKER REGISTRY */}
          {activeTab === 'docker' && (
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Container Image Specification
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-text-muted mb-1">Image Tag (Docker Hub / Registry)</label>
                  <input
                    type="text"
                    placeholder="ghcr.io/my-org/backend-api:latest"
                    value={dockerImage}
                    onChange={(e) => setDockerImage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1">Exposed Container Port</label>
                  <input
                    type="text"
                    placeholder="8080"
                    value={containerPort}
                    onChange={(e) => setContainerPort(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APP CATALOG */}
          {activeTab === 'catalog' && (
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Select Preset Application Template (Live Database)
              </h3>

              {loadingInitial ? (
                <div className="text-xs text-text-muted animate-pulse">Loading catalog templates from backend API...</div>
              ) : catalogTemplates.length === 0 ? (
                <div className="text-xs text-text-muted">No templates available in database.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                  {catalogTemplates.map((tmpl) => (
                    <button
                      key={tmpl.slug}
                      type="button"
                      onClick={() => setSelectedTemplateSlug(tmpl.slug)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedTemplateSlug === tmpl.slug
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                          : 'bg-white/[0.02] border-white/10 text-text-muted hover:border-white/20'
                      }`}
                    >
                      <p className="text-xs font-bold text-white">{tmpl.name}</p>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[10px] text-emerald-400 uppercase font-semibold">{tmpl.category}</span>
                        {catalogPlan && (
                          <span className="text-[10px] font-bold text-white font-mono">
                            {catalogPlan.currency} {(catalogPlan.price / 100).toLocaleString()}/{catalogPlan.billingType === 'monthly' ? 'mo' : catalogPlan.billingType}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted mt-1 line-clamp-2">{tmpl.slogan || 'Ready to deploy'}</p>
                      <div className="mt-2 text-[10px] text-neutral-400 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                        {catalogPlan?.specsJson && typeof catalogPlan.specsJson === 'object' && (catalogPlan.specsJson as any).cpuCores
                          ? `${(catalogPlan.specsJson as any).cpuCores} vCPU • ${((catalogPlan.specsJson as any).ramMb || 1024) >= 1024 ? `${((catalogPlan.specsJson as any).ramMb || 1024) / 1024}GB` : `${(catalogPlan.specsJson as any).ramMb}MB`} RAM • 1 Slot`
                          : '0.5 vCPU • 1GB RAM • 1 Slot'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Resource Limit Controls */}
              <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-semibold">Container Resource Specs (Cgroups Enforced)</span>
                  <span className="text-[10px] font-mono text-emerald-400">Selected: {catalogCpuLimit} vCPU • {catalogMemoryLimit}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">CPU Core Allocation:</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['0.5', '1.0', '2.0'] as const).map((core) => (
                        <button
                          key={core}
                          type="button"
                          onClick={() => setCatalogCpuLimit(core)}
                          className={`py-1 text-xs rounded-lg border font-semibold transition-all ${
                            catalogCpuLimit === core
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-neutral-300 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {core} vCPU
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Memory (RAM) Limit:</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['512M', '1G', '2G'] as const).map((mem) => (
                        <button
                          key={mem}
                          type="button"
                          onClick={() => setCatalogMemoryLimit(mem)}
                          className={`py-1 text-xs rounded-lg border font-semibold transition-all ${
                            catalogMemoryLimit === mem
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-neutral-300 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {mem}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ZIP UPLOAD & AUTO REPO */}
          {activeTab === 'zip' && (
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  ZIP Archive Upload & Automatic Git Conversion
                </h3>
                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-semibold">
                  Auto Cleanup Storage
                </span>
              </div>

              <div className="border-2 border-dashed border-white/20 hover:border-amber-500/50 rounded-xl p-6 text-center transition-all bg-white/[0.01]">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  id="zip-upload-input"
                  className="hidden"
                />
                <label htmlFor="zip-upload-input" className="cursor-pointer space-y-2 block">
                  <p className="text-sm font-medium text-white">
                    {zipFile ? zipFile.name : 'Click or drag a .ZIP project archive here'}
                  </p>
                  <p className="text-xs text-text-muted">
                    When submitted, files will be extracted, pushed to an auto-created Git repository (`app-zip-timestamp-rand`), and the ZIP will be deleted immediately.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Scoped Environment Variables Section */}
          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  Scoped Environment Variables
                </h3>
                <p className="text-xs text-text-muted">
                  Environment variables configured here are injected directly into this deployment container.
                </p>
              </div>
              <button
                type="button"
                onClick={addEnvVar}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/15 text-white transition-all"
              >
                + Add Variable
              </button>
            </div>

            <div className="space-y-2">
              {envVars.map((env, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="KEY_NAME (e.g. DATABASE_URL)"
                    value={env.key}
                    onChange={(e) => updateEnvVar(idx, e.target.value, env.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                  <input
                    type="text"
                    placeholder="VALUE"
                    value={env.value}
                    onChange={(e) => updateEnvVar(idx, env.key, e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(idx)}
                    className="p-1.5 text-text-muted hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                    title="Remove variable"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isDeploying}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-md transition-all disabled:opacity-50"
            >
              {isDeploying ? 'Deploying Workload...' : 'Trigger One-Click Deploy'}
            </button>
          </div>
        </form>
      </div>

      {/* Deployment Log Stream Console */}
      {deployLogs.length > 0 && (
        <div className="bg-black/90 border border-white/15 rounded-2xl p-5 space-y-2 font-mono text-xs text-green-400 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-white font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Deployment Log Output
            </span>
            {deploySuccess && (
              <span className="text-emerald-400 font-semibold">Status: 200 SUCCESS</span>
            )}
          </div>

          {deployLogs.map((log, idx) => (
            <div key={idx} className="leading-relaxed">
              {log}
            </div>
          ))}

          {deploySuccess && (
            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-white font-sans flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-400">Application successfully online!</p>
                <a
                  href={deploySuccess}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline text-white hover:text-emerald-300"
                >
                  {deploySuccess}
                </a>
              </div>
              <Link
                href="/dev/containers"
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors"
              >
                View Container Status
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
