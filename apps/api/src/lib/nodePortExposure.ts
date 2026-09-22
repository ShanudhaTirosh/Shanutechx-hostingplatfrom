import { env } from '../env';
import { logger } from './logger';
import { PortError, reservedPorts, type NodeExposureRow } from './portExposure';
import { isReservedSubdomain } from './reservedSubdomains';

/**
 * Node-level port exposures (a hostname pointed at a compute node), made safe to create, close and move.
 *
 * What this feature is: it creates a DNS record for `<subdomain>.<root>` pointing at the node's IP and remembers the
 * port. It does NOT route the hostname to the port: nothing on the node maps the host to it, so a visitor reaches the
 * node's ports 80/443. The overview reports these as DNS-only (see routes/ports.ts and docs/PORT_EXPOSURE.md).
 *
 * What was unsafe before, and what this does instead:
 *  - any subdomain was accepted (including `api`, `www` or a customer's deployment subdomain); now reserved names and
 *    names already used by a deployment or another exposure are refused;
 *  - closing deleted EVERY DNS record with that name, so closing an exposure named like a customer's site took the
 *    site down; now the specific record is deleted by id (or, for old rows without one, only records pointing at this
 *    node's IP, and never for a name a deployment owns);
 *  - re-exposing created a new record every time and leaked the old one; now an unchanged subdomain reuses its record
 *    and a changed one replaces it;
 *  - a failed DNS call was swallowed and the exposure was stored anyway; now it fails, and a failed database write
 *    removes the record it just created;
 *  - failover added a second A record without removing the dead node's; now the old one is deleted.
 */

export interface DnsPort {
  create(subdomain: string, ip: string, proxied: boolean): Promise<{ recordId: string }>;
  /** Idempotent: a record that is already gone is not an error. */
  deleteById(recordId: string): Promise<void>;
  deleteByNameAndIp(subdomain: string, ip: string): Promise<number>;
}

export interface NodeInfo {
  id: string;
  label: string;
  ip: string;
}

export interface ExposureStore {
  getNode(id: string): Promise<NodeInfo | null>;
  liveDeploymentSubdomains(): Promise<Set<string>>;
  getBySubdomain(subdomain: string): Promise<NodeExposureRow | null>;
  getByNodePort(nodeId: string, port: number): Promise<NodeExposureRow | null>;
  getById(id: string): Promise<NodeExposureRow | null>;
  upsert(row: { nodeId: string; port: number; protocol: string; subdomain: string; cfDnsRecordId: string; label: string }): Promise<NodeExposureRow>;
  moveToNode(id: string, nodeId: string, cfDnsRecordId: string): Promise<void>;
  remove(id: string): Promise<void>;
  audit(action: string, target: string, adminId: string | null): Promise<void>;
}

export interface ExposureDeps {
  dns: DnsPort;
  store: ExposureStore;
  reserved: ReadonlySet<number>;
}

export interface ExposeInput {
  port: number;
  protocol: 'http' | 'https' | 'tcp';
  subdomain?: string;
  label?: string;
}

export function sanitizeSubdomain(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 63);
}

