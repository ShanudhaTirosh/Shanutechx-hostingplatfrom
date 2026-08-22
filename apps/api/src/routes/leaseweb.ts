import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import {
  listVpsProducts,
  listVps,
  getVps,
  setVpsReference,
  startVps,
  stopVps,
  rebootVps,
  getConsoleUrl,
  getCredentials,
  listSnapshots,
  createSnapshot,
  getMonitoringStatus,
  getDataTraffic,
  resetVpsPassword,
  reinstallVps,
  restoreSnapshot,
  deleteSnapshot,
  listOperatingSystems,
  cancelVps,
  LeasewebApiError,
} from '../lib/leasewebClient';
import { notifyDiscordChannel } from '../lib/discordWebhooks';
import { notifyCustomer } from '../lib/notifications';
import { issueSshTicket } from '../lib/sshTerminalGateway';
import { convertToLkr } from '../lib/currency';
import { encryptSecret } from '../lib/secretsVault';
import { env } from '../env';

export const leasewebRouter = Router();

leasewebRouter.use(requireAuth);

/**
 * Flat profit margin added on top of Leaseweb's own listed price when
 * suggesting a customer-facing price for a VPS resale — 500.00 LKR, in the
 * smallest-currency-unit representation used everywhere else in this
 * codebase (cents). Not admin-configurable yet — see NEXT_STEPS.md if this
 * needs to become a per-admin setting instead of a fixed constant.
 */
const VPS_RESALE_MARGIN_LKR_CENTS = 50_000; // 500.00 LKR

/**
 * PURCHASING NOTE (see also lib/leasewebClient.ts): this platform never
 * places a Leaseweb order automatically. An admin/dev buys the VPS
 * manually through Leaseweb's own portal, using whatever payment method
 * is on file there. Everything below is purely about MANAGING and
 * ASSIGNING a VPS that already exists on the Leaseweb account.
 */

/**
 * Read-only product/pricing reference — helps an admin decide what to
 * charge a customer. Suggests total = LKR-equivalent of Leaseweb's own
 * listed price + VPS_RESALE_MARGIN_LKR_CENTS, shown alongside the raw price.
 */
leasewebRouter.get('/leaseweb/products', requireAdminOrDev, async (req: AuthedRequest, res) => {
  try {
    if (!env.leasewebApiKey) {
      return res.json({ apiKeyConfigured: false, products: [] });
    }
    const products = await listVpsProducts(typeof req.query.location === 'string' ? req.query.location : undefined);
    const withSuggestedPricing = products.map((p) => {
      const basePriceLkrCents = convertToLkr(Math.round(p.price.total * 100), 'USD');
      return { ...p, suggestedCustomerPriceLkr: (basePriceLkrCents + VPS_RESALE_MARGIN_LKR_CENTS) / 100 };
    });
    res.json({ apiKeyConfigured: true, products: withSuggestedPricing });
  } catch (err) {
    res.json({ apiKeyConfigured: false, products: [], error: (err as Error).message });
  }
});

/** Lists every VPS currently on the Leaseweb account, so an admin can pick one to import/assign. */
leasewebRouter.get('/leaseweb/vps', requireAdminOrDev, async (_req, res) => {
  try {
    if (!env.leasewebApiKey) {
      return res.json({ apiKeyConfigured: false, vpss: [] });
    }
    const vpss = await listVps();
    res.json({ apiKeyConfigured: true, vpss });
  } catch (err) {
    res.json({ apiKeyConfigured: false, vpss: [], error: (err as Error).message });
  }
});

const importSchema = z.object({
  leasewebVpsId: z.string().min(1),
  assignTo: z.enum(['customer_order', 'node']),
  orderItemId: z.string().optional(),
  userId: z.string().optional(),
  label: z.string().optional(),
  roleTags: z.array(z.string()).optional(),
});

/**
 * Links a VPS that already exists on the Leaseweb account to either a
 * customer's paid order item (VpsProvision) or a new hosting Node.
 * setVpsReference() tags the VPS on Leaseweb's side with our internal ID
 * purely so a human looking at the Leaseweb portal can tell what it's
 * for — has no effect on anything in this codebase.
 */
