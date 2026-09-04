"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Deployment, BuildEvent } from "@/lib/types";
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
} from "@/components/ui";
import { IconLock, IconGlobe, IconGitBranch } from "@/components/Icons";
import { DomainManagement } from "@/components/DomainManagement";
import { ResourceScopeSelector } from "@/components/ResourceScopeSelector";

import { useAppUser } from "@/lib/AppUserContext";
import Link from "next/link";

export const dynamic = "force-dynamic";

const SERVICE_TYPES = [
  {
    value: "web_hosting",
    label: "Web Application (Node.js / React / Next.js / Static)",
  },
  { value: "whatsapp_baileys", label: "WhatsApp Bot (Baileys / web.js)" },
  { value: "discordbot_node", label: "Discord Bot (Node.js)" },
  { value: "discordbot_python", label: "Discord Bot (Python)" },
  {
    value: "lavalink",
    label: "Lavalink Audio Node (Java JAR + application.yml)",
  },
  {
    value: "node_hosting",
    label: "Node.js Backend Service (Express / NestJS)",
  },
  {
    value: "python_hosting",
    label: "Python Application (FastAPI / Django / Flask)",
  },
  { value: "custom_docker", label: "Custom Container / Script" },
];

const EXPOSURE_MODES = [
  {
    value: "ssl_with_proxy",
    label: "SSL with Proxy ( Automatic Let's Encrypt TLS)",
  },
  {
    value: "ssl_direct",
    label: "SSL Direct (Container Direct TLS Termination)",
  },
  {
    value: "no_ssl",
    label:
      "No SSL / Direct Host Port (Direct TCP/UDP — Required for Lavalink audio, game servers, raw sockets)",
  },
];

export interface ConnectedGitAccount {
  id: string;
  provider: "github" | "gitlab";
  accountLabel: string;
  accountType?: string;
  avatarUrl?: string | null;
  updatedAt: string;
}