export async function exposeNodePort(nodeId: string, input: ExposeInput, adminId: string | null, deps: ExposureDeps): Promise<{ exposure: NodeExposureRow; warnings: string[] }> {
  const { store, dns } = deps;
  const node = await store.getNode(nodeId);
  if (!node) throw new PortError('Node not found', 'not_found', 404);

  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) throw new PortError('Port must be a whole number between 1 and 65535.', 'port_out_of_range');
  if (deps.reserved.has(input.port)) throw new PortError(`Port ${input.port} is used by the node itself (SSH, Docker, the node agent, ...) and cannot be exposed.`, 'port_reserved');

  const cleanLabel = sanitizeSubdomain(node.label) || node.id.slice(-6);
  const subdomain = sanitizeSubdomain(input.subdomain?.trim() || `${cleanLabel}-port-${input.port}`);
  if (!subdomain) throw new PortError('Subdomain must contain letters or numbers.', 'invalid_subdomain');
  if (isReservedSubdomain(subdomain)) throw new PortError(`"${subdomain}" is a platform hostname and cannot be used.`, 'reserved_subdomain');
  if ((await store.liveDeploymentSubdomains()).has(subdomain)) throw new PortError(`"${subdomain}" is already used by a deployment.`, 'subdomain_in_use', 409);

  const existing = await store.getByNodePort(nodeId, input.port);
  const holder = await store.getBySubdomain(subdomain);
  if (holder && holder.id !== existing?.id) throw new PortError(`"${subdomain}" is already used by another port exposure.`, 'subdomain_in_use', 409);

  const warnings: string[] = [];
  const label = input.label?.trim() || `Port ${input.port} (${input.protocol.toUpperCase()})`;
  // Cloudflare's proxy only carries HTTP(S); a proxied record for raw TCP can never work.
  const proxied = input.protocol !== 'tcp';

  let recordId: string;
  let created = false;
  if (existing && existing.subdomain === subdomain && existing.cfDnsRecordId) {
    recordId = existing.cfDnsRecordId; // unchanged hostname: keep its record instead of creating a duplicate
  } else {
    try {
      recordId = (await dns.create(subdomain, node.ip, proxied)).recordId;
      created = true;
    } catch (err) {
      logger.error({ err, subdomain, nodeId }, 'DNS record creation failed for port exposure');
      throw new PortError('Could not create the DNS record, so nothing was saved. Check the Cloudflare configuration and try again.', 'dns_failed', 502);
    }
  }

  let exposure: NodeExposureRow;
  try {
    exposure = await store.upsert({ nodeId, port: input.port, protocol: input.protocol, subdomain, cfDnsRecordId: recordId, label });
  } catch (err) {
    if (created) await dns.deleteById(recordId).catch((e) => logger.error({ err: e, recordId }, 'Could not remove the DNS record after a failed save; delete it manually'));
    throw err;
  }

  // Renamed: the previous hostname's record would otherwise be orphaned.
  if (existing?.cfDnsRecordId && existing.cfDnsRecordId !== recordId) {
    await dns.deleteById(existing.cfDnsRecordId).catch((err) => {
      logger.warn({ err, recordId: existing.cfDnsRecordId }, 'Could not delete the previous DNS record');
      warnings.push(`The old hostname "${existing.subdomain}" could not be removed from DNS; remove it manually.`);
    });
  }

  await store.audit(existing ? 'node.port_exposure.updated' : 'node.port_exposure.created', `${nodeId}:${input.port}:${subdomain}`, adminId).catch(() => {});
  return { exposure, warnings };
}

export interface CloseResult {
  dnsRecordDeleted: boolean;
  dnsSkippedReason?: string;
}

export async function closeNodePort(nodeId: string, exposureId: string, adminId: string | null, deps: ExposureDeps): Promise<CloseResult> {
  const { store, dns } = deps;
  const exposure = await store.getById(exposureId);
  if (!exposure || exposure.nodeId !== nodeId) throw new PortError('Port exposure not found', 'not_found', 404);
  const node = await store.getNode(nodeId);

  let result: CloseResult;
  if (exposure.cfDnsRecordId) {
    // The specific record this exposure created: safe to delete even if another record shares the name.
    try {
      await dns.deleteById(exposure.cfDnsRecordId);
      result = { dnsRecordDeleted: true };
    } catch (err) {
      logger.error({ err, exposureId }, 'DNS record deletion failed while closing a port exposure');
      // Keep the row so the close can be retried; deleting it now would strand the record with no way to find it.
      throw new PortError('Could not delete the DNS record, so the exposure was left in place. Try again.', 'dns_failed', 502);
    }
  } else {
    const owned = isReservedSubdomain(exposure.subdomain) || (await store.liveDeploymentSubdomains()).has(exposure.subdomain);
    if (owned) {
      result = { dnsRecordDeleted: false, dnsSkippedReason: `"${exposure.subdomain}" belongs to the platform or a deployment and no record id was stored, so its DNS was left untouched.` };
    } else if (!node) {
      result = { dnsRecordDeleted: false, dnsSkippedReason: 'The node no longer exists, so no DNS record could be matched safely.' };
    } else {
      try {
        const n = await dns.deleteByNameAndIp(exposure.subdomain, node.ip);
        result = { dnsRecordDeleted: n > 0 };
      } catch (err) {
        logger.error({ err, exposureId }, 'DNS lookup/deletion failed while closing a port exposure');
        throw new PortError('Could not delete the DNS record, so the exposure was left in place. Try again.', 'dns_failed', 502);
      }
    }
  }

  await store.remove(exposure.id);
  await store.audit('node.port_exposure.closed', `${nodeId}:${exposure.port}:${exposure.subdomain}${result.dnsSkippedReason ? ' (dns untouched)' : ''}`, adminId).catch(() => {});
  return result;
}