leasewebRouter.post('/leaseweb/vps/:leasewebVpsId/import', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = importSchema.safeParse({ ...req.body, leasewebVpsId: req.params.leasewebVpsId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let vpsInfo;
  try {
    vpsInfo = await getVps(parsed.data.leasewebVpsId);
  } catch (err) {
    return res.status(502).json({ error: `Could not fetch VPS from Leaseweb: ${(err as Error).message}` });
  }

  if (parsed.data.assignTo === 'customer_order') {
    if (!parsed.data.orderItemId || !parsed.data.userId) {
      return res.status(400).json({ error: 'orderItemId and userId are required when assigning to a customer order' });
    }

    const provision = await prisma.vpsProvision.create({
      data: {
        userId: parsed.data.userId,
        orderItemId: parsed.data.orderItemId,
        provider: 'leaseweb',
        externalId: parsed.data.leasewebVpsId,
        leasewebVpsId: parsed.data.leasewebVpsId,
        status: 'provisioned',
        provisionedAt: new Date(),
      },
    });

    void setVpsReference(parsed.data.leasewebVpsId, provision.id).catch(() => {});

    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'leaseweb.import_to_customer', target: provision.id },
    });

    return res.status(201).json({ vpsProvision: provision, leasewebInfo: vpsInfo });
  }

  if (!parsed.data.label || !parsed.data.roleTags?.length) {
    return res.status(400).json({ error: 'label and roleTags are required when assigning as a node' });
  }

  const ip = vpsInfo.ips?.[0]?.ip;
  if (!ip) return res.status(502).json({ error: 'Leaseweb did not return an IP for this VPS yet' });

  const node = await prisma.node.create({
    data: {
      label: parsed.data.label,
      ip,
      sshKeyRef: encryptSecret('placeholder-add-real-ssh-key-after-bootstrap', env.secretsEncryptionKey),
      cpuCores: 1,
      ramMb: 1024,
      diskGb: 20,
      roleTags: parsed.data.roleTags,
      isActive: false,
      leasewebVpsId: parsed.data.leasewebVpsId,
    },
  });

  void setVpsReference(parsed.data.leasewebVpsId, node.id).catch(() => {});

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'leaseweb.import_to_node', target: node.id },
  });

  res.status(201).json({
    node,
    leasewebInfo: vpsInfo,
    warning: 'Node created but inactive — bootstrap Docker/node-agent on it, then PATCH /api/nodes/:id to activate.',
  });
});

/**
 * A "leaseweb instance" below is identified by OUR id (a VpsProvision id
 * or a Node id), never the raw Leaseweb VPS ID directly — access control
 * runs through the existing ownership pattern used everywhere else in
 * this codebase, not a new one invented for this feature.
 */
async function resolveLeasewebVpsId(req: AuthedRequest, kind: 'provision' | 'node', id: string): Promise<string | null> {
  if (kind === 'provision') {
    const provision = await prisma.vpsProvision.findUnique({ where: { id } });
    if (!provision?.leasewebVpsId) return null;
    // Phase 15: admin scoped to an assigned customer's provision (was:
    // blanket access for admin, same as dev).
    if (!(await canAccessResource(provision.userId, req))) return null;
    return provision.leasewebVpsId;
  }

  // Raw node access (kind === 'node') has no customer owner — it's
  // platform infrastructure, dev-only, same as everywhere else raw nodes
  // are touched in this codebase.
  if (req.user!.role !== 'dev') return null;
  const node = await prisma.node.findUnique({ where: { id } });
  return node?.leasewebVpsId ?? null;
}

const kindParam = z.enum(['provision', 'node']);

