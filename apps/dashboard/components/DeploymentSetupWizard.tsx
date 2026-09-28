'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, useToast } from '@/components/ui';
import { GitBranch, Layers, Terminal, Lock, Globe, Radio, Plus, Trash2, FileCode, Box, Zap, ChevronDown } from 'lucide-react';

import { useAppUser } from '@/lib/AppUserContext';

interface Props {
  deploymentId: string;
  initialDeployment: any;
  connectedAccounts?: Array<{ id: string; provider: 'github' | 'gitlab'; username: string }>;
  onComplete: () => void;
}

const TEMPLATE_PRESETS = [
  { id: 'node-express', name: 'Node.js / Express', icon: FileCode, framework: 'Node.js', startCmd: 'npm start', port: 3000, exposure: 'ssl_with_proxy' },
  { id: 'nextjs', name: 'Next.js', icon: Box, framework: 'Next.js', startCmd: 'npm run start', port: 3000, exposure: 'ssl_with_proxy' },
  { id: 'python-fastapi', name: 'Python / FastAPI', icon: Terminal, framework: 'Python', startCmd: 'uvicorn main:app --host 0.0.0.0 --port 8000', port: 8000, exposure: 'ssl_with_proxy' },
  { id: 'static-html', name: 'Static site', icon: Globe, framework: 'Static', startCmd: 'npx serve -s . -p 8080', port: 8080, exposure: 'ssl_with_proxy' },
  { id: 'discord-bot', name: 'Discord bot', icon: Radio, framework: 'Node.js', startCmd: 'node index.js', port: 3000, exposure: 'ssl_with_proxy' },
  { id: 'whatsapp-bot', name: 'WhatsApp bot', icon: Radio, framework: 'Node.js', startCmd: 'npm start', port: 3000, exposure: 'ssl_with_proxy' },
];

/**
 * One page, top to bottom: pick a source, confirm the settings we filled in for you, deploy. Advanced settings
 * (network exposure, custom subdomain) and environment variables are collapsed by default -- most deployments never
 * need to touch them, so they shouldn't be mandatory steps in the way.
 */
