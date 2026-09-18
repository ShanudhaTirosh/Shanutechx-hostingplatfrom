'use client';

import { Card, Button, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Dev/admin-only. Rather than reinvent Prometheus/Grafana's charting inside
 * ShanuTechX's own UI, this links to (and optionally iframes) the real
 * Grafana instance from infra/control-plane/observability/. Set
 * NEXT_PUBLIC_GRAFANA_URL to enable it — same pattern as the Webmail page's
 * NEXT_PUBLIC_WILDDUCK_ADMIN_URL link.
 *
 * HONEST STATUS: the observability stack (Prometheus/Grafana/Loki/Promtail)
 * is real infra-as-code written for this project, but has not been run or
 * verified in this sandbox — no Docker daemon available there. Deploy
 * infra/control-plane/observability/docker-compose.observability.yml and
 * confirm the "ShanuTechX Overview" dashboard is populated before relying
 * on this page showing real data.
 */
export default function MonitoringPage() {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
  const dashboardUrl = grafanaUrl ? `${grafanaUrl}/d/shanutechx-overview` : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Monitoring"
        description="Request rate, latency, and business metrics via Prometheus + Grafana. Dev/admin only."
        action={
          dashboardUrl ? (
            <a href={dashboardUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">Open in Grafana</Button>
            </a>
          ) : undefined
        }
      />

      {!grafanaUrl ? (
        <Card className="border border-white/[0.06]">
          <p className="text-sm text-text-primary font-medium mb-1">Grafana isn't linked yet</p>
          <p className="text-xs text-text-muted mb-3">
            Deploy the observability stack (
            <code className="font-mono">infra/control-plane/observability/docker-compose.observability.yml</code>
            ) and set <code className="font-mono">NEXT_PUBLIC_GRAFANA_URL</code> to your Grafana instance's URL to
            enable this page. A starter "ShanuTechX Overview" dashboard (request rate, p95 latency, active
            deployments, pending payment reviews, open tickets) is pre-provisioned once Grafana starts.
          </p>
        </Card>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height: '80vh' }}>
          <iframe
            src={`${dashboardUrl}?orgId=1&kiosk`}
            className="w-full h-full"
            title="ShanuTechX Grafana Dashboard"
          />
        </div>
      )}
    </div>
  );
}
