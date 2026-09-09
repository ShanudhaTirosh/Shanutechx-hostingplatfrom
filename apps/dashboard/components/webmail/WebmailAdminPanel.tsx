'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import {
  ShieldCheck,
  BarChart2,
  Server,
  Users,
  AlertTriangle,
  RefreshCw,
  Cpu,
  HardDrive,
  Activity,
  Globe,
  Mail,
  Archive,
  Lock,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface MailStats {
  totalMailboxes?: number;
  totalDelivered?: number;
  totalBounced?: number;
  totalSpam?: number;
  queueSize?: number;
  deliveryRate?: number;
  avgDeliveryMs?: number;
}

interface SystemStats {
  uptime?: string;
  cpuPercent?: number;
  memoryMb?: number;
  diskMb?: number;
}

export function WebmailAdminPanel() {
  const [mailStats, setMailStats] = useState<MailStats | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dkimStatus, setDkimStatus] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [stats, sys] = await Promise.allSettled([
        api.webmail.adminStats(),
        api.webmail.adminSystemStats(),
      ]);
      if (stats.status === 'fulfilled') setMailStats(stats.value?.stats || stats.value || {});
      if (sys.status === 'fulfilled') setSystemStats(sys.value?.system || sys.value || {});
    } catch {}
    setLoading(false);
  };

  const handleRunDnsCheck = async () => {
    try {
      const res = await api.webmail.adminDnsCheck();
      const checks = res?.checks || {};
      setDkimStatus(checks);
      toast('DNS health check completed', 'success');
    } catch {
      toast('DNS check failed — ensure API is running', 'error');
    }
  };

  const handleFlushQueue = async () => {
    try {
      await api.webmail.adminFlushQueue();
      toast('Mail queue flushed', 'success');
      void fetchAll();
    } catch {
      toast('Queue flush failed', 'error');
    }
  };

  const stat = (label: string, value: string | number | undefined, icon: React.ReactNode, color: string) => (
    <div className={`p-5 rounded-2xl border ${color} bg-slate-950/60 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        {icon}
      </div>
      <span className="text-2xl font-extrabold text-white">{value ?? '—'}</span>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#0f0f13] text-white space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-400" />
            Webmail Admin Panel
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry, queue management, and DNS health for this SMTP domain.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:border-violet-500/50 rounded-2xl text-xs font-bold text-slate-200 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Mail delivery stats */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-violet-400" />
          Mail Delivery Metrics
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stat('Mailboxes', mailStats?.totalMailboxes, <Mail className="h-4 w-4 text-indigo-400" />, 'border-indigo-500/20')}
          {stat('Delivered (24h)', mailStats?.totalDelivered, <CheckCircle2 className="h-4 w-4 text-green-400" />, 'border-green-500/20')}
          {stat('Bounced (24h)', mailStats?.totalBounced, <XCircle className="h-4 w-4 text-rose-400" />, 'border-rose-500/20')}
          {stat('Spam Caught', mailStats?.totalSpam, <AlertTriangle className="h-4 w-4 text-amber-400" />, 'border-amber-500/20')}
          {stat('Queue Depth', mailStats?.queueSize, <Archive className="h-4 w-4 text-blue-400" />, 'border-blue-500/20')}
          {stat('Delivery Rate', mailStats?.deliveryRate !== undefined ? `${mailStats.deliveryRate}%` : undefined, <Zap className="h-4 w-4 text-emerald-400" />, 'border-emerald-500/20')}
          {stat('Avg Delivery', mailStats?.avgDeliveryMs !== undefined ? `${mailStats.avgDeliveryMs}ms` : undefined, <Activity className="h-4 w-4 text-violet-400" />, 'border-violet-500/20')}
        </div>
      </section>

      {/* System stats */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Server className="h-4 w-4 text-violet-400" />
          System Resources (SMTP Node)
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stat('Uptime', systemStats?.uptime, <Activity className="h-4 w-4 text-green-400" />, 'border-green-500/20')}
          {stat('CPU Usage', systemStats?.cpuPercent !== undefined ? `${systemStats.cpuPercent}%` : undefined, <Cpu className="h-4 w-4 text-amber-400" />, 'border-amber-500/20')}
          {stat('RAM Used', systemStats?.memoryMb !== undefined ? `${systemStats.memoryMb} MB` : undefined, <Server className="h-4 w-4 text-blue-400" />, 'border-blue-500/20')}
          {stat('Disk Used', systemStats?.diskMb !== undefined ? `${systemStats.diskMb} MB` : undefined, <HardDrive className="h-4 w-4 text-purple-400" />, 'border-purple-500/20')}
        </div>
      </section>

      {/* Queue management + DNS check */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Globe className="h-4 w-4 text-violet-400" />
          Operations
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* DNS Health Card */}
          <div className="p-5 rounded-2xl border border-white/5 bg-slate-950/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="h-4 w-4 text-indigo-400" />
                  DNS / Authentication Health
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Verify SPF, DKIM, and DMARC records for all managed domains.
                </p>
              </div>
              <button
                onClick={handleRunDnsCheck}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" />
                Run Check
              </button>
            </div>
            {Object.keys(dkimStatus).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(dkimStatus).map(([domain, ok]) => (
                  <div
                    key={domain}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                      ok
                        ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                    }`}
                  >
                    <span className="font-mono">{domain}</span>
                    <span className="flex items-center gap-1 font-bold">
                      {ok ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Pass</>
                      ) : (
                        <><XCircle className="h-3.5 w-3.5" /> Fail</>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Queue Management */}
          <div className="p-5 rounded-2xl border border-white/5 bg-slate-950/80 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Archive className="h-4 w-4 text-amber-400" />
                Mail Queue
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Force-process deferred messages. Useful after provider outages or MX record fixes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-mono">
                Queue depth: {mailStats?.queueSize ?? '?'} messages
              </div>
              <button
                onClick={handleFlushQueue}
                className="px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                Flush
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Accounts overview */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-400" />
          Quick Links
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/admin/email-accounts', icon: <Mail className="h-4 w-4 text-indigo-400" />, label: 'Manage Mailboxes', desc: 'Create, suspend, or delete mailboxes' },
            { href: '/admin/customers', icon: <Users className="h-4 w-4 text-violet-400" />, label: 'Customer Accounts', desc: 'View and manage customer subscriptions' },
            { href: '/admin/services', icon: <Server className="h-4 w-4 text-green-400" />, label: 'Active Services', desc: 'Monitor all running email services' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="p-4 rounded-2xl border border-white/5 bg-slate-950/60 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                {link.icon}
                <span className="text-xs font-bold text-white group-hover:text-violet-300 transition-all">
                  {link.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{link.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

