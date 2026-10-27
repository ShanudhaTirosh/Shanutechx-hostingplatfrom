'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { BuildEvent } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import { useToast } from '@/components/ui';
import {
  GitBranch,
  Globe,
  Lock,
  Plus,
  Trash2,
  Zap,
  CheckCircle2,
  Copy,
  ExternalLink,
  Upload,
  FileText,
  Eye,
  EyeOff,
  Sparkles,
  Terminal,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeployed?: () => void;
}

export function parseEnvContent(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) {
      result[key] = val;
    }
  }
  return result;
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  const array = new Uint8Array(22);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

export function VercelDeployModal({ isOpen, onClose, onDeployed }: Props) {
  const router = useRouter();
  const { apiUser } = useAppUser();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Source selection
  const [gitProvider, setGitProvider] = useState<'github' | 'custom'>('custom');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connectingGit, setConnectingGit] = useState(false);

  // Project configuration
  const [repoUrl, setRepoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [branch, setBranch] = useState('main');
  const [customSubdomain, setCustomSubdomain] = useState('');

  // Runtime and port auto-detection
  const [detectedRuntime, setDetectedRuntime] = useState<string>('Next.js / Node.js Application');
  const [internalPort, setInternalPort] = useState<number>(3000);

  // Env vars
  const [envVars, setEnvVars] = useState<Record<string, string>>({
    NODE_ENV: 'production',
  });
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showPasteEnv, setShowPasteEnv] = useState(false);
  const [pasteEnvText, setPasteEnvText] = useState('');
  const [maskedKeys, setMaskedKeys] = useState<Record<string, boolean>>({});

  // Deploy process state
  const [deploying, setDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState<{
    deploymentId?: string;
    subdomain: string;
    url: string;
  } | null>(null);

  // Custom Domain post-deploy state
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [attachingDomain, setAttachingDomain] = useState(false);
  const [domainCnameInfo, setDomainCnameInfo] = useState<{
    domain: string;
    cnameTarget: string;
    verified: boolean;
    domainId?: string;
  } | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);

  function resetForm() {
    setGitProvider('custom');
    setRepoUrl('');
    setProjectName('');
    setBranch('main');
    setCustomSubdomain('');
    setEnvVars({ NODE_ENV: 'production' });
    setNewKey('');
    setNewValue('');
    setShowPasteEnv(false);
    setPasteEnvText('');
    setMaskedKeys({});
    setDeploying(false);
    setDeployLogs([]);
    setDeployError(null);
    setDeploySuccess(null);
    setCustomDomainInput('');
    setDomainCnameInfo(null);
    setAttachingDomain(false);
    setVerifyingDomain(false);
    setDetectedRuntime('Next.js / Node.js Application');
    setInternalPort(3000);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function detectRuntimeAndPort(url: string, name: string, currentEnv: Record<string, string>) {
    const combined = `${url} ${name}`.toLowerCase();
    if (currentEnv.PORT && !isNaN(Number(currentEnv.PORT))) {
      setInternalPort(Number(currentEnv.PORT));
      setDetectedRuntime('Custom Port from ENV');
      return;
    }
    if (/vite|react-app|spa|vue|nuxt|svelte/i.test(combined)) {
      setDetectedRuntime('Vite / Modern SPA');
      setInternalPort(5173);
    } else if (/fastapi|django|uvicorn|python/i.test(combined)) {
      setDetectedRuntime('Python (FastAPI / Django)');
      setInternalPort(8000);
    } else if (/flask/i.test(combined)) {
      setDetectedRuntime('Python (Flask)');
      setInternalPort(5000);
    } else if (/lavalink/i.test(combined)) {
      setDetectedRuntime('Lavalink Audio Node');
      setInternalPort(2333);
    } else if (/baileys|whatsapp/i.test(combined)) {
      setDetectedRuntime('WhatsApp Bot (Baileys)');
      setInternalPort(3000);
    } else if (/discord/i.test(combined)) {
      setDetectedRuntime('Discord Bot');
      setInternalPort(3000);
    } else if (/docker|container/i.test(combined)) {
      setDetectedRuntime('Custom Container / Docker');
      setInternalPort(8080);
    } else {
      setDetectedRuntime('Next.js / Node.js Application');
      setInternalPort(3000);
    }
  }

  // Load connected Git accounts
  useEffect(() => {
    if (isOpen) {
      api.git
        .accounts()
        .then((res: any) => {
          const accs = res.accounts || [];
          setAccounts(accs);
          const gh = accs.filter((a: any) => a.provider === 'github');
          if (gh.length > 0) {
            setSelectedAccountId(gh[0].id);
            fetchRepos(gh[0].id, 'github');
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  function fetchRepos(accId: string, provider: 'github' | 'gitlab') {
    setLoadingRepos(true);
    api.git
      .repos(accId, provider)
      .then((res: any) => setRepos(res.repos || []))
      .catch((err: any) => toast(err.message, 'error'))
      .finally(() => setLoadingRepos(false));
  }

  async function handleConnectGitHub() {
    setConnectingGit(true);
    try {
      const { url } = await api.git.getConnectUrl('github');
      window.location.href = url;
    } catch (err: any) {
      toast(err.message || 'Failed to initialize GitHub OAuth', 'error');
      setConnectingGit(false);
    }
  }

  function handleRepoUrlChange(url: string) {
    setRepoUrl(url);
    if (!url.trim()) return;

    // Auto-detect project name and runtime/port from repo url
    try {
      const clean = url.trim().replace(/\.git$/, '');
      const parts = clean.split('/');
      const repo = parts[parts.length - 1];
      if (repo && (!projectName || projectName === 'my-app')) {
        const sanitized = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        setProjectName(sanitized);
        const rand = crypto.randomUUID().slice(0, 4);
        setCustomSubdomain(`${sanitized.slice(0, 20)}-${rand}`);
        detectRuntimeAndPort(url, sanitized, envVars);
      } else {
        detectRuntimeAndPort(url, projectName, envVars);
      }
    } catch {
      detectRuntimeAndPort(url, projectName, envVars);
    }
  }

  function handleSelectGitHubRepo(fullName: string) {
    const found = repos.find((r) => r.fullName === fullName);
    if (found) {
      setRepoUrl(found.htmlUrl);
      const sanitized = found.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      setProjectName(sanitized);
      setBranch(found.defaultBranch || 'main');
      const rand = crypto.randomUUID().slice(0, 4);
      setCustomSubdomain(`${sanitized.slice(0, 20)}-${rand}`);
      detectRuntimeAndPort(found.htmlUrl, sanitized, envVars);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseEnvContent(content);
        setEnvVars((prev) => {
          const merged = { ...prev, ...parsed };
          detectRuntimeAndPort(repoUrl, projectName, merged);
          return merged;
        });
        toast(`Imported ${Object.keys(parsed).length} environment variables`, 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleApplyPastedEnv() {
    if (!pasteEnvText.trim()) return;
    const parsed = parseEnvContent(pasteEnvText);
    setEnvVars((prev) => {
      const merged = { ...prev, ...parsed };
      detectRuntimeAndPort(repoUrl, projectName, merged);
      return merged;
    });
    setPasteEnvText('');
    setShowPasteEnv(false);
    toast(`Added ${Object.keys(parsed).length} environment variables from paste`, 'success');
  }

  function handleAddSingleEnv() {
    if (!newKey.trim()) return;
    const key = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    setEnvVars((prev) => {
      const merged = { ...prev, [key]: newValue };
      if (key === 'PORT') detectRuntimeAndPort(repoUrl, projectName, merged);
      return merged;
    });
    setNewKey('');
    setNewValue('');
  }

  function handleDeleteEnv(key: string) {
    setEnvVars((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) {
      toast('Please provide a Git repository URL', 'error');
      return;
    }

    setDeploying(true);
    setDeployError(null);
    setDeployLogs([]);

    const finalSubdomain = customSubdomain.trim() || `app-${crypto.randomUUID().slice(0, 6)}`;
    const finalName = projectName.trim() || 'my-deployment';

    try {
      toast('Starting Vercel-style container build pipeline...', 'info');

      let createdDeploymentId: string | undefined;

      await api.deployments.create(
        {
          serviceType: 'web_hosting',
          repoUrl: repoUrl.trim(),
          preferredName: finalName,
          branch: branch.trim() || 'main',
          customSubdomain: finalSubdomain,
          internalPort: internalPort || 3000, // automatically detected container port
          exposureMode: 'ssl_with_proxy', // strict reverse proxy — zero host ports exposed
          frameworkPreset: 'auto',
          envVars,
          gitProvider: gitProvider === 'github' && selectedAccountId ? 'github' : 'custom',
          gitAccountId: gitProvider === 'github' && selectedAccountId ? selectedAccountId : undefined,
          autoDeploy: true,
        },
        (event: BuildEvent) => {
          if (event.log) setDeployLogs((prev) => [...prev, event.log!].slice(-500));
          else if (event.message) setDeployLogs((prev) => [...prev, event.message!].slice(-500));
          if (event.phase === 'error') {
            setDeployError(event.message ?? 'Deployment build failed');
          }
          if ((event as any).deploymentId) {
            createdDeploymentId = (event as any).deploymentId;
          }
        }
      );

      const liveUrl = `https://${finalSubdomain}.app.shanutechx.com`;
      setDeploySuccess({
        deploymentId: createdDeploymentId,
        subdomain: finalSubdomain,
        url: liveUrl,
      });

      toast('🎉 Deployment is live!', 'success');
      onDeployed?.();
    } catch (err: any) {
      setDeployError(err.message || 'Deployment failed');
      toast(err.message || 'Deployment failed', 'error');
    } finally {
      setDeploying(false);
    }
  }

  async function handleAttachCustomDomain() {
    if (!customDomainInput.trim() || !deploySuccess?.subdomain) return;
    setAttachingDomain(true);
    try {
      // Find deployment ID or use direct attach
      let depId = deploySuccess.deploymentId;
      if (!depId) {
        const list = await api.deployments.list();
        const found = list.deployments.find((d) => d.subdomain === deploySuccess.subdomain);
        if (found) depId = found.id;
      }

      if (!depId) {
        throw new Error('Unable to resolve deployment ID for domain attachment');
      }

      const res = await api.domains.attach(depId, customDomainInput.trim());
      setDomainCnameInfo({
        domain: res.customDomain?.domain || customDomainInput.trim(),
        cnameTarget: res.cnameTarget || `${deploySuccess.subdomain}.app.shanutechx.com`,
        verified: Boolean((res.customDomain as any)?.verified || (res.customDomain as any)?.verifiedAt),
        domainId: res.customDomain?.id,
      });
      toast('Custom domain registered. Configure DNS CNAME to activate.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to attach custom domain', 'error');
    } finally {
      setAttachingDomain(false);
    }
  }

  async function handleVerifyDomain() {
    if (!domainCnameInfo?.domainId) return;
    setVerifyingDomain(true);
    try {
      const res = await api.domains.verify(domainCnameInfo.domainId);
      if (res.verified) {
        setDomainCnameInfo((prev) => (prev ? { ...prev, verified: true } : null));
        toast('🎉 Domain verified & SSL active!', 'success');
      } else {
        toast(res.message || 'DNS verification still pending. Please allow 1-5 minutes for propagation.', 'info');
      }
    } catch (err: any) {
      toast(err.message || 'Verification check failed', 'error');
    } finally {
      setVerifyingDomain(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0a0a0d] border border-white/15 rounded-2xl shadow-2xl shadow-black overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Deploy New Project</h2>
              <p className="text-xs text-neutral-400">Simple Vercel-like automated deployment</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {deploySuccess ? (
            /* ── Post-Deploy Success & Custom Domain Screen (Vercel Style) ── */
            <div className="space-y-6 animate-fade-in">
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Your Project is Live!</h3>
                  <p className="text-xs text-text-muted mt-1">
                    Deployed automatically with free SSL, reverse proxy routing, and isolated container execution.
                  </p>
                </div>
                <div className="pt-2">
                  <a
                    href={deploySuccess.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all shadow-md"
                  >
                    <span>{deploySuccess.url}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Connect Custom Domain Card (Vercel Style) */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-white" />
                  <h4 className="text-sm font-semibold text-white">Connect Custom Domain</h4>
                </div>
                <p className="text-xs text-text-muted">
                  Attach your own branded domain (e.g. <code className="text-white font-mono">app.yourdomain.com</code>) to this deployment via CNAME routing.
                </p>

                {!domainCnameInfo ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value.toLowerCase().trim())}
                      placeholder="e.g. app.mycompany.com"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-white placeholder:text-text-faint"
                    />
                    <button
                      type="button"
                      onClick={handleAttachCustomDomain}
                      disabled={attachingDomain || !customDomainInput.trim()}
                      className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {attachingDomain ? 'Connecting…' : 'Add Domain'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted font-medium">Domain:</span>
                      <span className="font-mono text-white font-bold">{domainCnameInfo.domain}</span>
                    </div>

                    {/* Vercel-style DNS record table */}
                    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden text-xs">
                      <div className="grid grid-cols-4 bg-white/[0.04] p-2.5 font-semibold text-text-muted border-b border-white/10">
                        <span>Type</span>
                        <span>Name</span>
                        <span className="col-span-2">Value / Target</span>
                      </div>
                      <div className="grid grid-cols-4 p-3 items-center font-mono text-[11px]">
                        <span className="text-white font-bold">CNAME</span>
                        <span className="text-text-muted">
                          {domainCnameInfo.domain.includes('.')
                            ? domainCnameInfo.domain.split('.')[0]
                            : '@'}
                        </span>
                        <div className="col-span-2 flex items-center justify-between gap-1 text-white">
                          <span className="truncate select-all">{domainCnameInfo.cnameTarget}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(domainCnameInfo.cnameTarget);
                              toast('CNAME copied to clipboard', 'success');
                            }}
                            className="p-1 text-text-muted hover:text-white"
                            title="Copy CNAME"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-amber-300">
                          {domainCnameInfo.verified ? 'Verified & Active' : 'Pending DNS Propagation'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyDomain}
                        disabled={verifyingDomain}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all cursor-pointer"
                      >
                        {verifyingDomain ? 'Verifying…' : 'Verify DNS'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    if (deploySuccess.deploymentId) {
                      router.push(`/deployments/${deploySuccess.deploymentId}`);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>Open Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* ── Normal Deployment Setup Form (Vercel Style) ── */
            <form onSubmit={handleDeploy} className="space-y-6">
              {deployError && (
                <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0" />
                  <p>{deployError}</p>
                </div>
              )}

              {/* 1. Git Source Selector */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-white uppercase tracking-wider block">
                  1. Import Git Repository
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGitProvider('custom')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      gitProvider === 'custom'
                        ? 'border-white bg-white/10 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-black/40 text-text-muted hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4 text-white" />
                      <span className="text-xs font-bold text-white">Public Git URL</span>
                    </div>
                    <p className="text-[11px] text-text-muted">Paste any public GitHub / GitLab clone URL</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGitProvider('github')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      gitProvider === 'github'
                        ? 'border-white bg-white/10 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-black/40 text-text-muted hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch className="w-4 h-4 text-white" />
                      <span className="text-xs font-bold text-white">GitHub Account</span>
                    </div>
                    <p className="text-[11px] text-text-muted">Select from your private or organization repos</p>
                  </button>
                </div>

                {gitProvider === 'custom' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted">Git Repository URL</label>
                    <input
                      type="url"
                      required
                      value={repoUrl}
                      onChange={(e) => handleRepoUrlChange(e.target.value)}
                      placeholder="https://github.com/username/my-nextjs-app"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-white placeholder:text-text-faint"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 p-3.5 rounded-xl bg-black/40 border border-white/[0.08]">
                    {accounts.length === 0 ? (
                      <div className="text-center py-3 space-y-2">
                        <p className="text-xs text-text-muted">No connected GitHub account found.</p>
                        <button
                          type="button"
                          onClick={handleConnectGitHub}
                          disabled={connectingGit}
                          className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all cursor-pointer"
                        >
                          {connectingGit ? 'Connecting…' : 'Connect with GitHub'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-text-muted">Select Repository</label>
                          <span className="text-[11px] text-text-faint">Connected as @{accounts[0]?.accountLabel}</span>
                        </div>
                        {loadingRepos ? (
                          <div className="py-2 text-xs text-text-muted">Loading repositories…</div>
                        ) : (
                          <select
                            onChange={(e) => handleSelectGitHubRepo(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-white"
                          >
                            <option value="">Choose a repository…</option>
                            {repos.map((r) => (
                              <option key={r.id} value={r.fullName}>
                                {r.fullName} {r.private ? '🔒 (private)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Project Details (Automatic & Simplified) */}
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <label className="text-xs font-semibold text-white uppercase tracking-wider block">
                  2. Project Configuration
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">Project Name</label>
                    <input
                      type="text"
                      required
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="e.g. my-app"
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">Branch</label>
                    <input
                      type="text"
                      required
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-white"
                    />
                  </div>
                </div>

                {/* Auto Detection & Enterprise Isolation Architecture */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-white" />
                      <span className="text-xs font-semibold text-white">Runtime: {detectedRuntime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        100% Isolated
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white font-medium">
                        Port {internalPort}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-[11px]">
                    <div className="flex items-start gap-1.5 text-neutral-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Network:</strong> Private container bridge network. Zero cross-talk.</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-neutral-300">
                      <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Storage:</strong> Sandboxed volume filesystem per instance.</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-neutral-300">
                      <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Zero Host Ports:</strong> Internal routing only via HTTPS edge reverse proxy.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Environment Variables (.env) */}
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white uppercase tracking-wider">
                    3. Environment Variables
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".env,.env.*,.txt,.config"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload .env</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasteEnv(!showPasteEnv)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>{showPasteEnv ? 'Hide Text' : 'Paste .env'}</span>
                    </button>
                  </div>
                </div>

                {/* Raw Paste Textarea */}
                {showPasteEnv && (
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-2">
                    <textarea
                      value={pasteEnvText}
                      onChange={(e) => setPasteEnvText(e.target.value)}
                      rows={4}
                      placeholder={`DATABASE_URL=postgresql://...\nAPI_SECRET=my_secret_token\nPORT=3000`}
                      className="w-full p-2.5 rounded-lg bg-black/80 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-white leading-relaxed"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleApplyPastedEnv}
                        className="px-3 py-1 rounded-lg bg-white text-black font-bold text-xs font-mono hover:bg-neutral-200 transition-all cursor-pointer"
                      >
                        Parse &amp; Add Variables
                      </button>
                    </div>
                  </div>
                )}

                {/* Variables List */}
                {Object.keys(envVars).length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(envVars).map(([k, v]) => {
                      const isSecret = /PASSWORD|SECRET|KEY|TOKEN|AUTH/i.test(k);
                      const isMasked = maskedKeys[k] !== false;

                      return (
                        <div
                          key={k}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                        >
                          <span className="w-1/3 truncate text-[11px] font-mono text-white font-semibold">
                            {k}
                          </span>
                          <input
                            type={isSecret && isMasked ? 'password' : 'text'}
                            value={v}
                            onChange={(e) => setEnvVars({ ...envVars, [k]: e.target.value })}
                            className="flex-1 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none"
                          />
                          {isSecret && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const pwd = generateRandomPassword();
                                  setEnvVars({ ...envVars, [k]: pwd });
                                  toast(`Generated secret password for ${k}`, 'info');
                                }}
                                className="p-1.5 text-text-muted hover:text-white"
                                title="Generate random password"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setMaskedKeys({ ...maskedKeys, [k]: !isMasked })}
                                className="p-1.5 text-text-muted hover:text-white"
                                title={isMasked ? 'Show password' : 'Hide password'}
                              >
                                {isMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteEnv(k)}
                            className="p-1.5 text-red-400 hover:text-red-300"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Add Env Variable */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="KEY (e.g. STRIPE_KEY)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="VALUE"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSingleEnv}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition-all cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Streaming Logs Drawer (if deploying) */}
              {deploying && (
                <div className="p-4 rounded-xl bg-black/90 border border-white/10 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-white">
                    <Terminal className="w-3.5 h-3.5 animate-pulse text-white" />
                    <span className="font-semibold">Building &amp; Deploying Container…</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-text-muted select-all">
                    {deployLogs.length === 0 ? (
                      <p className="animate-pulse">Provisioning cloud container and fetching git commit…</p>
                    ) : (
                      deployLogs.map((line, idx) => <p key={idx}>{line}</p>)
                    )}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={deploying}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deploying || !repoUrl.trim()}
                  className="px-6 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-white/10 cursor-pointer"
                >
                  {deploying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Deploying…</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Deploy Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
