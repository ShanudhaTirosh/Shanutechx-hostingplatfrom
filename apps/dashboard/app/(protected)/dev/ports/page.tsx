'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, PortIssueUi, PortsOverview } from '@/lib/api';
import { Button, Card, ConfirmDialog, Spinner, useToast } from '@/components/ui';

export const dynamic = 'force-dynamic';

type NodeBlock = PortsOverview['nodes'][number];
type ExposureRow = NodeBlock['exposures'][number];

const MODE_LABEL = { proxied: 'Proxied (HTTPS)', direct_port: 'Direct port', internal: 'Internal only' } as const;

const clean = (message: string) => message.replace(/^"|"$/g, '');

function IssueList({ issues }: { issues: PortIssueUi[] }) {
  if (!issues.length) return null;
  return (
    <ul className="mt-1 space-y-1">
      {issues.map((i) => (
        <li
          key={i.code + i.message}
          className={`rounded-lg border px-2 py-1 text-[11px] ${
            i.severity === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : i.severity === 'warning'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-white/10 bg-white/[0.03] text-text-muted'
          }`}
        >
          {i.message}
        </li>
      ))}
    </ul>
  );
}

export default function DevPortsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PortsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<{ nodeId: string; exposure: ExposureRow } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.portsOverview());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? clean(err.message) : 'Could not load the ports overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ConfirmDialog does not catch errors thrown by onConfirm, so this handles its own.
  async function closeExposure() {
    if (!closing) return;
    try {
      const res = await api.delete<{ ok: boolean; dnsRecordDeleted: boolean; dnsSkippedReason?: string }>(`/api/nodes/${closing.nodeId}/ports/exposures/${closing.exposure.id}`);
      toast(res.dnsSkippedReason ? `Closed. ${res.dnsSkippedReason}` : 'Closed and its DNS record removed.', res.dnsSkippedReason ? 'info' : 'success');
      await load();
    } catch (err) {
      toast(err instanceof ApiError || err instanceof Error ? clean(err.message) : 'Could not close the exposure.', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Exposed ports</h1>
          <p className="text-sm text-text-muted">What is reachable on each node, how, and what is wrong with it. Change a deployment&apos;s exposure from its Routing tab.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()} loading={loading}>
          Refresh
        </Button>
      </div>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {loading && !data && <Spinner label="Loading ports..." />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              ['Nodes', data.summary.nodes],
              ['Deployments', data.summary.deployments],
              ['Direct ports', data.summary.directPorts],
              ['Node exposures', data.summary.nodeExposures],
              ['Errors', data.summary.errors],
              ['Warnings', data.summary.warnings],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
                <div className={`text-xl font-semibold ${label === 'Errors' && (value as number) > 0 ? 'text-red-300' : label === 'Warnings' && (value as number) > 0 ? 'text-amber-200' : 'text-white'}`}>{value}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted">Ports the platform reserves and will refuse to publish: {data.reservedPorts.join(', ')}.</p>

          {data.nodes.map((n) => (
            <Card key={n.node.id} title={`${n.node.label} (${n.node.ip})`} description={n.node.isActive ? 'Active' : 'Inactive'}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Deployments</h3>
              {n.deployments.length === 0 ? (
                <p className="mb-4 text-xs text-text-muted">No deployments on this node.</p>
              ) : (
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 font-mono uppercase text-text-muted">
                      <tr>
                        <th className="p-2">Deployment</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2">Reachable at</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {n.deployments.map((d) => (
                        <tr key={d.id} className="align-top">
                          <td className="p-2">
                            <Link href={`/deployments/${d.id}`} className="text-accent-cyan hover:underline">
                              {d.subdomain ?? d.id}
                            </Link>
                            {d.isPreview && <span className="ml-2 text-[10px] text-text-muted">preview</span>}
                            <IssueList issues={d.issues} />
                          </td>
                          <td className="p-2 font-mono">{d.status}</td>
                          <td className="p-2">{MODE_LABEL[d.mode]}</td>
                          <td className="p-2 font-mono">
                            {d.mode === 'proxied' && (d.url ?? '(no subdomain)')}
                            {d.mode === 'direct_port' && `${n.node.ip}:${d.hostPort ?? '?'}`}
                            {d.mode === 'internal' && 'not public'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Node port exposures</h3>
              {n.exposures.length === 0 ? (
                <p className="text-xs text-text-muted">None.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 font-mono uppercase text-text-muted">
                      <tr>
                        <th className="p-2">Port</th>
                        <th className="p-2">Hostname</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {n.exposures.map((e) => (
                        <tr key={e.id} className="align-top">
                          <td className="p-2 font-mono">
                            {e.port}/{e.protocol}
                          </td>
                          <td className="p-2 font-mono">
                            {e.domain}
                            <IssueList issues={e.issues} />
                          </td>
                          <td className="p-2">
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono uppercase text-amber-300">DNS only</span>
                            <p className="mt-1 max-w-[16rem] text-[11px] text-text-muted">{e.note}</p>
                          </td>
                          <td className="p-2 text-right">
                            <Button size="xs" variant="danger" onClick={() => setClosing({ nodeId: n.node.id, exposure: e })}>
                              Close
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      <ConfirmDialog
        open={closing !== null}
        onClose={() => setClosing(null)}
        onConfirm={closeExposure}
        title="Close this port exposure?"
        danger
        confirmLabel="Close exposure"
        message={
          closing
            ? closing.exposure.issues.some((i) => i.code === 'subdomain_collision' || i.code === 'reserved_subdomain')
              ? `${closing.exposure.domain} is also used by a deployment or the platform. Only this exposure's own DNS record is deleted; the other one is not touched, so closing this is the fix.`
              : `This removes ${closing.exposure.domain} and deletes the DNS record created for it. Anyone using that hostname will lose access.`
            : ''
        }
      />
    </div>
  );
}
