'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Card, Button, Spinner, useToast } from '@/components/ui';
import { UploadCloud, GitBranch, RefreshCw, Lock, Terminal, Shield, Play, Download } from 'lucide-react';
import { useAppUser } from '@/lib/AppUserContext';

interface Props {
  deployment: any;
  onChanged: () => void;
}

export function CodeDeploymentPanel({ deployment, onChanged }: Props) {
  const { apiUser } = useAppUser();
  const isDevUser = apiUser?.role === 'dev';
  const [gitToken, setGitToken] = useState('');
  const [autoDeploy, setAutoDeploy] = useState<boolean>(deployment.autoDeploy ?? true);
  const [savingGit, setSavingGit] = useState(false);

  const [startCommand, setStartCommand] = useState(deployment.startCommand || '');
  const [entryFile, setEntryFile] = useState(deployment.entryFile || '');
  const [internalPort, setInternalPort] = useState<number>(deployment.internalPort || 3000);
  const [exposureMode, setExposureMode] = useState<string>(deployment.exposureMode || 'ssl_with_proxy');
  const [savingConfig, setSavingConfig] = useState(false);

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [deployingZip, setDeployingZip] = useState(false);
  const [zipLogs, setZipLogs] = useState<string[]>([]);
  const [showZipLogs, setShowZipLogs] = useState(false);

  const [redeploying, setRedeploying] = useState(false);
  const [redeployLogs, setRedeployLogs] = useState<string[]>([]);
  const [showRedeployLogs, setShowRedeployLogs] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  async function handleSaveGitSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingGit(true);
    try {
      await api.deployments.updateGitSettings(deployment.id, {
        gitToken: gitToken.trim() || undefined,
        autoDeploy,
      });
      toast('Git repository settings saved!', 'success');
      setGitToken('');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Failed to update Git settings', 'error');
    } finally {
      setSavingGit(false);
    }
  }

  async function handleSaveExecutionConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.deployments.updateConfig(deployment.id, {
        startCommand: startCommand.trim() || undefined,
        entryFile: entryFile.trim() || undefined,
        internalPort: Number(internalPort) || 3000,
        exposureMode: exposureMode as any,
      });
      toast('Execution configuration saved!', 'success');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Failed to update config', 'error');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleZipUploadAndDeploy() {
    if (!zipFile) {
      toast('Please select a .zip archive file to upload.', 'error');
      return;
    }
    setDeployingZip(true);
    setZipLogs([]);
    setShowZipLogs(true);
    try {
      await api.deployments.uploadZip(deployment.id, zipFile, (event) => {
        if (event.message) {
          setZipLogs((prev) => [...prev, `[${event.phase?.toUpperCase() || 'INFO'}] ${event.message}`]);
        }
      });
      toast('ZIP archive successfully uploaded & deployed!', 'success');
      setZipFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onChanged();
    } catch (err: any) {
      toast(err.message || 'ZIP deployment failed', 'error');
    } finally {
      setDeployingZip(false);
    }
  }

  async function handleTriggerRedeploy() {
    setRedeploying(true);
    setRedeployLogs([]);
    setShowRedeployLogs(true);
    try {
      await api.deployments.redeploy(deployment.id, (event) => {
        if (event.message) {
          setRedeployLogs((prev) => [...prev, `[${event.phase?.toUpperCase() || 'INFO'}] ${event.message}`]);
        }
      });
      toast('Container redeployed from source!', 'success');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Redeploy failed', 'error');
    } finally {
      setRedeploying(false);
    }
  }

  async function handleDownloadZip() {
    setDownloadingZip(true);
    try {
      await api.deployments.downloadZip(deployment.id, `${deployment.subdomain || `deployment-${deployment.id.slice(0, 8)}`}-backup.zip`);
      toast('Workspace ZIP backup download initiated!', 'success');
    } catch (err: any) {
      toast(err.message || 'ZIP download failed', 'error');
    } finally {
      setDownloadingZip(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* CARD 1: Code Source & Deployment Pipeline */}
      <Card
        title="Code Source & Build Trigger"
        description="Choose how your deployment container retrieves its application source code (Git repository or ZIP archive)."
      >
        <div className="space-y-6">
          {/* Current Source Status */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Current Source Type</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white capitalize">
                  {deployment.sourceType === 'zip' ? 'ZIP Archive File' : 'Git Repository'}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-accent-cyan/20 text-accent-cyan">
                  {deployment.repoUrl || 'No source linked'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={handleDownloadZip} loading={downloadingZip}>
                <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Download ZIP Backup
              </Button>
              {deployment.repoUrl && (
                <Button size="sm" variant="secondary" onClick={handleTriggerRedeploy} loading={redeploying}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Trigger Re-Deploy
                </Button>
              )}
            </div>
          </div>

          {/* Option A: ZIP File Upload Dropzone */}
          <div className="space-y-3 p-4 rounded-xl border border-white/10 bg-black/40">
            <div className="flex items-center gap-2 text-white text-xs font-semibold">
              <UploadCloud className="w-4 h-4 text-accent-violet" />
              <span>Upload ZIP Project Archive</span>
            </div>
            <p className="text-xs text-text-muted">
              Upload a compressed project source archive (<code className="text-emerald-400 font-mono">.zip</code> up to 100MB). Railpack will auto-detect the framework (Node.js, Python, Static HTML, Docker) and build your container.
            </p>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                className="block text-xs text-text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
              />
              {zipFile && (
                <Button size="sm" onClick={handleZipUploadAndDeploy} loading={deployingZip}>
                  Deploy ZIP ({Math.round(zipFile.size / 1024)} KB)
                </Button>
              )}
            </div>

            {showZipLogs && zipLogs.length > 0 && (
              <div className="mt-3 space-y-1">
                <span className="text-[10px] uppercase font-mono text-text-muted">ZIP Deployment Output Log</span>
                <pre className="bg-black/90 border border-white/10 rounded-xl p-3 text-xs font-mono text-emerald-400 h-40 overflow-y-auto whitespace-pre-wrap select-text">
                  {zipLogs.join('\n')}
                </pre>
              </div>
            )}
          </div>

          {/* Option B: Git Repository & Token Settings */}
          <form onSubmit={handleSaveGitSettings} className="space-y-4 p-4 rounded-xl border border-white/10 bg-black/40">
            <div className="flex items-center gap-2 text-white text-xs font-semibold">
              <GitBranch className="w-4 h-4 text-accent-cyan" />
              <span>Git Repository & Access Token</span>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">Repository URL</label>
              <input
                type="text"
                readOnly
                value={deployment.repoUrl || 'No Git URL attached'}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-text-muted opacity-80 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5 flex items-center justify-between">
                <span>Personal Access Token (PAT) for Private Repositories</span>
                {deployment.hasGitToken && <span className="text-emerald-400 text-[10px] font-mono font-normal">Encrypted Token Saved</span>}
              </label>
              <input
                type="password"
                value={gitToken}
                onChange={(e) => setGitToken(e.target.value)}
                placeholder={deployment.hasGitToken ? '•••••••••••••••• (Leave blank to keep existing)' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
              />
              <p className="text-[11px] text-text-faint mt-1">
                Required for private GitHub or GitLab repositories. Token is safely encrypted with AES-256 GCM.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDeploy}
                  onChange={(e) => setAutoDeploy(e.target.checked)}
                  className="rounded bg-black border-white/20 text-accent-cyan focus:ring-0"
                />
                <span>Auto-deploy container on new commit webhooks</span>
              </label>
              <Button type="submit" size="sm" loading={savingGit}>
                Save Git Settings
              </Button>
            </div>
          </form>

          {showRedeployLogs && redeployLogs.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono text-text-muted">Build Pipeline Log</span>
              <pre className="bg-black/90 border border-white/10 rounded-xl p-3 text-xs font-mono text-emerald-400 h-44 overflow-y-auto whitespace-pre-wrap select-text">
                {redeployLogs.join('\n')}
              </pre>
            </div>
          )}
        </div>
      </Card>

      {/* CARD 2: Exposed Ports & Execution Mode */}
      <Card
        title="Execution Mode & Exposed Ports"
        description="Configure runtime startup options, internal application ports, and SSL proxy routing."
      >
        <form onSubmit={handleSaveExecutionConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Custom Start Command</span>
              </label>
              <input
                type="text"
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                placeholder="npm start, python bot.py, etc."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
              />
              <p className="text-[11px] text-text-faint mt-1">Override framework default start script.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-accent-violet" />
                <span>Main Entry File</span>
              </label>
              <input
                type="text"
                value={entryFile}
                onChange={(e) => setEntryFile(e.target.value)}
                placeholder="index.js, main.py, server.ts"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">Internal Container Port</label>
              <input
                type="number"
                value={internalPort}
                onChange={(e) => setInternalPort(parseInt(e.target.value) || 3000)}
                placeholder="3000"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
              />
              <p className="text-[11px] text-text-faint mt-1">Port where your HTTP server or WebSocket listens inside container.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exposure Mode</span>
                </span>
                {!isDevUser && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {exposureMode === 'raw_tcp' ? 'Direct Port (TCP / DB)' : 'SSL Proxy (HTTPS)'} (System Recommended)
                  </span>
                )}
              </label>
              <select
                value={exposureMode}
                disabled={!isDevUser}
                onChange={(e) => setExposureMode(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-cyan disabled:opacity-80 disabled:cursor-not-allowed"
              >
                <option value="ssl_with_proxy">Reverse Proxy + Free SSL / TLS (HTTPS Web App)</option>
                <option value="raw_tcp">Direct TCP Port Mapping (Databases & Games)</option>
                {isDevUser && <option value="ssl_direct">Direct SSL Port Mapping</option>}
                {isDevUser && <option value="no_ssl">No SSL (Internal / Direct Exposure)</option>}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="sm" loading={savingConfig}>
              Save Execution Config
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
