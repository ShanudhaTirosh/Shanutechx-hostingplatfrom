'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Spinner, useToast } from '@/components/ui';
import {
  GitBranch,
  UploadCloud,
  Layers,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Lock,
  Globe,
  Radio,
  Plus,
  Trash2,
  FileCode,
  Box,
} from 'lucide-react';

interface Props {
  deploymentId: string;
  initialDeployment: any;
  connectedAccounts?: Array<{ id: string; provider: 'github' | 'gitlab'; username: string }>;
  onComplete: () => void;
}

const TEMPLATE_PRESETS = [
  { id: 'node-express', name: 'Node.js / Express API', icon: FileCode, framework: 'Node.js', startCmd: 'npm start', port: 3000, exposure: 'ssl_with_proxy' },
  { id: 'nextjs', name: 'Next.js App Router', icon: Box, framework: 'Next.js', startCmd: 'npm run start', port: 3000, exposure: 'ssl_with_proxy' },
  { id: 'python-fastapi', name: 'Python FastAPI App', icon: Terminal, framework: 'Python', startCmd: 'uvicorn main:app --host 0.0.0.0 --port 8000', port: 8000, exposure: 'ssl_with_proxy' },
  { id: 'static-html', name: 'Static HTML / Web Hosting', icon: Globe, framework: 'Static', startCmd: 'npx serve -s . -p 8080', port: 8080, exposure: 'ssl_with_proxy' },
  { id: 'discord-bot', name: 'Discord Bot Daemon', icon: Radio, framework: 'Node.js', startCmd: 'node index.js', port: 3000, exposure: 'internal_only' },
  { id: 'whatsapp-bot', name: 'WhatsApp Messaging Bot', icon: Radio, framework: 'Node.js', startCmd: 'npm start', port: 3000, exposure: 'internal_only' },
];

