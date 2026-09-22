import { isReservedSubdomain } from './reservedSubdomains';

/**
 * How a deployment is exposed, and which node ports are spoken for. Pure logic (no DB, no network) so every rule is
 * testable; routes/ports.ts loads the data and applies the result.
 *
 * Three user-facing modes map onto the values stored in Deployment.exposureMode and understood by the node agent
 * (services/node-agent/src/exposure.js):
 *
 *   proxied      ssl_with_proxy   public HTTPS URL through Traefik
 *   direct_port  no_ssl           a raw host port on the node (game servers, TCP/UDP listeners)
 *   internal     internal_only    no public route and no host port
 *
 * Older rows may hold ssl_direct (proxied variant) or raw_tcp (the dashboard's name for direct_port, which the agent
 * used to ignore). They are read as their nearest mode.
 */

export type ExposureMode = 'proxied' | 'direct_port' | 'internal';

export const STORED_MODE: Record<ExposureMode, string> = {
  proxied: 'ssl_with_proxy',
  direct_port: 'no_ssl',
  internal: 'internal_only',
};

export function modeFromStored(stored: string | null | undefined): ExposureMode {
  switch (stored) {
    case 'no_ssl':
    case 'raw_tcp':
      return 'direct_port';
    case 'internal_only':
      return 'internal';
    default:
      return 'proxied';
  }
}

/** Ports that must never be published because the node itself depends on them. */
export const INFRASTRUCTURE_PORTS: readonly number[] = [22, 80, 443, 2375, 2376, 2377, 4789, 7946];
export const MIN_PUBLISHED_PORT = 1024;
export const MAX_PORT = 65535;

export function reservedPorts(agentPort: number, extra: readonly number[] = []): Set<number> {
  return new Set([...INFRASTRUCTURE_PORTS, agentPort, ...extra]);
}

/** Statuses whose container will (or may again) hold its host port. A stopped container still conflicts on restart. */
const RELEASES_PORT = new Set(['deleted', 'failed']);

export interface DeploymentPortRow {
  id: string;
  userId: string;
  nodeId: string;
  subdomain: string | null;
  status: string;
  exposureMode: string | null;
  internalPort: number | null;
  publishedPort: number | null;
  frameworkPreset?: string | null;
  isPreview?: boolean | null;
}

export interface NodeRow {
  id: string;
  label: string;
  ip: string;
  isActive: boolean;
}

export interface NodeExposureRow {
  id: string;
  nodeId: string;
  port: number;
  protocol: string;
  subdomain: string;
  cfDnsRecordId: string | null;
  label: string | null;
}

/**
 * The host port a direct-port deployment occupies. Mirrors the agent: publishedPort wins, otherwise the internal port
 * is used as the host port. Null for modes that bind no host port.
 */
export function effectiveHostPort(d: Pick<DeploymentPortRow, 'exposureMode' | 'publishedPort' | 'internalPort'>): number | null {
  if (modeFromStored(d.exposureMode) !== 'direct_port') return null;
  return d.publishedPort || d.internalPort || null;
}

export class PortError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = 'PortError';
  }
}

export interface ExposureRequest {
  mode: ExposureMode;
  publishedPort?: number | null;
}

export interface ValidateContext {
  deployment: DeploymentPortRow;
  /** Every other deployment on the same node. */
  siblings: DeploymentPortRow[];
  /** Node-level port exposures on the same node. */
  nodeExposures: NodeExposureRow[];
  reserved: ReadonlySet<number>;
}

/**
 * Validates a requested exposure change and returns exactly what to store. Throws PortError with a message that says
 * what to do, never a bare "invalid".
 */
export function validateExposureChange(req: ExposureRequest, ctx: ValidateContext): { exposureMode: string; publishedPort: number | null } {
  const { deployment } = ctx;

  if (req.mode !== 'direct_port') {
    if (req.publishedPort !== undefined && req.publishedPort !== null) {
      throw new PortError('A published port only applies to direct_port mode. Leave it out for proxied or internal.', 'port_not_applicable');
    }
    return { exposureMode: STORED_MODE[req.mode], publishedPort: null };
  }

  const port = req.publishedPort;
  if (port === undefined || port === null) {
    throw new PortError('Choose a published port for direct_port mode.', 'port_required');
  }
  if (!Number.isInteger(port) || port < MIN_PUBLISHED_PORT || port > MAX_PORT) {
    throw new PortError(`Published port must be a whole number between ${MIN_PUBLISHED_PORT} and ${MAX_PORT}.`, 'port_out_of_range');
  }
  if (ctx.reserved.has(port)) {
    throw new PortError(`Port ${port} is used by the node itself and cannot be published.`, 'port_reserved');
  }

  const holder = ctx.siblings.find((s) => s.id !== deployment.id && !RELEASES_PORT.has(s.status) && effectiveHostPort(s) === port);
  if (holder) {
    throw new PortError(`Port ${port} is already used by another deployment on this node (${holder.subdomain ?? holder.id}). Choose a different port.`, 'port_in_use', 409);
  }
  const claimed = ctx.nodeExposures.find((e) => e.port === port);
  if (claimed) {
    throw new PortError(`Port ${port} is claimed by the node port exposure "${claimed.subdomain}". Close that exposure first or choose a different port.`, 'port_claimed', 409);
  }

  return { exposureMode: STORED_MODE.direct_port, publishedPort: port };
}