export default function DeploymentsPage() {
  const { apiUser } = useAppUser();
  const isStaff = apiUser?.role === "admin" || apiUser?.role === "dev";
  const [deployments, setDeployments] = useState<Deployment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const { toast } = useToast();

  function load() {
    api.deployments
      .list()
      .then((data) => setDeployments(data.deployments))
      .catch((err) => {
        setError(err.message);
        toast("Failed to load deployments", "error");
      });
  }

  useEffect(load, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Application & Bot Deployments"
        description="Manage your active Web Hosting, Bot Hosting, and Application Instances. Configure GitHub auto-deployments, ZIP source uploads, custom domains, and exposed ports."
        action={
          <div className="flex items-center gap-3">
            <Link href="/services">
              <Button size="sm" className="bg-brand-gradient">
                + Purchase New Hosting Plan
              </Button>
            </Link>
            {isStaff && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowAdminForm(!showAdminForm)}
              >
                {showAdminForm ? "Hide Infrastructure Panel" : "⚡ Admin Manual Provision"}
              </Button>
            )}
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {isStaff && showAdminForm && <NewDeploymentForm onDeployed={load} />}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Your Active Deployment Instances ({deployments?.length ?? 0})
          </h2>
        </div>

        {deployments === null && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {deployments?.length === 0 && (
          <Card className="border border-dashed border-white/10 p-8 text-center bg-white/[0.01]">
            <div className="h-12 w-12 rounded-2xl bg-accent-violet/10 text-accent-violet flex items-center justify-center mx-auto mb-4">
              <IconGitBranch size={24} />
            </div>
            <h3 className="font-semibold text-base text-white mb-2">No Active Hosting Instances Found</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto mb-6">
              Purchase Web Hosting, Discord Bot Hosting, WhatsApp Bot Hosting, or Application Hosting from the Services Storefront to unlock a dedicated deployment slot.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/services">
                <Button size="sm">Browse Services Catalog →</Button>
              </Link>
              <Link href="/catalog">
                <Button size="sm" variant="secondary">Browse 1-Click App Store</Button>
              </Link>
            </div>
          </Card>
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

function generateRandomSubdomain() {
  return `app-${Math.random().toString(36).substring(2, 8)}`;
}

function NewDeploymentForm({ onDeployed }: { onDeployed: () => void }) {
  const [selectedScope, setSelectedScope] = useState("personal");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0].value);
  const [gitProvider, setGitProvider] = useState<"github" | "custom">("github");
  const [accounts, setAccounts] = useState<ConnectedGitAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [connecting, setConnecting] = useState(false);

  const [repos, setRepos] = useState<
    Array<{
      id: string;
      name: string;
      fullName: string;
      private: boolean;
      defaultBranch: string;
      htmlUrl: string;
    }>
  >([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [gitToken, setGitToken] = useState("");
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [customGitUrl, setCustomGitUrl] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [customSubdomain, setCustomSubdomain] = useState(() =>
    generateRandomSubdomain(),
  );
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [internalPort, setInternalPort] = useState("3000");
  const [startCommand, setStartCommand] = useState("");
  const [entryFile, setEntryFile] = useState("");
  const [exposureMode, setExposureMode] = useState("ssl_with_proxy");
  const [deploying, setDeploying] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isPublic =
    exposureMode !== "no_ssl" &&
    serviceType !== "discordbot_node" &&
    serviceType !== "discordbot_python";

  function loadAccounts() {
    api.git
      .accounts()
      .then((res) => {
        setAccounts(res.accounts);
        const matching = res.accounts.filter((a) => a.provider === "github");
        if (matching.length > 0 && !selectedAccountId) {
          setSelectedAccountId(matching[0].id);
          fetchReposForAccount(matching[0].id, "github");
        }
      })
      .catch(() => {});
  }

  function fetchReposForAccount(accId: string, provider: "github" | "gitlab") {
    setLoadingRepos(true);
    api.git
      .repos(accId, provider)
      .then((res) => setRepos(res.repos))
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoadingRepos(false));
  }

  useEffect(() => {
    loadAccounts();
  }, [gitProvider]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("git_connect");
    if (!status) return;

    if (status === "success") {
      toast("Successfully connected GitHub account!", "success");
      loadAccounts();
    } else if (status === "error") {
      const msg = params.get("message") || "Connection failed";
      toast(`Git connection error: ${msg}`, "error");
    }
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  function handleAccountSwitch(accId: string) {
    setSelectedAccountId(accId);
    const account = accounts.find((a) => a.id === accId);
    if (accId && account) {
      fetchReposForAccount(accId, "github");
    } else {
      setRepos([]);
    }
  }

  function handleSelectRepo(selectedFullName: string) {
    const found = repos.find((r) => r.fullName === selectedFullName);
    if (found) {
      setRepoUrl(found.htmlUrl);
      const appName = found.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      setPreferredName(appName);
      setBranch(found.defaultBranch || "main");
      if (!customSubdomain || customSubdomain.startsWith("app-")) {
        const cleanSub = `${appName.slice(0, 20)}-${Math.random().toString(36).substring(2, 6)}`;
        setCustomSubdomain(cleanSub);
      }
    }
  }

  function handleSubdomainChange(inputVal: string) {
    const sanitized = inputVal
      .toLowerCase()
      .replace(/\s/g, "")
      .replace(/_/g, "")
      .replace(/[^a-z0-9-]/g, "");
    setCustomSubdomain(sanitized);

    if (sanitized.length > 0 && !/[a-z]/.test(sanitized)) {
      setSubdomainError(
        "Subdomain must contain at least one English letter (a-z).",
      );
    } else if (sanitized.length > 0 && sanitized.length < 2) {
      setSubdomainError("Subdomain must be at least 2 characters long.");
    } else {
      setSubdomainError(null);
    }
  }

  async function handleConnectAccount() {
    if (gitProvider === "custom") return;
    setConnecting(true);
    try {
      const { url } = await api.git.getConnectUrl("github");
      window.location.href = url;
    } catch (err: any) {
      toast(err.message || "Failed to start GitHub connection", "error");
      setConnecting(false);
    }
  }

  async function handleDisconnectAccount(accId: string) {
    const account = accounts.find((a) => a.id === accId);
    if (!account) return;
    try {
      await api.git.disconnect(account.provider, accId);
      toast("Account disconnected", "info");
      setSelectedAccountId("");
      setRepos([]);
      loadAccounts();
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (subdomainError) {
      toast(subdomainError, "error");
      return;
    }

    setDeploying(true);
    setError(null);
    setLog([]);

    try {
      toast("Starting Railpack container build pipeline...", "info");
      await api.deployments.create(
        {
          serviceType,
          repoUrl: gitProvider === "custom" ? customGitUrl : repoUrl,
          branch: branch || "main",
          gitProvider,
          gitAccountId:
            gitProvider !== "custom"
              ? selectedAccountId || undefined
              : undefined,
          gitToken: gitToken.trim() || undefined,
          autoDeploy,
          preferredName,
          customSubdomain: customSubdomain.trim() || undefined,
          internalPort: Number(internalPort),
          startCommand: startCommand.trim() || undefined,
          entryFile: entryFile.trim() || undefined,
          exposureMode: exposureMode || "ssl_with_proxy",
          teamId: selectedScope === "personal" ? null : selectedScope,
        },
        (event: BuildEvent) => {
          if (event.log) setLog((prev) => [...prev, event.log!]);
          else if (event.message) setLog((prev) => [...prev, event.message!]);
          if (event.phase === "error")
            setError(event.message ?? "Deployment failed");
        },
      );
      setRepoUrl("");
      setPreferredName("");
      setGitToken("");
      setCustomSubdomain(generateRandomSubdomain());
      toast("Deployment created & live!", "success");
      onDeployed();
    } catch (err: any) {
      setError(err.message);
      toast("Deployment failed", "error");
    } finally {
      setDeploying(false);
    }
  }

  const providerAccounts = accounts.filter((a) => a.provider === "github");

  return (
    <Card className="border border-white/[0.08] bg-white/[0.01]">
      <h2 className="font-semibold text-base text-text-primary mb-1 flex items-center gap-2">
        <IconGitBranch size={18} className="text-accent-teal" /> Deploy
        Repository (GitHub Integration)
      </h2>
      <p className="text-xs text-text-muted mb-4">
        Connect your GitHub account to pick private repositories, or deploy any
        public Git clone URL directly.
      </p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mb-5">
        <ResourceScopeSelector
          value={selectedScope}
          onChange={setSelectedScope}
        />
      </div>

      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setGitProvider("github");
                setSelectedAccountId("");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                gitProvider === "github"
                  ? "bg-accent-violet/20 border-accent-violet text-white shadow-glow-violet"
                  : "glass text-text-muted hover:text-white"
              }`}
            >
              <IconLock size={14} className="text-accent-violet" /> Private
              GitHub Repository
            </button>
            <button
              type="button"
              onClick={() => {
                setGitProvider("custom");
                setSelectedAccountId("");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                gitProvider === "custom"
                  ? "bg-accent-violet/20 border-accent-violet text-white shadow-glow-violet"
                  : "glass text-text-muted hover:text-white"
              }`}
            >
              <IconGlobe size={14} className="text-accent-teal" /> Public GitHub
              Repository
            </button>
          </div>

          {gitProvider === "github" && (
            <Button
              size="sm"
              onClick={handleConnectAccount}
              loading={connecting}
            >
              + Connect GitHub Account
            </Button>
          )}
        </div>

        {gitProvider === "github" && providerAccounts.length > 0 && (
          <div className="pt-3 border-t border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Select Connected Account ({providerAccounts.length} Connected)
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {providerAccounts.map((acc) => (
                <button
                  type="button"
                  key={acc.id}
                  onClick={() => handleAccountSwitch(acc.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    selectedAccountId === acc.id
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm"
                      : "bg-white/5 border-white/10 text-text-muted hover:text-white"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />@
                  {acc.accountLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {gitProvider === "github" && selectedAccountId && (
          <div className="pt-3 border-t border-white/[0.04]">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
              Choose Repository to Deploy
            </label>
            {loadingRepos ? (
              <Spinner label="Fetching repository list..." />
            ) : repos.length === 0 ? (
              <p className="text-xs text-text-muted">
                No repositories found in this account.
              </p>
            ) : (
              <select
                onChange={(e) => handleSelectRepo(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-accent-violet font-mono"
              >
                <option value="">-- Choose a repository from account --</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.fullName}>
                    {r.fullName} {r.private ? "(Private)" : "(Public)"}
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
            <label className="text-xs font-medium text-text-muted">
              Application Type &amp; Framework
            </label>
            <select
              value={serviceType}
              onChange={(e) => {
                const val = e.target.value;
                setServiceType(val);
                if (val === "lavalink") {
                  setInternalPort("2333");
                  setStartCommand("java -jar Lavalink.jar");
                  setEntryFile("application.yml");
                  setExposureMode("no_ssl");
                } else if (val === "whatsapp_baileys") {
                  setInternalPort("3000");
                  setStartCommand("node index.js");
                  setEntryFile("index.js");
                  setExposureMode("ssl_with_proxy");
                } else if (val === "discordbot_node") {
                  setStartCommand("node index.js");
                  setEntryFile("index.js");
                  setExposureMode("no_ssl");
                } else if (val === "discordbot_python") {
                  setStartCommand("python bot.py");
                  setEntryFile("bot.py");
                  setExposureMode("no_ssl");
                }
              }}
              className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent-violet transition-all"
            >
              {SERVICE_TYPES.map((t) => (
                <option
                  key={t.value}
                  value={t.value}
                  className="bg-bg text-white"
                >
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
            }}
          />
        </div>

        <div>
          <Input
            required
            label="Application Unique Subdomain (Set Once at Creation)"
            placeholder="my-custom-app"
            value={customSubdomain}
            onChange={(e) => handleSubdomainChange(e.target.value)}
            error={subdomainError || undefined}
            hint="Customers can set their subdomain ONCE during creation (a-z, 0-9, dashes, must include at least one letter). Routes at https://<subdomain>.app.shanutechx.com"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            {gitProvider === "custom" ? (
              <Input
                required
                type="url"
                label="Git Repository Clone URL"
                placeholder="https://github.com/public-user/public-repo"
                value={customGitUrl}
                onChange={(e) => setCustomGitUrl(e.target.value)}
                hint="For public repositories — enter clone HTTPS URL."
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
                    ? "Choose a repository from the dropdown above."
                    : "Connect your GitHub account above to pick a repository."
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

        <div className="grid md:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Input
            type="password"
            label="GitHub Access Token (PAT) — Optional"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={gitToken}
            onChange={(e) => setGitToken(e.target.value)}
            hint="Required for private Git repositories if account OAuth is not connected. Encrypted securely."
          />
          <div className="flex flex-col justify-center gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              Continuous Integration &amp; Auto-Deployment
            </label>
            <label className="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-white/10 cursor-pointer hover:border-white/20 transition-all">
              <input
                type="checkbox"
                checked={autoDeploy}
                onChange={(e) => setAutoDeploy(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/60 text-accent-teal focus:ring-0 focus:ring-offset-0"
              />
              <div>
                <span className="text-xs font-semibold text-white block flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ⚡ Auto-Deploy on Push
                </span>
                <span className="text-[11px] text-text-muted block">
                  Rebuild container automatically when new commits hit branch &apos;{branch || "main"}&apos;
                </span>
              </div>
            </label>
          </div>
        </div>

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
              <label className="text-xs font-medium text-text-muted">
                Exposure &amp; SSL Routing Mode
              </label>
              <select
                value={exposureMode}
                onChange={(e) => setExposureMode(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent-violet transition-all"
              >
                {EXPOSURE_MODES.map((m) => (
                  <option
                    key={m.value}
                    value={m.value}
                    className="bg-bg text-white"
                  >
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

        <Button
          type="submit"
          loading={deploying}
          className="w-full justify-center bg-brand-gradient"
        >
          {deploying
            ? "Building Container..."
            : "Deploy Application via Railpack →"}
        </Button>
      </form>

      {log.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Live Railpack Streaming Build Logs
            </p>
            {log.length > 1000 && (
              <p className="text-[10px] text-text-faint">
                Showing last 1000 lines
              </p>
            )}
          </div>
          <pre className="bg-black/80 rounded-xl p-4 text-xs font-mono text-emerald-400 max-h-96 overflow-y-auto whitespace-pre-wrap border border-white/10 shadow-inner">
            {log.slice(-1000).join("\n")}
          </pre>
        </div>
      )}
    </Card>
  );
}

function DeploymentRow({
  deployment,
  onChanged,
}: {
  deployment: Deployment;
  onChanged: () => void;
}) {
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
      const blob = new Blob([data.logs], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deployment-${deployment.id.slice(0, 8)}-logs.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Logs downloaded", "success");
    } catch (err: any) {
      toast("Failed to download logs", "error");
    } finally {
      setDownloadingLogs(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      await api.deployments.stop(deployment.id);
      toast("Deployment stopped successfully", "success");
      onChanged();
    } catch (e: any) {
      toast(e.message || "Failed to stop deployment", "error");
    } finally {
      setStopping(false);
    }
  }

  async function handleRedeploy() {
    setRedeploying(true);
    setRedeployLog([]);
    try {
      toast("Redeployment started...", "info");
      await api.deployments.redeploy(deployment.id, (event) => {
        if (event.log) setRedeployLog((prev) => [...prev, event.log!]);
        else if (event.message)
          setRedeployLog((prev) => [...prev, event.message!]);
      });
      toast("Redeployment finished", "success");
      onChanged();
    } catch (e: any) {
      toast(e.message || "Redeployment failed", "error");
    } finally {
      setRedeploying(false);
    }
  }

  return (
    <Card className="border border-white/[0.06] hover:border-white/12 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-text-primary text-sm font-mono">
              {deployment.subdomain
                ? `${deployment.subdomain}.app.shanutechx.com`
                : (deployment.repoUrl ?? deployment.id)}
            </p>
            {deployment.customDomain && (
              <span className="text-[10px] rounded-full px-2 py-0.5 bg-accent-teal/10 text-accent-teal-bright font-medium">
                {deployment.customDomain}
              </span>
            )}
            {deployment.gitCommitHash && (
              <span className="text-[10px] rounded-full px-2.5 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Git: {deployment.gitCommitHash} {deployment.gitCommitMessage ? `(${deployment.gitCommitMessage})` : ''}
              </span>
            )}
            {deployment.autoDeploy !== undefined && (
              <span className={`text-[10px] rounded-full px-2.5 py-0.5 font-medium flex items-center gap-1 ${deployment.autoDeploy ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-text-muted border border-white/10'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${deployment.autoDeploy ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
                {deployment.autoDeploy ? '⚡ Auto-Deploy Active' : 'Manual Deploy'}
              </span>
            )}
            {deployment.exposureMode && (
              <span
                className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                  deployment.exposureMode === "no_ssl"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {deployment.exposureMode === "no_ssl"
                  ? "Direct TCP (No SSL)"
                  : deployment.exposureMode === "ssl_direct"
                    ? "SSL Direct"
                    : "SSL Proxy"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-text-faint text-xs mt-1 font-mono flex-wrap">
            <span>
              {deployment.node?.label
                ? `Cluster Node: ${deployment.node.label}`
                : "Deploying..."}
            </span>
            {deployment.startCommand && (
              <span className="text-text-muted">
                Cmd:{" "}
                <code className="text-emerald-300">
                  {deployment.startCommand}
                </code>
              </span>
            )}
            {deployment.entryFile && (
              <span className="text-text-muted">
                Entry:{" "}
                <code className="text-cyan-300">{deployment.entryFile}</code>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge status={deployment.status} dot />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/deployments/${deployment.id}`)}
          >
            View Details
          </Button>
          {deployment.containerId && (
            <Button variant="ghost" size="sm" onClick={handleToggleLogs}>
              {showLogs ? "Hide logs" : "View logs"}
            </Button>
          )}
          {deployment.repoUrl && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRedeploy}
              disabled={redeploying}
            >
              {redeploying ? "Redeploying..." : "Redeploy"}
            </Button>
          )}
          {deployment.status === "running" && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              disabled={stopping}
            >
              {stopping ? "Stopping..." : "Stop"}
            </Button>
          )}
        </div>
      </div>

      {showLogs && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
              Application Output Logs
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadLogs}
              loading={downloadingLogs}
            >
              {downloadingLogs ? "Downloading..." : "Download Full Log"}
            </Button>
          </div>
          <pre className="bg-black/60 rounded-xl p-4 text-xs font-mono text-emerald-400 max-h-96 overflow-y-auto whitespace-pre-wrap border border-white/[0.04]">
            {logs
              ? logs.split("\n").slice(-1000).join("\n")
              : "No logs available."}
          </pre>
        </div>
      )}

      {redeployLog.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
              Redeployment Logs
            </p>
          </div>
          <pre className="bg-black/60 rounded-xl p-4 text-xs font-mono text-yellow-400 max-h-96 overflow-y-auto whitespace-pre-wrap border border-white/[0.04]">
            {redeployLog.slice(-1000).join("\n")}
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
