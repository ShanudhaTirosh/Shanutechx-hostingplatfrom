'use client';

import React from 'react';

interface ServiceHealthBarProps {
  services: {
    kong: string;
    gotrue: string;
    postgrest: string;
    postgres: string;
    storage: string;
    realtime: string;
    functions: string;
    studio: string;
  };
}

const SERVICE_LABELS: Record<string, string> = {
  kong: 'API Gateway (Kong)',
  gotrue: 'Auth (GoTrue)',
  postgrest: 'REST (PostgREST)',
  postgres: 'Database (PG 17)',
  storage: 'Storage API',
  realtime: 'Realtime WS',
  functions: 'Edge Functions',
  studio: 'Studio Dashboard',
};

export function ServiceHealthBar({ services }: ServiceHealthBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Object.entries(services).map(([key, status]) => {
        const isHealthy = status === 'healthy';
        return (
          <div
            key={key}
            className="glass rounded-xl p-3 border border-white/[0.06] flex items-center justify-between transition-all hover:bg-white/[0.04]"
          >
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-text-primary truncate">{SERVICE_LABELS[key] || key}</p>
              <p className="text-[10px] text-text-muted capitalize">{status}</p>
            </div>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {isHealthy && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