// ───────────────────────────── overview ─────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface PortIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  deploymentId?: string;
  exposureId?: string;
}

export interface OverviewSnapshot {
  nodes: NodeRow[];
  deployments: DeploymentPortRow[];
  exposures: NodeExposureRow[];
  rootDomain: string;
  reserved: ReadonlySet<number>;
}

export function buildOverview(snap: OverviewSnapshot) {
  const live = snap.deployments.filter((d) => d.status !== 'deleted');
  const nodes = snap.nodes.map((node) => {
    const deployments = live.filter((d) => d.nodeId === node.id);
    const exposures = snap.exposures.filter((e) => e.nodeId === node.id);
    const issues: PortIssue[] = [];

    const rows = deployments.map((d) => {
      const mode = modeFromStored(d.exposureMode);
      const hostPort = effectiveHostPort(d);
      const own: PortIssue[] = [];

      if (mode === 'direct_port') {
        if (!d.publishedPort) {
          own.push({ severity: 'warning', code: 'implicit_port', deploymentId: d.id, message: `No published port is set, so the host port falls back to the app's internal port (${d.internalPort}). Set one explicitly.` });
        }
        if (hostPort && snap.reserved.has(hostPort)) {
          own.push({ severity: 'error', code: 'reserved_port', deploymentId: d.id, message: `Host port ${hostPort} is used by the node itself.` });
        }
        if (hostPort) {
          const clash = deployments.filter((o) => o.id !== d.id && !RELEASES_PORT.has(o.status) && !RELEASES_PORT.has(d.status) && effectiveHostPort(o) === hostPort);
          if (clash.length) {
            own.push({ severity: 'error', code: 'port_conflict', deploymentId: d.id, message: `Host port ${hostPort} is also used by ${clash.map((c) => c.subdomain ?? c.id).join(', ')}. Only one can start.` });
          }
          const claimed = exposures.find((e) => e.port === hostPort);
          if (claimed) {
            own.push({ severity: 'error', code: 'port_claimed', deploymentId: d.id, message: `Host port ${hostPort} is also claimed by the node port exposure "${claimed.subdomain}".` });
          }
        }
        if (d.exposureMode === 'raw_tcp') {
          own.push({ severity: 'info', code: 'legacy_mode', deploymentId: d.id, message: 'Stored as raw_tcp, which older node agents ignored. It is treated as a direct port after the next redeploy.' });
        }
      }

      const url = mode === 'proxied' && d.subdomain ? `https://${d.subdomain}.${snap.rootDomain}` : null;
      issues.push(...own);
      return {
        id: d.id,
        userId: d.userId,
        subdomain: d.subdomain,
        status: d.status,
        mode,
        storedMode: d.exposureMode,
        internalPort: d.internalPort,
        publishedPort: d.publishedPort,
        hostPort,
        url,
        isPreview: Boolean(d.isPreview),
        issues: own,
      };
    });

    const exposureRows = exposures.map((e) => {
      const own: PortIssue[] = [];
      if (isReservedSubdomain(e.subdomain)) {
        own.push({ severity: 'error', code: 'reserved_subdomain', exposureId: e.id, message: `"${e.subdomain}" is a platform hostname. This exposure's DNS record shares that name with the platform's own, so visitors may be sent to either. Close it.` });
      }
      const collides = live.find((d) => d.subdomain && d.subdomain === e.subdomain);
      if (collides) {
        own.push({ severity: 'error', code: 'subdomain_collision', exposureId: e.id, message: `"${e.subdomain}" is also a deployment's subdomain. Two DNS records now share that name, so visitors may be sent to either. Close this exposure to fix it.` });
      }
      if (!e.cfDnsRecordId) {
        own.push({ severity: 'warning', code: 'no_dns_record', exposureId: e.id, message: 'No DNS record was recorded for this exposure (creation may have failed), so the hostname may not resolve.' });
      }
      if (snap.reserved.has(e.port)) {
        own.push({ severity: 'warning', code: 'reserved_port', exposureId: e.id, message: `Port ${e.port} is used by the node itself.` });
      }
      issues.push(...own);
      return {
        id: e.id,
        port: e.port,
        protocol: e.protocol,
        subdomain: e.subdomain,
        domain: `${e.subdomain}.${snap.rootDomain}`,
        label: e.label,
        // Honest status: this feature only creates a DNS record pointing at the node. Nothing on the node maps the
        // hostname to the port, so traffic to the hostname arrives on the node's ports 80/443, not on `port`.
        routed: false,
        note: 'DNS record only: nothing routes this hostname to the port.',
        issues: own,
      };
    });

    return { node: { id: node.id, label: node.label, ip: node.ip, isActive: node.isActive }, deployments: rows, exposures: exposureRows, issues };
  });

  const all = nodes.flatMap((n) => n.issues);
  return {
    nodes,
    summary: {
      nodes: nodes.length,
      deployments: nodes.reduce((n, x) => n + x.deployments.length, 0),
      directPorts: nodes.reduce((n, x) => n + x.deployments.filter((d) => d.mode === 'direct_port').length, 0),
      nodeExposures: nodes.reduce((n, x) => n + x.exposures.length, 0),
      errors: all.filter((i) => i.severity === 'error').length,
      warnings: all.filter((i) => i.severity === 'warning').length,
    },
  };
}
