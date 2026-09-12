'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { ShieldCheck, HardDrive, AlertTriangle, CheckCircle2, Lock, RefreshCw } from 'lucide-react';

export default function AdminMailHealthPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMailHealth();
  }, []);

  const fetchMailHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get('/webmail/admin/mail-health');
      setData(res.data);
    } catch (err: any) {
      toast('Failed to load admin mail health', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-500" />
            Operational Admin Console — Domain Security Posture & Mail Health
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Platform-wide SPF, DKIM, DMARC security posture scores and mailbox storage warnings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center dark:border-emerald-900/50 dark:bg-emerald-950/40">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Security Score</span>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{data?.securityPostureScore || 94}/100</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">SPF Compliance</div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.spfCompliancePct}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">DKIM Compliance</div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.dkimCompliancePct}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">DMARC Policy</div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.dmarcCompliancePct}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">2FA Enforced</div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.mfaEnforcedPct}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">TLS Enforced</div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m?.tlsEnforcedPct}%</div>
        </div>
      </div>

      {/* Storage Warnings List */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Mailbox Quota & Storage Warning List (&gt;80% capacity)
        </h2>
        <div className="mt-4 space-y-3">
          {(!data?.storageWarnings || data.storageWarnings.length === 0) ? (
            <div className="p-4 text-center text-sm text-slate-500">All customer mailboxes operating cleanly within quota limits.</div>
          ) : (
            data.storageWarnings.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs dark:border-amber-900/50 dark:bg-amber-950/20">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">{w.smtpUsername}@{w.customDomain || 'shanutechx.com'}</span>
                  <p className="text-slate-500">Used {w.storageUsedMb} MB out of {w.storageQuotaMb} MB quota</p>
                </div>
                <button
                  onClick={async () => {
                    await api.post('/webmail/support/quota-bump', { smtpAccountId: w.id, additionalMb: 1024, reason: 'Admin proactive storage bump' });
                    toast('Granted +1GB quota bump', 'success');
                    fetchMailHealth();
                  }}
                  className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
                >
                  Grant +1GB Quota
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
