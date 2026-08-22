'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  useToast,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

interface BackupRun {
  id: string;
  triggeredBy: string;
  success: boolean;
  r2Key: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * Dev-only: history + manual trigger for the platform's own database backup
 * (see apps/api/src/lib/backup.ts — even/odd day rotation to Cloudflare R2).
 * The backup job itself already existed; this page is the missing UI.
 */
export default function DevBackupsPage() {
  const [runs, setRuns] = useState<BackupRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  function load() {
    api.backups
      .history()
      .then((data) => setRuns(data.runs))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleRunNow() {
    setRunning(true);
    try {
      const result = await api.backups.run();
      toast(`Backup complete — ${formatBytes(result.sizeBytes)} uploaded to ${result.key}.`, 'success');
      load();
    } catch (err: any) {
      toast(err.message || 'Backup failed', 'error');
      load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Database Backups"
        description="Platform Postgres → Cloudflare R2, even/odd day rotation (at most two backups retained at any time). Dev-only."
        action={<Button onClick={handleRunNow} loading={running}>Run Backup Now</Button>}
      />

      {error && <ErrorBanner message={error} />}
      {runs === null && <Spinner label="Loading backup history..." />}
      {runs?.length === 0 && (
        <EmptyState message="No backups have run yet. Click 'Run Backup Now' to trigger the first one, or wait for the daily cron." />
      )}

      <div className="space-y-2">
        {runs?.map((run) => (
          <Card key={run.id} className="border border-white/[0.06] flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge status={run.success ? 'running' : 'failed'} />
                <span className="text-xs text-text-muted">
                  {run.triggeredBy === 'cron' ? 'Scheduled (cron)' : 'Manual trigger'}
                </span>
              </div>
              <p className="text-xs text-text-faint">
                {new Date(run.createdAt).toLocaleString()}
                {run.r2Key && <span className="font-mono ml-2 text-text-primary">{run.r2Key}</span>}
              </p>
              {run.error && <p className="text-xs text-red-400 mt-1">{run.error}</p>}
            </div>
            <div className="text-right text-xs text-text-muted shrink-0 ml-4">
              <p>{formatBytes(run.sizeBytes)}</p>
              <p>{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