leasewebRouter.get('/leaseweb/instances/:kind/:id', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    const [info, monitoring] = await Promise.all([getVps(vpsId), getMonitoringStatus(vpsId).catch(() => null)]);
    res.json({ instance: info, monitoring });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const powerActionSchema = z.object({ action: z.enum(['start', 'stop', 'reboot']) });

leasewebRouter.post('/leaseweb/instances/:kind/:id/power', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const parsed = powerActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    if (parsed.data.action === 'start') await startVps(vpsId);
    else if (parsed.data.action === 'stop') await stopVps(vpsId);
    else await rebootVps(vpsId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

leasewebRouter.get('/leaseweb/instances/:kind/:id/console', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    const url = await getConsoleUrl(vpsId);
    res.json({ url });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

leasewebRouter.get('/leaseweb/instances/:kind/:id/credentials', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    const creds = await getCredentials(vpsId, 'OPERATING_SYSTEM');
    // Audit finding H9: viewing a VPS's root/Administrator credentials is
    // one of the most sensitive reads in this file and previously left no
    // trail at all -- log who viewed it and when (never the credential
    // value itself). actorRole distinguishes a customer viewing their own
    // VPS's credentials from a staff member viewing a customer's.
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'vps.view_credentials',
        target: vpsId,
        actorRole: req.user!.role === 'customer' ? 'customer' : null,
      },
    });
    res.json(creds);
  } catch (err) {
    const statusCode = err instanceof LeasewebApiError ? err.statusCode ?? 502 : 502;
    res.status(statusCode).json({ error: (err as Error).message });
  }
});

leasewebRouter.get('/leaseweb/instances/:kind/:id/snapshots', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    const snapshots = await listSnapshots(vpsId);
    res.json({ snapshots });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const createSnapshotSchema = z.object({ name: z.string().min(1) });

leasewebRouter.post('/leaseweb/instances/:kind/:id/snapshots', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const parsed = createSnapshotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    const snapshot = await createSnapshot(vpsId, parsed.data.name);
    res.status(201).json({ snapshot });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

leasewebRouter.post('/leaseweb/instances/:kind/:id/snapshots/:snapshotId/restore', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    await restoreSnapshot(vpsId, req.params.snapshotId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

leasewebRouter.delete('/leaseweb/instances/:kind/:id/snapshots/:snapshotId', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    await deleteSnapshot(vpsId, req.params.snapshotId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const reinstallSchema = z.object({ osCode: z.string().min(1) });

leasewebRouter.post('/leaseweb/instances/:kind/:id/reinstall', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const parsed = reinstallSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    await reinstallVps(vpsId, parsed.data.osCode);
    res.json({ ok: true, message: `OS reinstallation initiated for ${vpsId} with ${parsed.data.osCode}` });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

leasewebRouter.get('/leaseweb/os-options', async (_req, res) => {
  const osOptions = await listOperatingSystems();
  res.json({ osOptions });
});

leasewebRouter.get('/leaseweb/instances/:kind/:id/data-traffic', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    const traffic = await getDataTraffic(vpsId);
    res.json({ traffic });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/**
 * Customer self-service: reset the VPS root/Administrator password. Owner
 * (via resolveLeasewebVpsId — customers can only ever resolve their own
 * `provision`) or staff can call this. Never destructive on its own, but
 * per Leaseweb's docs the VPS should ideally be stopped first — we warn
 * rather than block, since Leaseweb's own API enforces whatever it needs to.
 */
leasewebRouter.post('/leaseweb/instances/:kind/:id/reset-password', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    const instance = await getVps(vpsId).catch(() => null);
    const wasRunning = instance?.state?.toLowerCase() === 'running';

    const credentials = await resetVpsPassword(vpsId);

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'vps.reset_password',
        target: vpsId,
        // Audit finding H9: this route is explicitly customer
        // self-service (not admin-only), so record when the actor was
        // the resource's own owner rather than staff -- previously every
        // row here was indistinguishable from a real admin action in the
        // /admin/audit-log view.
        actorRole: req.user!.role === 'customer' ? 'customer' : null,
      },
    });

    res.json({
      credentials,
      warning: wasRunning
        ? 'This VPS is currently running — Leaseweb recommends stopping it first for a password reset to take effect reliably. If the new password does not work, stop the VPS and try again.'
        : undefined,
    });
  } catch (err) {
    const statusCode = err instanceof LeasewebApiError ? err.statusCode ?? 502 : 502;
    res.status(statusCode).json({ error: (err as Error).message });
  }
});

/**
 * Admin/dev-only, destructive, irreversible. Customers can Stop/Shutdown
 * their VPS but can never Terminate it — that button simply does not exist
 * anywhere in the customer-facing UI. This is the only path that cancels
 * the instance at the provider.
 */
/**
 * Web SSH terminal, step 1: mint a short-lived, single-use ticket rather
 * than passing the customer's real auth token in a WebSocket URL query
 * string (browsers can't set custom headers on the WebSocket handshake).
 * The actual terminal session is opened against `/ws/vps-ssh?ticket=...`
 * — see lib/sshTerminalGateway.ts for the server side of that handshake.
 */
leasewebRouter.post('/leaseweb/instances/:kind/:id/ssh-ticket', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  const ticket = issueSshTicket(vpsId, req.user!.id);
  // Audit finding H9: opening an SSH terminal to a VPS is one of the two
  // most sensitive actions in this file (alongside viewing credentials
  // above) and previously left no audit trail at all.
  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'vps.ssh_ticket_issued',
      target: vpsId,
      actorRole: req.user!.role === 'customer' ? 'customer' : null,
    },
  });
  res.json({ ticket, expiresInMs: 30_000 });
});

