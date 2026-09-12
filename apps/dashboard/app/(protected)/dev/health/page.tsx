'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Activity, Server, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

interface ServiceHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'operational';
  latencyMs: number;
  version: string;
}

export default function DevHealthMatrixPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [overallStatus, setOverallStatus] = useState('healthy');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get('/webmail/dev/health');
      if (res.data?.services) {
        setServices(res.data.services);
        setOverallStatus(res.data.overallStatus || 'healthy');
      }
    } catch (err: any) {
      toast('Failed to load system health matrix', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-emerald-500" />
            Developer Master Control — 10-Service System Health Matrix
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time status monitoring, build versions, and latency sparklines for core platform services.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Health
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="h-4 w-4 text-indigo-500" />
                {s.name}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {s.status}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Latency: <strong className="text-slate-900 dark:text-white">{s.latencyMs}ms</strong></span>
              <span>Version: <strong className="text-slate-900 dark:text-white">{s.version}</strong></span>
            </div>

            <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(10, 100 - s.latencyMs)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
