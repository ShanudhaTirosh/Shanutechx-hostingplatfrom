'use client';

import { Card, Button, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Dev/admin-only. Links to Grafana Explore with the Loki datasource
 * pre-selected, rather than building a bespoke log viewer — Grafana
 * Explore's LogQL query bar already does exactly this well. Set
 * NEXT_PUBLIC_GRAFANA_URL to enable (same env var as the Monitoring page).
 *
 * HONEST STATUS: same caveat as Monitoring — the Loki/Promtail pipeline is
 * real config, written but not run/verified against a live Docker daemon
 * in this sandbox. Confirm logs are actually flowing into Loki (Grafana
 * Explore should show container log lines within a few seconds of
 * deploying) before relying on this page.
 */
export default function LogsPage() {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
  const exploreUrl = grafanaUrl
    ? `${grafanaUrl}/explore?left=${encodeURIComponent(
        JSON.stringify({ datasource: 'Loki', queries: [{ expr: '{container=~".+"}' }], range: { from: 'now-1h', to: 'now' } })
      )}`
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Logs"
        description="Every container's logs, searchable via LogQL through Loki + Grafana Explore. Dev/admin only."
        action={
          exploreUrl ? (
            <a href={exploreUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">Open in Grafana Explore</Button>
            </a>
          ) : undefined
        }
      />

      {!grafanaUrl ? (
        <Card className="border border-white/[0.06]">
          <p className="text-sm text-text-primary font-medium mb-1">Log search isn't linked yet</p>
          <p className="text-xs text-text-muted mb-3">
            Deploy the observability stack (Loki + Promtail ship every container's Docker logs
            automatically) and set <code className="font-mono">NEXT_PUBLIC_GRAFANA_URL</code> to enable this page.
            Once it's up, filter by container name in Grafana Explore, e.g.{' '}
            <code className="font-mono">{'{container="shanutechx-api"}'}</code>.
          </p>
        </Card>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height: '80vh' }}>
          <iframe src={exploreUrl ?? undefined} className="w-full h-full" title="ShanuTechX Log Explorer" />
        </div>
      )}
    </div>
  );
}
