'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Deployment, BuildEvent } from '@/lib/types';
import {
  Card,
  Button,
  Badge,
  Spinner,
  CardSkeleton,
  EmptyState,
  ErrorBanner,
  Input,
  useToast,
  PageHeader,
} from '@/components/ui';
import { DomainManagement } from '@/components/DomainManagement';

export const dynamic = 'force-dynamic';

const SERVICE_TYPES = [
  { value: 'web_hosting', label: 'Web Application (Node.js / React / Next.js / Static)' },
  { value: 'whatsapp_baileys', label: 'WhatsApp Bot (Baileys / KnightBot / Raganork / Prabath MD)' },
  { value: 'discordbot_node', label: 'Discord Bot (Node.js)' },
  { value: 'discordbot_python', label: 'Discord Bot (Python)' },
  { value: 'lavalink', label: 'Lavalink Audio Node (Java JAR + application.yml)' },
  { value: 'node_hosting', label: 'Node.js Backend Service (Express / NestJS)' },
  { value: 'python_hosting', label: 'Python Application (FastAPI / Django / Flask)' },
  { value: 'custom_docker', label: 'Custom Container / Script' },
];

const EXPOSURE_MODES = [
  { value: 'ssl_with_proxy', label: 'SSL with Proxy (Traefik HTTPS + Automatic Let\'s Encrypt TLS)' },
  { value: 'ssl_direct', label: 'SSL Direct (Container Direct TLS Termination)' },
  { value: 'no_ssl', label: 'No SSL / Direct Host Port (Direct TCP/UDP — Required for Lavalink audio, game servers, raw sockets)' },
];

export interface ConnectedGitAccount {
  id: string;
  provider: 'github' | 'gitlab';
  accountLabel: string;
  accountType?: string;
  avatarUrl?: string | null;
  updatedAt: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  function load() {
    api.deployments
      .list()
      .then((data) => setDeployments(data.deployments))
      .catch((err) => {
        setError(err.message);
        toast('Failed to load deployments', 'error');
      });
  }

