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
import { Zap, Lock, Globe } from "lucide-react";
import { DomainManagement } from "@/components/DomainManagement";

import { useAppUser } from "@/lib/AppUserContext";
import Link from "next/link";
import { VercelDeployModal } from "@/components/VercelDeployModal";

export const dynamic = "force-dynamic";

export default function DeploymentsPage() {
  const { apiUser } = useAppUser();
  const [deployments, setDeployments] = useState<Deployment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
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
        description="Manage your active Web Hosting, Bot Hosting, and Application Instances. Configure GitHub auto-deployments, custom domains, and live container operations."
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDeployModal(true)}
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-lg shadow-white/10 cursor-pointer"
            >
              <Zap size={14} />
              <span>+ New Deployment</span>
            </button>
            <Link href="/catalog">
              <Button size="sm" variant="secondary">
                1-Click App Catalog
              </Button>
            </Link>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Vercel-Style Instant Git & Public Repo Deployment Modal */}
      <VercelDeployModal
        isOpen={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        onDeployed={load}
      />

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
            <div className="h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto mb-4 border border-white/10">
              <IconGitBranch size={24} />
            </div>
            <h3 className="font-semibold text-base text-white mb-2">No Active Hosting Instances Found</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto mb-6">
              Connect a GitHub repository or paste any public Git URL to launch a web application or bot in seconds.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeployModal(true)}
                className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-lg shadow-white/10 cursor-pointer"
              >
                <Zap size={14} />
                <span>+ Deploy with Git</span>
              </button>
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
        if (event.log) setRedeployLog((prev) => [...prev, event.log!].slice(-1000));
        else if (event.message)
          setRedeployLog((prev) => [...prev, event.message!].slice(-1000));
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
              <span className="text-[10px] rounded-full px-2.5 py-0.5 bg-white/10 text-white border border-white/15 font-mono flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Git: {deployment.gitCommitHash} {deployment.gitCommitMessage ? `(${deployment.gitCommitMessage})` : ''}
              </span>
            )}
            {deployment.autoDeploy !== undefined && (
              <span className={`text-[10px] rounded-full px-2.5 py-0.5 font-medium flex items-center gap-1 ${deployment.autoDeploy ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-text-muted border border-white/10'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${deployment.autoDeploy ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'}`} />
                {deployment.autoDeploy ? 'Auto-Deploy Active' : 'Manual Deploy'}
              </span>
            )}
            {deployment.exposureMode && (
              <span
                className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                  deployment.exposureMode === "internal_only"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : deployment.exposureMode === "no_ssl" || deployment.exposureMode === "raw_tcp"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {deployment.exposureMode === "internal_only"
                  ? "Internal Only (No Ports)"
                  : deployment.exposureMode === "raw_tcp"
                    ? "Raw TCP Direct"
                    : deployment.exposureMode === "no_ssl"
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
