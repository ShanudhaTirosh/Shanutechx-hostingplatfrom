'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Card,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Edge Ingress & Reverse Proxy Status Panel
 * Real-time telemetry for edge routers, TLS certificates, and HTTP/HTTPS load-balancer backends.
 */
export default function ReverseProxyPage() {
  const [routers, setRouters] = useState<any[] | null>(null);
  const [services, setServices] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.traefik.routers().then((d) => setRouters(d.routers)).catch((err) => setError(err.message));
    api.traefik.services().then((d) => setServices(d.services)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Edge Ingress & Reverse Proxy"
        description="Monitor real-time edge routing rules, ingress SSL certificates, load-balancer backends, and domain gateway metrics across the cluster."
      />

      {error && (
        <ErrorBanner message={`${error} — this page needs Traefik's API reachable at TRAEFIK_API_URL from the API server.`} />
      )}

      {routers === null && !error && <Spinner label="Loading routers from Traefik..." />}
      {routers?.length === 0 && <EmptyState message="No routers currently registered with Traefik." />}

      <div className="space-y-2">
        {routers?.map((r: any) => {
          const service = services?.find((s: any) => s.name === r.service);
          return (
            <Card key={r.name} className="border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-sm text-text-primary truncate">{r.name}</p>
                <Badge status={r.status === 'enabled' ? 'running' : r.status} />
              </div>
              <p className="text-xs text-text-muted font-mono truncate">{r.rule}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-text-faint">
                <span>Entry points: {(r.entryPoints || []).join(', ')}</span>
                {service?.loadBalancer?.servers?.[0]?.url && (
                  <span>→ {service.loadBalancer.servers[0].url}</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
