'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { TrendingUp, HardDrive, Users, RefreshCw } from 'lucide-react';

export default function AdminMailGrowthPage() {
  const [growthData, setGrowthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchGrowth();
  }, []);

  const fetchGrowth = async () => {
    setLoading(true);
    try {
      const res = await api.get('/webmail/admin/mail-growth');
      setGrowthData(res.data?.growth);
    } catch (err: any) {
      toast('Failed to load growth metrics', 'error');
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

  const topConsumers = growthData?.topStorageConsumers || [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-indigo-500" />
            Operational Admin Console — SaaS Mail Usage & Growth Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Daily email flow volumes, subscription growth trendlines, and top storage consumers.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-indigo-500" />
          Top 10 Storage Consumer Mailboxes
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <th className="p-3">Mailbox</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Used Storage</th>
                <th className="p-3">Quota</th>
                <th className="p-3">Usage Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topConsumers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">No storage data available.</td>
                </tr>
              ) : (
                topConsumers.map((item: any) => (
                  <tr key={item.id}>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      {item.smtpUsername}@{item.customDomain || 'shanutechx.com'}
                    </td>
                    <td className="p-3 text-slate-500">{item.user?.email || 'System Account'}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">{(item.storageUsedMb / 1024).toFixed(2)} GB</td>
                    <td className="p-3 text-slate-500">{(item.storageQuotaMb / 1024).toFixed(1)} GB</td>
                    <td className="p-3 w-48">
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-indigo-600"
                          style={{ width: `${Math.min(100, (item.storageUsedMb / item.storageQuotaMb) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
