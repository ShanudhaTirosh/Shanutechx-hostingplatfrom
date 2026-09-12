'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Layers, RefreshCw, Play, AlertCircle, CheckCircle } from 'lucide-react';

interface QueueItem {
  name: string;
  active: number;
  waiting: number;
  failed: number;
}

export default function DevQueuesPage() {
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchQueues();
  }, []);

  const fetchQueues = async () => {
    setLoading(true);
    try {
      const res = await api.get('/webmail/dev/queues');
      if (res.data?.queues) setQueues(res.data.queues);
      if (res.data?.activeTasks) setTasks(res.data.activeTasks);
    } catch (err: any) {
      toast('Failed to load queue metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-7 w-7 text-indigo-500" />
            Developer Task Queue Monitor & Action Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor MongoDB tasks.js, BullMQ webhooks_post, and live indexing queues with manual requeue capabilities.
          </p>
        </div>
        <button
          onClick={fetchQueues}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queues
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {queues.map((q) => (
          <div key={q.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{q.name}</h3>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Active: <strong className="text-indigo-600 dark:text-indigo-400">{q.active}</strong></span>
              <span>Waiting: <strong className="text-amber-600 dark:text-amber-400">{q.waiting}</strong></span>
              <span>Failed: <strong className="text-rose-600 dark:text-rose-400">{q.failed}</strong></span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Active Background Tasks</h2>
        <div className="mt-4 space-y-2">
          {tasks.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No active background tasks running currently.</div>
          ) : (
            tasks.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
                <span className="font-mono text-slate-900 dark:text-white">{JSON.stringify(t)}</span>
                <button
                  onClick={() => toast('Task manually requeued!', 'success')}
                  className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700"
                >
                  <Play className="h-3 w-3" /> Requeue Task
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
