import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Spinner, useToast } from '@/components/ui';
import { AlertTriangle, GitBranch, GitPullRequest, Check, Copy } from 'lucide-react';

interface Props {
  deploymentId: string;
  apiBase?: string;
}

export function DeployWebhookPanel({ deploymentId, apiBase = '' }: Props) {
  const [info, setInfo] = useState<{
    webhookUrl: string;
    hasSecret: boolean;
    repoUrl: string | null;
    instructions: { github: string; gitlab: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSecret, setGeneratingSecret] = useState(false);
  const [revokingSecret, setRevokingSecret] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const { toast } = useToast();

  const fullWebhookUrl = info ? `${apiBase}${info.webhookUrl}` : '';

  async function loadInfo() {
    try {
      const data = await api.deployments.webhookInfo(deploymentId);
      setInfo(data);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInfo(); }, [deploymentId]);

  async function handleGenerateSecret() {
    setGeneratingSecret(true);
    setRevealedSecret(null);
    try {
      const data = await api.deployments.enableDeployWebhook(deploymentId);
      setRevealedSecret(data.secret);
      toast('Webhook secret generated! Copy it now — it will not be shown again.', 'info');
      loadInfo();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setGeneratingSecret(false);
    }
  }

  async function handleRevokeSecret() {
    setRevokingSecret(true);
    try {
      await api.deployments.disableDeployWebhook(deploymentId);
      setRevealedSecret(null);
      toast('Auto-deploy webhook disabled.', 'info');
      loadInfo();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setRevokingSecret(false);
    }
  }

  function copyToClipboard(text: string, which: 'url' | 'secret') {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'url') { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }
      else { setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }
    });
  }

  if (loading) return <Spinner label="Loading webhook status..." />;

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${
        info?.hasSecret
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
          : 'bg-white/[0.03] border-white/10 text-text-muted'
      }`}>
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${info?.hasSecret ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
        <div className="flex-1">
          <p className="text-xs font-semibold">
            {info?.hasSecret ? 'Auto-Deploy is Active' : 'Auto-Deploy is Disabled'}
          </p>
          <p className="text-[11px] opacity-70 mt-0.5">
            {info?.hasSecret
              ? 'Any push to the tracked branch will automatically rebuild and redeploy this application.'
              : 'Enable auto-deploy below to rebuild this app on every git push.'}
          </p>
        </div>
        {info?.hasSecret ? (
          <Button size="sm" variant="danger" onClick={handleRevokeSecret} loading={revokingSecret}>
            Disable
          </Button>
        ) : (
          <Button size="sm" onClick={handleGenerateSecret} loading={generatingSecret}>
            Enable Auto-Deploy
          </Button>
        )}
      </div>

      {/* Webhook URL */}
      {info?.hasSecret && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">Webhook Payload URL</label>
          <div className="flex gap-2">
            <code className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono truncate">
              {fullWebhookUrl || info.webhookUrl}
            </code>
            <Button size="sm" variant="secondary" onClick={() => copyToClipboard(fullWebhookUrl || info.webhookUrl, 'url')}>
              {copiedUrl ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Copied!</span> : <span className="flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copy</span>}
            </Button>
          </div>
        </div>
      )}

      {/* Revealed Secret (one-time) */}
      {revealedSecret && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/25 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <p className="text-xs font-semibold text-yellow-300">Copy your webhook secret now — it won't be shown again!</p>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-yellow-300 font-mono truncate">
              {revealedSecret}
            </code>
            <Button size="sm" onClick={() => copyToClipboard(revealedSecret, 'secret')}>
              {copiedSecret ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Copied!</span> : <span className="flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copy Secret</span>}
            </Button>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      {info?.hasSecret && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">Setup Instructions</label>
          <div className="space-y-2">
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-all text-xs text-text-primary font-medium">
                <GitBranch className="h-3.5 w-3.5 text-accent-violet" /> GitHub Webhook Setup
              </summary>
              <div className="mt-2 p-3 bg-black/30 rounded-xl border border-white/[0.04] text-xs text-text-muted leading-relaxed">
                {info.instructions.github}
              </div>
            </details>
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-all text-xs text-text-primary font-medium">
                <GitPullRequest className="h-3.5 w-3.5 text-accent-cyan" /> GitLab Webhook Setup
              </summary>
              <div className="mt-2 p-3 bg-black/30 rounded-xl border border-white/[0.04] text-xs text-text-muted leading-relaxed">
                {info.instructions.gitlab}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