export function DeploymentSetupWizard({ deploymentId, initialDeployment, connectedAccounts = [], onComplete }: Props) {
  const { apiUser } = useAppUser();
  const isDevUser = apiUser?.role === 'dev';
  const { toast } = useToast();

  const [sourceType, setSourceType] = useState<'git' | 'template'>('git');
  const [repoUrl, setRepoUrl] = useState(initialDeployment?.repoUrl || '');
  const [branch, setBranch] = useState(initialDeployment?.branch || 'main');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('node-express');

  const [frameworkPreset, setFrameworkPreset] = useState(initialDeployment?.frameworkPreset || 'Node.js');
  const [startCommand, setStartCommand] = useState(initialDeployment?.startCommand || 'npm start');
  const [internalPort, setInternalPort] = useState<number>(initialDeployment?.internalPort || 3000);
  const [exposureMode, setExposureMode] = useState<'ssl_with_proxy' | 'raw_tcp' | 'internal_only'>(initialDeployment?.exposureMode || 'ssl_with_proxy');
  const [subdomain, setSubdomain] = useState(initialDeployment?.subdomain || `app-${deploymentId.slice(0, 8)}`);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([
    { key: 'NODE_ENV', value: 'production' },
    { key: 'PORT', value: String(internalPort) },
  ]);
  const [showEnvVars, setShowEnvVars] = useState(false);

  const [deploying, setDeploying] = useState(false);

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

  function handleFrameworkChange(val: string) {
    setFrameworkPreset(val);
    const defaultPort = val === 'Python' ? 8000 : val === 'Static' ? 8080 : 3000;
    setInternalPort(defaultPort);
    setEnvVars((prev) => prev.map((item) => (item.key === 'PORT' ? { ...item, value: String(defaultPort) } : item)));
  }

  function handlePortChange(p: number) {
    setInternalPort(p);
    setEnvVars((prev) => prev.map((item) => (item.key === 'PORT' ? { ...item, value: String(p) } : item)));
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

  function generatePassword(index: number, key: string) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    updateEnvVar(index, key, Array.from(array, (b) => chars[b % chars.length]).join(''));
  }

  const canDeploy = sourceType === 'template' || repoUrl.trim().length > 0;

  async function handleDeploy() {
    setDeploying(true);
    try {
      const finalRepoUrl = sourceType === 'template' ? `template://${selectedTemplate}` : repoUrl;

      const envObj: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key.trim()) envObj[key.trim()] = value;
      });

      await api.deployments.updateConfig(deploymentId, {
        repoUrl: finalRepoUrl,
        branch,
        frameworkPreset,
        startCommand,
        internalPort,
        exposureMode,
        subdomain: exposureMode === 'ssl_with_proxy' ? subdomain : undefined,
        envVars: envObj,
      });

      await api.deployments.redeploy(deploymentId);
      toast('Deployment started.', 'success');
      onComplete();
    } catch (err: any) {
      toast(err.message || 'Failed to start the deployment', 'error');
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-white">New deployment</h1>
        <p className="mt-1 text-sm text-text-muted">Connect a repository or pick a template. We'll fill in the settings below -- change anything you need to, then deploy.</p>
      </div>

      {/* Source */}
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'git', title: 'Git repository', desc: 'GitHub, GitLab, or a public URL', icon: GitBranch },
            { id: 'template', title: 'Template', desc: 'A ready-made stack', icon: Layers },
          ].map((t) => {
            const isSel = sourceType === t.id;
            const Icon = t.icon;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setSourceType(t.id as any)}
                className={`space-y-1 rounded-xl border p-3.5 text-left transition-colors ${
                  isSel ? 'border-accent-cyan bg-white/[0.06] text-white' : 'border-white/[0.08] bg-black/20 text-text-muted hover:border-white/20'
                }`}
              >
                <Icon className={`h-5 w-5 ${isSel ? 'text-accent-cyan' : 'text-text-muted'}`} />
                <h4 className="text-sm font-medium">{t.title}</h4>
                <p className="text-xs text-text-faint">{t.desc}</p>
              </button>
            );
          })}
        </div>

        {sourceType === 'git' && (
          <div className="space-y-3 border-t border-white/[0.06] pt-4">
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Repository URL</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo.git"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white focus:border-accent-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white focus:border-accent-cyan focus:outline-none"
              />
            </div>
            {connectedAccounts.length > 0 && (
              <p className="text-xs text-text-muted">
                Using your connected account: <span className="font-mono text-accent-cyan">@{connectedAccounts[0].username}</span> ({connectedAccounts[0].provider})
              </p>
            )}
          </div>
        )}

        {sourceType === 'template' && (
          <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4">
            {TEMPLATE_PRESETS.map((tpl) => {
              const isSel = selectedTemplate === tpl.id;
              const Icon = tpl.icon;
              return (
                <button
                  type="button"
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                    isSel ? 'border-accent-cyan bg-white/[0.06] text-white' : 'border-white/[0.08] bg-black/20 text-text-muted hover:border-white/20'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isSel ? 'text-accent-cyan' : 'text-text-muted'}`} />
                  <span className="text-xs font-medium">{tpl.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Build settings -- pre-filled, visible and editable inline; no separate "next step" needed to see or change them */}
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-medium text-white">Build settings</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Framework</label>
            <select
              value={frameworkPreset}
              onChange={(e) => handleFrameworkChange(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white focus:border-accent-cyan focus:outline-none"
            >
              <option value="Node.js">Node.js</option>
              <option value="Python">Python</option>
              <option value="Static">Static site</option>
              <option value="Dockerfile">Dockerfile</option>
              <option value="Go">Go</option>
              <option value="Rust">Rust</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Port</label>
            <input
              type="number"
              value={internalPort}
              onChange={(e) => handlePortChange(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white focus:border-accent-cyan focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-text-muted">Start command</label>
          <input
            type="text"
            value={startCommand}
            onChange={(e) => setStartCommand(e.target.value)}
            placeholder="npm start"
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white focus:border-accent-cyan focus:outline-none"
          />
        </div>
      </Card>

      {/* Advanced: network exposure + subdomain. Collapsed by default -- most deployments use the default (a public
          HTTPS subdomain) and never need this. */}
      <Card className="p-0">
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex w-full items-center justify-between p-5 text-left">
          <div>
            <h3 className="text-sm font-medium text-white">Advanced</h3>
            <p className="text-xs text-text-muted">Network exposure and subdomain</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        {showAdvanced && (
          <div className="space-y-4 border-t border-white/[0.06] p-5">
            {isDevUser ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ssl_with_proxy', title: 'HTTPS subdomain', icon: Globe },
                  { id: 'raw_tcp', title: 'Direct port', icon: Radio },
                  { id: 'internal_only', title: 'Internal only', icon: Lock },
                ].map((m) => {
                  const isSel = exposureMode === m.id;
                  const Icon = m.icon;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setExposureMode(m.id as any)}
                      className={`space-y-1 rounded-lg border p-3 text-left transition-colors ${
                        isSel ? 'border-accent-cyan bg-white/[0.06] text-white' : 'border-white/[0.08] bg-black/20 text-text-muted hover:border-white/20'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSel ? 'text-accent-cyan' : 'text-text-muted'}`} />
                      <p className="text-xs font-medium">{m.title}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs text-text-muted">
                <Lock className="h-3.5 w-3.5" /> This deployment gets a public HTTPS subdomain with automatic SSL.
              </p>
            )}

            {exposureMode === 'ssl_with_proxy' && (
              <div>
                <label className="mb-1.5 block text-xs text-text-muted">Subdomain</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white focus:border-accent-cyan focus:outline-none"
                  />
                  <span className="font-mono text-xs text-text-muted">.shanutechx.app</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Environment variables. Collapsed by default. */}
      <Card className="p-0">
        <button type="button" onClick={() => setShowEnvVars((v) => !v)} className="flex w-full items-center justify-between p-5 text-left">
          <div>
            <h3 className="text-sm font-medium text-white">Environment variables</h3>
            <p className="text-xs text-text-muted">{envVars.length} set</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${showEnvVars ? 'rotate-180' : ''}`} />
        </button>
        {showEnvVars && (
          <div className="space-y-3 border-t border-white/[0.06] p-5">
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {envVars.map((env, i) => {
                const isSecretKey = /PASSWORD|SECRET|KEY|TOKEN|PASS/i.test(env.key);
                return (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-2">
                    <input
                      type="text"
                      value={env.key}
                      onChange={(e) => updateEnvVar(i, e.target.value.toUpperCase(), env.value)}
                      placeholder="KEY_NAME"
                      className="w-1/3 rounded-md border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-xs text-accent-cyan focus:border-accent-cyan focus:outline-none"
                    />
                    <input
                      type={isSecretKey ? 'password' : 'text'}
                      value={env.value}
                      onChange={(e) => updateEnvVar(i, env.key, e.target.value)}
                      placeholder="value"
                      className="flex-1 rounded-md border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-xs text-white focus:border-accent-cyan focus:outline-none"
                    />
                    {isSecretKey && (
                      <button type="button" onClick={() => generatePassword(i, env.key)} title="Generate a random value" className="rounded-md bg-white/5 p-1.5 text-text-muted hover:bg-white/10 hover:text-white">
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => removeEnvVar(i)} title="Remove" className="rounded-md bg-white/5 p-1.5 text-text-muted hover:bg-red-500/20 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addEnvVar}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add variable
            </Button>
          </div>
        )}
      </Card>

      <div className="flex justify-end pt-2">
        <Button size="md" onClick={handleDeploy} loading={deploying} disabled={!canDeploy}>
          {deploying ? 'Deploying...' : 'Deploy'}
        </Button>
      </div>
    </div>
  );
}