  useEffect(load, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Custom Application & Bot Deployments"
        description="Deploy WhatsApp bots, Discord bots, Lavalink music servers, Next.js web apps, and custom scripts with full control over start commands and port exposure."
      />

      {error && <ErrorBanner message={error} />}

      <NewDeploymentForm onDeployed={load} />

      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
          Your Active Deployments ({deployments?.length ?? 0})
        </h2>

        {deployments === null && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}
        {deployments?.length === 0 && (
          <EmptyState message="No deployments active. Pick a repository from GitHub or GitLab above to deploy." />
        )}

        <div className="space-y-4">
          {deployments?.map((d) => (
            <DeploymentRow key={d.id} deployment={d} onChanged={load} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NewDeploymentForm({ onDeployed }: { onDeployed: () => void }) {
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0].value);
  const [gitProvider, setGitProvider] = useState<'github' | 'gitlab' | 'custom'>('github');
  const [accounts, setAccounts] = useState<ConnectedGitAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  const [repos, setRepos] = useState<Array<{ id: string; name: string; fullName: string; private: boolean; defaultBranch: string; htmlUrl: string }>>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [customGitUrl, setCustomGitUrl] = useState(''); // only used for gitProvider: 'custom'
  const [preferredName, setPreferredName] = useState('');
  const [customSubdomain, setCustomSubdomain] = useState('');
  const [internalPort, setInternalPort] = useState('3000');
  const [startCommand, setStartCommand] = useState('');
  const [entryFile, setEntryFile] = useState('');
  const [exposureMode, setExposureMode] = useState('ssl_with_proxy');
  const [deploying, setDeploying] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isPublic = exposureMode !== 'no_ssl' && serviceType !== 'discordbot_node' && serviceType !== 'discordbot_python';

  function loadAccounts() {
    api.git.accounts().then((res) => {
      setAccounts(res.accounts);
      // Auto-select first matching provider account if available
      const matching = res.accounts.filter((a) => a.provider === (gitProvider === 'custom' ? 'github' : gitProvider));
      if (matching.length > 0 && !selectedAccountId) {
        setSelectedAccountId(matching[0].id);
        fetchReposForAccount(matching[0].id, matching[0].provider);
      }
    }).catch(() => {});
  }

  function fetchReposForAccount(accId: string, provider: 'github' | 'gitlab') {
    setLoadingRepos(true);
    api.git.repos(accId, provider)
      .then((res) => setRepos(res.repos))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoadingRepos(false));
  }

  useEffect(() => {
    loadAccounts();
  }, [gitProvider]);

  // After being redirected back from GitHub's App installation page or
  // GitLab's OAuth authorize page (routes/gitConnect.ts's callback
  // routes), the URL carries ?git_connect=success|error|pending. Surface
  // that as a toast, then clean the query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('git_connect');
    const provider = params.get('provider');
    if (!status) return;

    if (status === 'success') {
      toast(`${provider === 'gitlab' ? 'GitLab' : 'GitHub'} account connected!`, 'success');
      loadAccounts();
    } else if (status === 'pending') {
      toast(`Installation requested — waiting for an organization owner to approve it.`, 'info');
    } else if (status === 'error') {
      toast(`Failed to connect your ${provider === 'gitlab' ? 'GitLab' : 'GitHub'} account. Please try again.`, 'error');
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('git_connect');
    url.searchParams.delete('provider');
    window.history.replaceState({}, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAccountSwitch(accId: string) {
    setSelectedAccountId(accId);
    const account = accounts.find((a) => a.id === accId);
    if (accId && account) {
      fetchReposForAccount(accId, account.provider);
    } else {
      setRepos([]);
    }
  }

  function handleSelectRepo(selectedFullName: string) {
    const found = repos.find((r) => r.fullName === selectedFullName);
    if (found) {
      setRepoUrl(found.htmlUrl);
      setPreferredName(found.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      setBranch(found.defaultBranch || 'main');
    }
  }

  // No token is ever handled on the frontend — this just redirects the
  // browser to GitHub's App installation page or GitLab's OAuth authorize
  // page. The connection completes entirely server-side (see
  // routes/gitConnect.ts's /start and /callback routes).
  async function handleConnectAccount() {
    if (gitProvider === 'custom') return;
    setConnecting(true);
    try {
      const { url } = await api.git.getConnectUrl(gitProvider);
      window.location.href = url;
    } catch (err: any) {
      toast(err.message || `Failed to start ${gitProvider === 'gitlab' ? 'GitLab' : 'GitHub'} connection`, 'error');
      setConnecting(false);
    }
  }

  async function handleDisconnectAccount(accId: string) {
    const account = accounts.find((a) => a.id === accId);
    if (!account) return;
    try {
      await api.git.disconnect(account.provider, accId);
      toast('Account disconnected', 'info');
      setSelectedAccountId('');
      setRepos([]);
      loadAccounts();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDeploying(true);
    setError(null);
    setLog([]);

    try {
      toast('Starting Railpack container build pipeline...', 'info');
      await api.deployments.create(
        {
          serviceType,
          repoUrl: gitProvider === 'custom' ? customGitUrl : repoUrl,
          branch: branch || 'main',
          gitProvider,
          // The selected account's ID -- the server resolves this into a
          // fresh, scoped token itself. No token is ever handled here.
          gitAccountId: gitProvider !== 'custom' ? selectedAccountId || undefined : undefined,
          preferredName,
          customSubdomain: customSubdomain.trim() || undefined,
          internalPort: Number(internalPort),
          startCommand: startCommand.trim() || undefined,
          entryFile: entryFile.trim() || undefined,
          exposureMode: exposureMode || 'ssl_with_proxy',
        },
        (event: BuildEvent) => {
          if (event.log) setLog((prev) => [...prev, event.log!]);
          else if (event.message) setLog((prev) => [...prev, event.message!]);
          if (event.phase === 'error') setError(event.message ?? 'Deployment failed');
        }
      );
      setRepoUrl('');
      setPreferredName('');
      toast('Deployment created & live!', 'success');
      onDeployed();
    } catch (err: any) {
      setError(err.message);
      toast('Deployment failed', 'error');
    } finally {
      setDeploying(false);
    }
  }

  const providerAccounts = accounts.filter((a) => a.provider === (gitProvider === 'custom' ? 'github' : gitProvider));

  return (
    <Card className="border border-white/[0.08] bg-white/[0.01]">
      <h2 className="font-semibold text-base text-text-primary mb-1 flex items-center gap-2">
        🚀 Deploy Repository (GitHub App &amp; GitLab Multi-Account Support)
      </h2>
      <p className="text-xs text-text-muted mb-4">
        Connect your GitHub or GitLab account to pick repositories directly from an account dropdown, or deploy any public Git URL.
      </p>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {/* Provider Selector & Multi-Account Switcher Bar */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setGitProvider('github'); setSelectedAccountId(''); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                gitProvider === 'github'
                  ? 'bg-accent-violet/20 border-accent-violet text-white shadow-glow-violet'
                  : 'glass text-text-muted hover:text-white'
              }`}
            >
              🐙 GitHub App
            </button>
            <button
              type="button"
              onClick={() => { setGitProvider('gitlab'); setSelectedAccountId(''); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                gitProvider === 'gitlab'
                  ? 'bg-accent-violet/20 border-accent-violet text-white shadow-glow-violet'
                  : 'glass text-text-muted hover:text-white'
              }`}
            >
              🦊 GitLab App
            </button>
            <button
              type="button"
              onClick={() => { setGitProvider('custom'); setSelectedAccountId(''); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                gitProvider === 'custom'
                  ? 'bg-accent-violet/20 border-accent-violet text-white shadow-glow-violet'
                  : 'glass text-text-muted hover:text-white'
              }`}
            >
              🌐 Public / Custom URL
            </button>
          </div>

          {gitProvider !== 'custom' && (
            <Button size="sm" onClick={handleConnectAccount} loading={connecting}>
              + Connect {gitProvider === 'github' ? 'GitHub' : 'GitLab'}
            </Button>
          )}
        </div>

        {/* Multi-Account Selector */}
        {gitProvider !== 'custom' && providerAccounts.length > 0 && (
          <div className="pt-3 border-t border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Select Connected Account ({providerAccounts.length} Connected)
              </label>
              {selectedAccountId && (
                <button
                  type="button"
                  onClick={() => handleDisconnectAccount(selectedAccountId)}
                  className="text-[11px] text-red-400 hover:underline"
                >
                  Disconnect Selected Account
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {providerAccounts.map((acc) => (
                <button
                  type="button"
                  key={acc.id}
                  onClick={() => handleAccountSwitch(acc.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    selectedAccountId === acc.id
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                      : 'bg-white/5 border-white/10 text-text-muted hover:text-white'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  @{acc.accountLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Repository Dropdown Picker */}
        {selectedAccountId && (
          <div className="pt-3 border-t border-white/[0.04]">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
              Choose Repository to Deploy
            </label>
            {loadingRepos ? (
              <Spinner label="Fetching repository list..." />
            ) : repos.length === 0 ? (
              <p className="text-xs text-text-muted">No repositories found in this account.</p>
            ) : (
              <select
                onChange={(e) => handleSelectRepo(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-accent-violet font-mono"
              >
                <option value="">-- Choose a repository from account --</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.fullName}>
                    {r.fullName} {r.private ? '🔒 (Private)' : '🌐 (Public)'}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Application Type &amp; Framework</label>
            <select
              value={serviceType}
              onChange={(e) => {
                const val = e.target.value;
                setServiceType(val);
                if (val === 'lavalink') {
                  setInternalPort('2333');
                  setStartCommand('java -jar Lavalink.jar');
                  setEntryFile('application.yml');
                  setExposureMode('no_ssl');
                } else if (val === 'whatsapp_baileys') {
                  setInternalPort('3000');
                  setStartCommand('node index.js');
                  setEntryFile('index.js');
                  setExposureMode('ssl_with_proxy');
                } else if (val === 'discordbot_node') {
                  setStartCommand('node index.js');
                  setEntryFile('index.js');
                  setExposureMode('no_ssl');
                } else if (val === 'discordbot_python') {
                  setStartCommand('python bot.py');
                  setEntryFile('bot.py');
                  setExposureMode('no_ssl');
                }
              }}
              className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent-violet transition-all"
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-bg text-white">
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            required
            label="Application Name"
            placeholder="my-awesome-app"
            value={preferredName}
            onChange={(e) => {
              setPreferredName(e.target.value);
              if (!customSubdomain) {
                setCustomSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              }
            }}
          />
          <Input
            label="Desired Subdomain (Optional)"
            placeholder="my-custom-subdomain"
            value={customSubdomain}
            onChange={(e) => setCustomSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            hint="Leave empty to auto-generate from Application Name. Will route at https://<subdomain>.shanutechx.com"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            {gitProvider === 'custom' ? (
              <Input
                required
                type="url"
                label="Git Repository Clone URL"
                placeholder="https://github.com/public-user/public-repo"
                value={customGitUrl}
                onChange={(e) => setCustomGitUrl(e.target.value)}
                hint="For public repositories only — private repos need a GitHub or GitLab connected account, selected above."
              />
            ) : (
              <Input
                required
                readOnly
                label="Repository"
                placeholder="Choose a repository from the dropdown above"
                value={repoUrl}
                hint={
                  selectedAccountId
                    ? 'Choose a repository from the dropdown above.'
                    : `Connect your ${gitProvider === 'github' ? 'GitHub' : 'GitLab'} account above to pick a repository.`
                }
              />
            )}
          </div>
          <Input
            label="Branch"
            placeholder="main"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </div>

        {/* Advanced Bot & Hosting Configuration */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Advanced Bot &amp; Container Settings
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Custom Start Command (Optional)"
              placeholder="e.g. java -jar Lavalink.jar, node index.js, python bot.py, npm start"
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
              hint="Override container default start command (e.g. java -Xmx1024M -jar Lavalink.jar)."
            />

            <Input
              label="Entry / Config File (Optional)"
              placeholder="e.g. application.yml, index.js, bot.py"
              value={entryFile}
              onChange={(e) => setEntryFile(e.target.value)}
              hint="Specify entrypoint or primary config file (e.g. application.yml for Lavalink)."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Exposure &amp; SSL Routing Mode</label>
              <select
                value={exposureMode}
                onChange={(e) => setExposureMode(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent-violet transition-all"
              >
                {EXPOSURE_MODES.map((m) => (
                  <option key={m.value} value={m.value} className="bg-bg text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {isPublic && (
              <Input
                required
                type="number"
                label="Internal Application Listening Port"
                placeholder="3000"
                value={internalPort}
                onChange={(e) => setInternalPort(e.target.value)}
                hint="Port specified in package.json, application.yml, or web server (e.g. 3000, 2333, 8080)."
              />
            )}
          </div>
        </div>

        <Button type="submit" loading={deploying} className="w-full justify-center bg-brand-gradient">
          {deploying ? 'Building Container...' : '🚀 Deploy Application via Railpack →'}
        </Button>
      </form>

      {log.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Live Railpack Streaming Build Logs</p>
            {log.length > 1000 && (
              <p className="text-[10px] text-text-faint">Showing last 1000 lines</p>
            )}
          </div>
          <pre className="bg-black/80 rounded-xl p-4 text-xs font-mono text-emerald-400 max-h-96 overflow-y-auto whitespace-pre-wrap border border-white/10 shadow-inner">
            {log.slice(-1000).join('\n')}
          </pre>
        </div>
      )}
    </Card>
  );
}

function DeploymentRow({ deployment, onChanged }: { deployment: Deployment; onChanged: () => void }) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [redeployLog, setRedeployLog] = useState<string[]>([]);
  const [downloadingLogs, setDownloadingLogs] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleToggleLogs() {
    if (!showLogs) {
      try {
        const data = await api.deployments.logs(deployment.id);
        setLogs(data.logs);
      } catch (err: any) {
        setLogs(`Failed to fetch logs: ${err.message}`);
      }
    }
    setShowLogs((v) => !v);
  }

  async function handleDownloadLogs() {
    setDownloadingLogs(true);
    try {
      const data = await api.deployments.logs(deployment.id);
      const blob = new Blob([data.logs], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deployment-${deployment.id.slice(0, 8)}-logs.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Logs downloaded', 'success');
    } catch (err: any) {
      toast('Failed to download logs', 'error');
    } finally {
      setDownloadingLogs(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      await api.deployments.stop(deployment.id);
      toast('Deployment stopped successfully', 'success');
      onChanged();
    } catch (e: any) {
      toast(e.message || 'Failed to stop deployment', 'error');
    } finally {
      setStopping(false);
    }
  }

  async function handleRedeploy() {
    setRedeploying(true);
    setRedeployLog([]);
    try {
      toast('Redeployment started...', 'info');
      await api.deployments.redeploy(deployment.id, (event) => {
        if (event.log) setRedeployLog((prev) => [...prev, event.log!]);
        else if (event.message) setRedeployLog((prev) => [...prev, event.message!]);
      });
      toast('Redeployment finished', 'success');
      onChanged();
    } catch (e: any) {
      toast(e.message || 'Redeployment failed', 'error');
    } finally {
      setRedeploying(false);
    }
  }

  return (
    <Card className="border border-white/[0.06] hover:border-white/12 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-text-primary text-sm">
              {deployment.subdomain ? `${deployment.subdomain}.shanutechx.com` : deployment.repoUrl ?? deployment.id}
            </p>
            {deployment.customDomain && (
              <span className="text-[10px] rounded-full px-2 py-0.5 bg-accent-teal/10 text-accent-teal-bright font-medium">
                {deployment.customDomain}
              </span>
            )}
            {deployment.exposureMode && (
              <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                deployment.exposureMode === 'no_ssl'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {deployment.exposureMode === 'no_ssl' ? 'Direct TCP (No SSL)' : deployment.exposureMode === 'ssl_direct' ? 'SSL Direct' : 'SSL Proxy'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-text-faint text-xs mt-1 font-mono flex-wrap">
            <span>{deployment.node?.label ? `Cluster Node: ${deployment.node.label}` : 'Deploying...'}</span>
            {deployment.startCommand && (
              <span className="text-text-muted">Cmd: <code className="text-emerald-300">{deployment.startCommand}</code></span>
            )}
            {deployment.entryFile && (
              <span className="text-text-muted">Entry: <code className="text-cyan-300">{deployment.entryFile}</code></span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge status={deployment.status} dot />
          <Button variant="secondary" size="sm" onClick={() => router.push(`/deployments/${deployment.id}`)}>
            View Details
          </Button>
          {deployment.containerId && (
            <Button variant="ghost" size="sm" onClick={handleToggleLogs}>
              {showLogs ? 'Hide logs' : 'View logs'}
            </Button>
          )}
          {deployment.repoUrl && (
            <Button variant="secondary" size="sm" onClick={handleRedeploy} disabled={redeploying}>
              {redeploying ? 'Redeploying...' : 'Redeploy'}
            </Button>
          )}
          {deployment.status === 'running' && (
            <Button variant="danger" size="sm" onClick={handleStop} disabled={stopping}>
              {stopping ? 'Stopping...' : 'Stop'}
            </Button>
          )}
        </div>
      </div>

      {showLogs && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Application Output Logs</p>
            <Button variant="ghost" size="sm" onClick={handleDownloadLogs} loading={downloadingLogs}>
              {downloadingLogs ? 'Downloading...' : 'Download Full Log'}
            </Button>
          </div>
          <pre className="bg-black/60 rounded-xl p-4 text-xs font-mono text-emerald-400 max-h-96 overflow-y-auto whitespace-pre-wrap border border-white/[0.04]">
            {logs ? logs.split('\n').slice(-1000).join('\n') : 'No logs available.'}
          </pre>
        </div>
      )}

      {redeployLog.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Redeployment Logs</p>
          </div>
          <pre className="bg-black/60 rounded-xl p-4 text-xs font-mono text-yellow-400 max-h-96 overflow-y-auto whitespace-pre-wrap border border-white/[0.04]">
            {redeployLog.slice(-1000).join('\n')}
          </pre>
        </div>
      )}

      {deployment.subdomain && (
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <DomainManagement deployment={deployment} onChanged={onChanged} />
        </div>
      )}
    </Card>
  );
}