/** Failover: repoint an exposure at another node. Returns false (and changes nothing) if DNS could not be updated. */
export async function moveExposureToNode(exposure: NodeExposureRow, target: NodeInfo, deps: ExposureDeps): Promise<boolean> {
  const { store, dns } = deps;
  // Read before anything is saved: the record being replaced must be the one that was there when we started.
  const oldRecordId = exposure.cfDnsRecordId;
  const { subdomain, protocol, id: exposureId } = exposure;
  let newId: string;
  try {
    newId = (await dns.create(subdomain, target.ip, protocol !== 'tcp')).recordId;
  } catch (err) {
    logger.error({ err, exposureId }, 'Port exposure failover: DNS update failed; left on the old node');
    return false;
  }
  try {
    await store.moveToNode(exposureId, target.id, newId);
  } catch (err) {
    await dns.deleteById(newId).catch(() => {});
    logger.error({ err, exposureId }, 'Port exposure failover: could not save the move');
    return false;
  }
  // Without this the dead node's record stays, and DNS keeps sending some visitors to it.
  if (oldRecordId) {
    await dns.deleteById(oldRecordId).catch((err) => logger.warn({ err, recordId: oldRecordId }, 'Could not delete the old node\'s DNS record after failover'));
  }
  return true;
}


// ───────────────────────────── real wiring ─────────────────────────────

export async function createExposureDeps(): Promise<ExposureDeps> {
  const { prisma } = await import('./prisma');
  const cf = await import('./cloudflare');
  const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const missing = (err: unknown) => /81044|does not exist|not found/i.test(err instanceof Error ? err.message : String(err));
  return {
    reserved: reservedPorts(env.nodeAgentPort),
    dns: {
      create: (sub, ip, proxied) => cf.createSubdomainRecord(sub, ip, proxied),
      async deleteById(id) {
        try {
          await cf.deleteDnsRecord(id);
        } catch (err) {
          if (!missing(err)) throw err;
        }
      },
      deleteByNameAndIp: (sub, ip) => cf.deleteDnsRecordsByNameAndIp(sub, ip),
    },
    store: {
      getNode: async (id) => (await db.node.findUnique({ where: { id }, select: { id: true, label: true, ip: true } })) ?? null,
      async liveDeploymentSubdomains() {
        const rows = await db.deployment.findMany({ where: { status: { not: 'deleted' }, subdomain: { not: null } }, select: { subdomain: true } });
        return new Set<string>(rows.map((r: { subdomain: string }) => r.subdomain));
      },
      getBySubdomain: async (subdomain) => (await db.nodePortExposure.findUnique({ where: { subdomain } })) ?? null,
      getByNodePort: async (nodeId, port) => (await db.nodePortExposure.findUnique({ where: { nodeId_port: { nodeId, port } } })) ?? null,
      getById: async (id) => (await db.nodePortExposure.findUnique({ where: { id } })) ?? null,
      upsert: (r) =>
        db.nodePortExposure.upsert({
          where: { nodeId_port: { nodeId: r.nodeId, port: r.port } },
          create: r,
          update: { protocol: r.protocol, subdomain: r.subdomain, cfDnsRecordId: r.cfDnsRecordId, label: r.label },
        }),
      async moveToNode(id, nodeId, cfDnsRecordId) {
        await db.nodePortExposure.update({ where: { id }, data: { nodeId, cfDnsRecordId } });
      },
      async remove(id) {
        await db.nodePortExposure.delete({ where: { id } });
      },
      async audit(action, target, adminId) {
        await db.auditLog.create({ data: { adminId, action, target } });
      },
    },
  };
}