export function DeploymentSetupWizard({ deploymentId, initialDeployment, connectedAccounts = [], onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [sourceType, setSourceType] = useState<'git' | 'zip' | 'template'>('git');
  
  // Step 1 State
  const [repoUrl, setRepoUrl] = useState(initialDeployment?.repoUrl || '');
  const [branch, setBranch] = useState(initialDeployment?.branch || 'main');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('node-express');
  const [uploadingZip, setUploadingZip] = useState(false);

  // Step 2 State
  const [frameworkPreset, setFrameworkPreset] = useState(initialDeployment?.frameworkPreset || 'Node.js');
  const [startCommand, setStartCommand] = useState(initialDeployment?.startCommand || 'npm start');
  const [internalPort, setInternalPort] = useState<number>(initialDeployment?.internalPort || 3000);
  const [exposureMode, setExposureMode] = useState<'ssl_with_proxy' | 'raw_tcp' | 'internal_only'>(
    initialDeployment?.exposureMode || 'ssl_with_proxy'
  );
  const [subdomain, setSubdomain] = useState(initialDeployment?.subdomain || `app-${deploymentId.slice(0, 8)}`);

  // Step 3 State
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([
    { key: 'NODE_ENV', value: 'production' },
    { key: 'PORT', value: String(internalPort) },
  ]);

  // Step 4 Deploying State
  const [deploying, setDeploying] = useState(false);
  const { toast } = useToast();

  function handleSelectTemplate(tplId: string) {
    setSelectedTemplate(tplId);
    const found = TEMPLATE_PRESETS.find((t) => t.id === tplId);
    if (found) {
      setFrameworkPreset(found.framework);
      setStartCommand(found.startCmd);
      setInternalPort(found.port);
      setExposureMode(found.exposure as any);
      setEnvVars((prev) => prev.map((e) => (e.key === 'PORT' ? { ...e, value: String(found.port) } : e)));
    }
  }

  function addEnvVar() {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
  }

  function updateEnvVar(index: number, key: string, value: string) {
    setEnvVars((prev) => prev.map((item, i) => (i === index ? { key, value } : item)));
  }

  function removeEnvVar(index: number) {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleZipUpload() {
    if (!zipFile) return null;
    setUploadingZip(true);
    try {
      const arrayBuffer = await zipFile.arrayBuffer();
      const base64Content = Buffer.from(arrayBuffer).toString('base64');
      await api.fs.uploadBinary(deploymentId, zipFile.name, base64Content);
      await api.fs.extractArchive(deploymentId, zipFile.name);
      toast(`Successfully uploaded and extracted ${zipFile.name}!`, 'success');
      return `upload://${zipFile.name}`;
    } catch (err: any) {
      toast(err.message || 'Failed to upload ZIP archive', 'error');
      return null;
    } finally {
      setUploadingZip(false);
    }
  }

  async function handleFinalDeploy() {
    setDeploying(true);
    try {
      let finalRepoUrl = repoUrl;

      if (sourceType === 'zip') {
        if (zipFile) {
          const uploadedUrl = await handleZipUpload();
          if (uploadedUrl) finalRepoUrl = uploadedUrl;
        } else if (!initialDeployment?.repoUrl) {
          finalRepoUrl = `upload://workspace-${deploymentId}.zip`;
        }
      } else if (sourceType === 'template') {
        finalRepoUrl = `template://${selectedTemplate}`;
      }

      // Convert envVars array to object
      const envObj: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key.trim()) envObj[key.trim()] = value;
      });

      // Update deployment config & trigger build
      await api.deployments.updateConfig(deploymentId, {
        repoUrl: finalRepoUrl || `upload://workspace-${deploymentId}.zip`,
        branch,
        frameworkPreset,
        startCommand,
        internalPort,
        exposureMode,
        subdomain: exposureMode === 'ssl_with_proxy' ? subdomain : undefined,
        envVars: envObj,
      });

      await api.deployments.redeploy(deploymentId);
      toast('Deployment configured & build initiated successfully!', 'success');
      onComplete();
    } catch (err: any) {
      toast(err.message || 'Failed to configure deployment', 'error');
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-violet/10 border border-accent-violet/20 text-accent-violet text-xs font-mono">
          <Sparkles className="h-3.5 w-3.5" /> Instance Slot Configuration Wizard
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Configure & Launch Your Purchased Instance</h1>
        <p className="text-sm text-text-muted max-w-xl mx-auto">
          Complete the step-by-step wizard below to connect your code, set runtime options, configure environment variables, and launch your instance container.
        </p>
      </div>

      {/* Wizard Progress Bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: 1, title: '1. Code Source' },
          { num: 2, title: '2. Runtime & Network' },
          { num: 3, title: '3. Environment Vars' },
          { num: 4, title: '4. Launch Instance' },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              onClick={() => { if (isDone) setStep(s.num as any); }}
              className={`p-3 rounded-xl border font-mono text-xs text-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent-violet/20 border-accent-violet text-white font-semibold shadow-lg shadow-accent-violet/10'
                  : isDone
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-black/20 border-white/[0.06] text-text-faint'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : null}
                <span>{s.title}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Code Source */}
      {step === 1 && (
        <Card className="p-6 space-y-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-accent-cyan" /> Step 1: Select Code Source
          </h3>

          {/* Source Type Selector */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'git', title: 'Git Repository', desc: 'Connect GitHub/GitLab or public Git URL', icon: GitBranch },
              { id: 'zip', title: 'ZIP Archive Upload', desc: 'Upload project zip file from local computer', icon: UploadCloud },
              { id: 'template', title: 'App Catalog Template', desc: 'Deploy 1-click pre-configured stack template', icon: Layers },
            ].map((t) => {
              const isSel = sourceType === t.id;
              const Icon = t.icon;
              return (
                <div
                  key={t.id}
                  onClick={() => setSourceType(t.id as any)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSel
                      ? 'bg-white/[0.08] border-accent-cyan text-white shadow-md'
                      : 'bg-black/30 border-white/[0.06] text-text-muted hover:border-white/20'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${isSel ? 'text-accent-cyan' : 'text-text-muted'}`} />
                  <h4 className="font-semibold text-sm">{t.title}</h4>
                  <p className="text-xs text-text-faint">{t.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Git Source Options */}
          {sourceType === 'git' && (
            <div className="space-y-4 pt-4 border-t border-white/[0.06]">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Git Repository URL</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo-name.git"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              {connectedAccounts.length > 0 && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs text-text-muted">
                  <span>Connected Git Account:</span>
                  <span className="font-mono text-accent-cyan">@{connectedAccounts[0].username} ({connectedAccounts[0].provider})</span>
                </div>
              )}
            </div>
          )}

          {/* ZIP Source Options */}
          {sourceType === 'zip' && (
            <div className="space-y-4 pt-4 border-t border-white/[0.06]">
              <label className="text-xs font-medium text-text-muted block mb-1.5">Upload Project ZIP Archive</label>
              <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center bg-black/30 hover:border-accent-cyan transition-all space-y-3">
                <UploadCloud className="h-10 w-10 text-accent-cyan mx-auto opacity-80" />
                <div className="space-y-1">
                  <p className="text-sm text-white font-medium">Drag & drop your project ZIP file here</p>
                  <p className="text-xs text-text-muted">Supports .zip archives containing root package.json or app entrypoint</p>
                </div>
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="zip-wizard-upload"
                />
                <label
                  htmlFor="zip-wizard-upload"
                  className="inline-block px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono text-white cursor-pointer transition-all"
                >
                  {zipFile ? `Selected: ${zipFile.name}` : 'Browse Computer'}
                </label>
              </div>
            </div>
          )}

          {/* Template Source Options */}
          {sourceType === 'template' && (
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06]">
              {TEMPLATE_PRESETS.map((tpl) => {
                const isSel = selectedTemplate === tpl.id;
                const Icon = tpl.icon;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      isSel
                        ? 'bg-accent-violet/20 border-accent-violet text-white font-semibold'
                        : 'bg-black/30 border-white/[0.06] text-text-muted hover:border-white/20'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSel ? 'text-accent-violet' : 'text-text-muted'}`} />
                    <div>
                      <h4 className="text-xs font-semibold text-white">{tpl.name}</h4>
                      <p className="text-[10px] font-mono text-text-faint">{tpl.startCmd}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button size="sm" onClick={() => setStep(2)}>
              Next: Runtime Setup <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Runtime & Network */}
      {step === 2 && (
        <Card className="p-6 space-y-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-accent-violet" /> Step 2: Runtime & Network Exposure
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">Framework / Language Preset</label>
              <select
                value={frameworkPreset}
                onChange={(e) => setFrameworkPreset(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent-violet"
              >
                <option value="Node.js">Node.js / Express / Next.js</option>
                <option value="Python">Python (FastAPI, Flask, Django)</option>
                <option value="Static">Static Web Hosting (HTML/CSS/JS)</option>
                <option value="Dockerfile">Custom Dockerfile</option>
                <option value="Go">Go Web Service</option>
                <option value="Rust">Rust App</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">Internal Container Port</label>
              <input
                type="number"
                value={internalPort}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setInternalPort(p);
                  setEnvVars((prev) => prev.map((item) => (item.key === 'PORT' ? { ...item, value: String(p) } : item)));
                }}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Start Command</label>
            <input
              type="text"
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
              placeholder="npm start"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
            />
          </div>

          {/* Network Exposure Mode */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-text-muted block">Network Exposure Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'ssl_with_proxy', title: 'HTTPS Subdomain', desc: 'Expose with automatic SSL & domain routing', icon: Globe },
                { id: 'raw_tcp', title: 'Direct TCP Port', desc: 'Direct container port mapping (Databases, Games)', icon: Radio },
                { id: 'internal_only', title: 'Private / Bot Mode', desc: 'Internal service only (Discord / WhatsApp Bots)', icon: Lock },
              ].map((m) => {
                const isSel = exposureMode === m.id;
                const Icon = m.icon;
                return (
                  <div
                    key={m.id}
                    onClick={() => setExposureMode(m.id as any)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSel
                        ? 'bg-accent-violet/20 border-accent-violet text-white font-semibold'
                        : 'bg-black/30 border-white/[0.06] text-text-muted hover:border-white/20'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSel ? 'text-accent-violet' : 'text-text-muted'}`} />
                    <h4 className="text-xs font-semibold">{m.title}</h4>
                    <p className="text-[10px] text-text-faint">{m.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {exposureMode === 'ssl_with_proxy' && (
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">Subdomain</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
                />
                <span className="text-xs font-mono text-text-muted">.shanutechx.app</span>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button size="sm" variant="secondary" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <Button size="sm" onClick={() => setStep(3)}>
              Next: Environment Vars <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Environment Variables */}
      {step === 3 && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" /> Step 3: Environment Variables & Vault Secrets
            </h3>
            <Button size="sm" variant="secondary" onClick={addEnvVar}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Key
            </Button>
          </div>

          <p className="text-xs text-text-muted">
            Environment variables are encrypted with AES-256-GCM vault security and injected at build & container launch time.
          </p>

          <div className="space-y-3">
            {envVars.map((env, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={env.key}
                  onChange={(e) => updateEnvVar(i, e.target.value, env.value)}
                  placeholder="KEY_NAME"
                  className="w-1/3 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan uppercase"
                />
                <input
                  type="text"
                  value={env.value}
                  onChange={(e) => updateEnvVar(i, env.key, e.target.value)}
                  placeholder="value"
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
                <button
                  type="button"
                  onClick={() => removeEnvVar(i)}
                  className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <Button size="sm" variant="secondary" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <Button size="sm" onClick={() => setStep(4)}>
              Review & Launch <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Review & Deploy */}
      {step === 4 && (
        <Card className="p-6 space-y-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Step 4: Final Instance Review
          </h3>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-black/40 border border-white/[0.06] text-xs font-mono space-y-2">
            <div>
              <span className="text-text-muted">Instance ID:</span> <span className="text-white">{deploymentId}</span>
            </div>
            <div>
              <span className="text-text-muted">Code Source:</span> <span className="text-accent-cyan">{sourceType.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-text-muted">Runtime:</span> <span className="text-white">{frameworkPreset}</span>
            </div>
            <div>
              <span className="text-text-muted">Start Cmd:</span> <span className="text-white">{startCommand}</span>
            </div>
            <div>
              <span className="text-text-muted">Port:</span> <span className="text-white">{internalPort}</span>
            </div>
            <div>
              <span className="text-text-muted">Exposure Mode:</span> <span className="text-emerald-400">{exposureMode}</span>
            </div>
            {exposureMode === 'ssl_with_proxy' && (
              <div className="col-span-2">
                <span className="text-text-muted">Assigned Domain:</span> <span className="text-accent-violet">https://{subdomain}.shanutechx.app</span>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <Button size="sm" variant="secondary" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <Button size="sm" onClick={handleFinalDeploy} loading={deploying}>
              {deploying ? 'Deploying Container...' : <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> 🚀 Launch Deployment Instance</span>}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