leasewebRouter.post('/leaseweb/instances/:kind/:id/terminate', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });

  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });

  try {
    await cancelVps(vpsId);

    let ownerEmail: string | undefined;
    if (kind.data === 'provision') {
      const provision = await prisma.vpsProvision.update({
        where: { id: req.params.id },
        data: { status: 'terminated' },
        include: { user: true },
      });
      ownerEmail = provision.user.email;
      void notifyCustomer(provision.user, `Your VPS (${vpsId}) has been terminated by an administrator.`);
    }

    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'vps.terminate', target: vpsId },
    });
    void notifyDiscordChannel('vps_assigned', {
      'VPS': vpsId,
      'Action': 'Terminated',
      'By': req.user!.email,
      'Owner': ownerEmail ?? '(node — not customer-owned)',
    });

    res.json({ ok: true });
  } catch (err) {
    const statusCode = err instanceof LeasewebApiError ? err.statusCode ?? 502 : 502;
    res.status(statusCode).json({ error: (err as Error).message });
  }
});

/**
 * DNS and firewall management are NOT wired up here. Leaseweb's Public
 * Cloud product does expose Security Groups / firewall management and, for
 * some product lines, DNS — but the exact endpoints depend on your account
 * setup and haven't been verified against this integration. Rather than
 * fabricate a call against an unconfirmed path, these report `supported:
 * false` so the frontend can grey the tab out honestly instead of showing
 * a button that 502s. Wire these up for real once you've confirmed the
 * exact Security Groups endpoints against your Leaseweb API credentials —
 * see https://developer.leaseweb.com/docs/ (Public Cloud > Security Groups).
 */
leasewebRouter.get('/leaseweb/instances/:kind/:id/firewall', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });
  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });
  res.json({ supported: false, reason: 'Firewall management is not wired up for this VPS integration yet.' });
});

leasewebRouter.get('/leaseweb/instances/:kind/:id/dns', async (req: AuthedRequest, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) return res.status(400).json({ error: 'kind must be provision or node' });
  const vpsId = await resolveLeasewebVpsId(req, kind.data, req.params.id);
  if (!vpsId) return res.status(404).json({ error: 'Not found' });
  res.json({ supported: false, reason: 'DNS management is not wired up for this VPS integration yet.' });
});

/** Dev-facing raw API call log — every request/response this platform has made to Leaseweb, secrets redacted. */
leasewebRouter.get('/leaseweb/logs', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const take = Math.min(Number(req.query.take) || 50, 200);
  const logs = await prisma.leasewebApiLog.findMany({ orderBy: { createdAt: 'desc' }, take });
  res.json({ logs });
});

/** Simple health signal for the dev dashboard: is the API key configured, and did the last call succeed? */
leasewebRouter.get('/leaseweb/health', requireAdminOrDev, async (_req, res) => {
  const lastCall = await prisma.leasewebApiLog.findFirst({ orderBy: { createdAt: 'desc' } });
  res.json({
    apiKeyConfigured: Boolean(env.leasewebApiKey),
    lastCallAt: lastCall?.createdAt ?? null,
    lastCallSucceeded: lastCall ? (lastCall.statusCode != null && lastCall.statusCode < 400) : null,
  });
});

