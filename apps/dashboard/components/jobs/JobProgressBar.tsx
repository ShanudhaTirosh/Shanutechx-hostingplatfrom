'use client';

import { useEffect, useState, useRef } from 'react';
import { streamAuthedEvents, StreamHandle } from '@/lib/sse';
import { Badge, Button, ProgressBar, Card } from '@/components/ui';
import { api } from '@/lib/api';

export interface JobProgressData {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: number;
  currentStep?: string;
  logs?: string[];
  log?: string;
  error?: string;
  result?: any;
}

interface JobProgressBarProps {
  jobId: string;
  onComplete?: (result?: any) => void;
  onError?: (err?: string) => void;
  title?: string;
  compact?: boolean;
}

export function JobProgressBar({
  jobId,
  onComplete,
  onError,
  title = 'Infrastructure Operation',
  compact = false,
}: JobProgressBarProps) {
  const [data, setData] = useState<JobProgressData>({
    jobId,
    status: 'queued',
    progress: 0,
    currentStep: 'Initializing...',
    logs: [],
  });
  const [showLogs, setShowLogs] = useState(!compact);
  const [cancelling, setCancelling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let streamHandle: StreamHandle | null = null;

    const connectStream = () => {
      streamHandle = streamAuthedEvents(
        `/api/jobs/${jobId}/stream`,
        (rawJson) => {
          try {
            const parsed = JSON.parse(rawJson);
            setData((prev) => {
              const newLogs = prev.logs ? [...prev.logs] : [];
              if (parsed.log && !newLogs.includes(parsed.log)) {
                newLogs.push(parsed.log);
              } else if (Array.isArray(parsed.logs)) {
                return { ...prev, ...parsed };
              }
              return {
                ...prev,
                ...parsed,
                logs: newLogs,
              };
            });

            if (parsed.status === 'succeeded') {
              onComplete?.(parsed.result);
            } else if (parsed.status === 'failed') {
              onError?.(parsed.error);
            }
          } catch {
            // raw string or parse error
          }
        },
        (err) => {
          // Fallback to polling if SSE encounters error
          api.get(`/api/jobs/${jobId}`).then((res: any) => {
            if (res.job) {
              setData(res.job);
              if (res.job.status === 'succeeded') onComplete?.(res.job.result);
              if (res.job.status === 'failed') onError?.(res.job.error);
            }
          }).catch(() => {});
        }
      );
    };

    connectStream();

    return () => {
      streamHandle?.close();
    };
  }, [jobId]);

  useEffect(() => {
    if (showLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data.logs, showLogs]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/api/jobs/${jobId}/cancel`, {});
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = () => {
    switch (data.status) {
      case 'succeeded':
        return <Badge status="active" dot className="uppercase text-[10px]" />;
      case 'running':
        return <Badge status="building" dot className="uppercase text-[10px]" />;
      case 'failed':
        return <Badge status="failed" dot className="uppercase text-[10px]" />;
      case 'cancelled':
        return <Badge status="cancelled" dot className="uppercase text-[10px]" />;
      default:
        return <Badge status="pending" dot className="uppercase text-[10px]" />;
    }
  };

  return (
    <Card className="p-4 space-y-3 bg-surface-raised border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-text-primary">{title}</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          {data.status === 'running' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs text-danger hover:border-danger"
            >
              {cancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            {showLogs ? 'Hide Logs' : 'View Logs'}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <ProgressBar
          value={data.progress}
          color={data.status === 'failed' ? 'danger' : data.status === 'succeeded' ? 'success' : 'accent'}
        />
        <div className="flex justify-between items-center text-xs text-text-muted">
          <span>{data.currentStep || 'In progress...'}</span>
          <span>{data.progress}%</span>
        </div>
      </div>

      {data.error && (
        <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-mono">
          {data.error}
        </div>
      )}

      {showLogs && data.logs && data.logs.length > 0 && (
        <div className="mt-2 p-3 rounded-lg bg-black/60 border border-white/5 font-mono text-xs text-text-muted max-h-48 overflow-y-auto space-y-1">
          {data.logs.map((log, index) => (
            <div key={index} className="leading-relaxed whitespace-pre-wrap">
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}
    </Card>
  );
}
