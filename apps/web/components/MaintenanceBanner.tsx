'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, X } from 'lucide-react';

interface MaintenanceBannerProps {
  pageName?: string;
}

export default function MaintenanceBanner({ pageName }: MaintenanceBannerProps) {
  const [maintenance, setMaintenance] = useState<{
    title: string;
    description: string;
    scheduledEnd?: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const apiBase = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${apiBase}/api/status/public`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (Array.isArray(data.scheduledMaintenances) && data.scheduledMaintenances.length > 0) {
          const activeMaint = data.scheduledMaintenances.find(
            (m: any) => m.status === 'in_progress' || m.status === 'scheduled'
          );
          if (activeMaint) {
            setMaintenance({
              title: activeMaint.title,
              description: activeMaint.description,
              scheduledEnd: activeMaint.scheduledEnd,
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!maintenance || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/90 via-purple-950/90 to-amber-950/90 border-b border-amber-500/30 text-white text-xs px-4 py-2.5 backdrop-blur-xl relative z-50 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3 max-w-7xl mx-auto w-full">
        <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
          <p className="font-semibold text-slate-200">
            <span className="text-amber-400 font-bold uppercase tracking-wide">
              {pageName ? `${pageName} Maintenance Notice:` : 'Maintenance Notice:'}
            </span>{' '}
            {maintenance.title} &mdash; {maintenance.description}
          </p>
          <Link
            href="/status"
            className="text-purple-300 font-bold hover:underline shrink-0 flex items-center gap-1 font-mono text-[11px]"
          >
            <Clock className="h-3 w-3" /> Check Live Telemetry →
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors ml-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