const configSchema = z.object({ apiKey: z.string().min(1) });

/** Dynamic configuration endpoint for Admin and Dev users to configure the Leaseweb API key. */
leasewebRouter.post('/leaseweb/config', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  (env as any).leasewebApiKey = parsed.data.apiKey;
  process.env.LEASEWEB_API_KEY = parsed.data.apiKey;

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'leaseweb.update_config', target: 'leaseweb_api_key' },
  });

  res.json({ ok: true, apiKeyConfigured: true });
});

/** Customer-facing public list of VPS products with 500 LKR retail margin added. */
leasewebRouter.get('/leaseweb/public-products', async (req: AuthedRequest, res) => {
  try {
    const products = await listVpsProducts(typeof req.query.location === 'string' ? req.query.location : undefined);
    const withSuggestedPricing = products.map((p) => {
      const basePriceLkrCents = convertToLkr(Math.round(p.price.total * 100), 'USD');
      return {
        code: p.id,
        name: p.name,
        cpu: p.vCpu,
        ram: p.vRam,
        disk: p.nvmeStorage,
        priceLkr: (basePriceLkrCents + VPS_RESALE_MARGIN_LKR_CENTS) / 100,
        priceCents: basePriceLkrCents + VPS_RESALE_MARGIN_LKR_CENTS,
      };
    });
    res.json({ products: withSuggestedPricing });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** Customers can add Leaseweb VPS products directly to their cart. */
leasewebRouter.post('/leaseweb/products/:code/add-to-cart', async (req: AuthedRequest, res) => {
  try {
    const { code } = req.params;
    const products = await listVpsProducts();
    const p = products.find((prod) => prod.id === code);
    if (!p) return res.status(404).json({ error: 'VPS product not found' });

    const basePriceLkrCents = convertToLkr(Math.round(p.price.total * 100), 'USD');
    const priceCents = basePriceLkrCents + VPS_RESALE_MARGIN_LKR_CENTS;

    let service = await prisma.service.findFirst({
      where: { name: `Leaseweb VPS - ${p.name}`, type: 'vps' },
    });

    if (!service) {
      service = await prisma.service.create({
        data: {
          type: 'vps',
          name: `Leaseweb VPS - ${p.name}`,
          price: priceCents,
          currency: 'LKR',
          billingPeriod: 'monthly',
        },
      });
    } else {
      service = await prisma.service.update({
        where: { id: service.id },
        data: { price: priceCents },
      });
    }

    let order = await prisma.order.findFirst({
      where: { userId: req.user!.id, status: 'draft' },
    });
    if (!order) {
      order = await prisma.order.create({
        data: { userId: req.user!.id, status: 'draft', total: 0, totalLkr: 0 },
      });
    }

    const existingCount = await prisma.orderItem.count({ where: { orderId: order.id } });
    if (existingCount > 0) {
      const firstItem = await prisma.orderItem.findFirst({
        where: { orderId: order.id },
        include: { service: true },
      });
      if (firstItem && firstItem.service && firstItem.service.currency !== service.currency) {
        return res.status(409).json({
          error: `Your cart already has items priced in ${firstItem.service.currency}. Check out or clear your cart before adding this item.`,
        });
      }
    }

    const existingItem = await prisma.orderItem.findFirst({
      where: { orderId: order.id, serviceId: service.id },
    });

    const item = existingItem
      ? await prisma.orderItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + 1 },
        })
      : await prisma.orderItem.create({
          data: {
            orderId: order.id,
            serviceId: service.id,
            quantity: 1,
            configJson: { leasewebProductCode: p.id },
          },
        });

    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      include: { service: true },
    });

    const total = items.reduce((sum, i) => sum + (i.service ? i.service.price : 0) * i.quantity, 0);
    const totalLkr = convertToLkr(total, service!.currency);
    await prisma.order.update({
      where: { id: order.id },
      data: { total, totalLkr, currency: service!.currency },
    });

    res.json({ item, total, currency: service!.currency });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
