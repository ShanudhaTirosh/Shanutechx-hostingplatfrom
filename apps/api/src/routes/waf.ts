import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { notifyAgentWafSync, type WafSyncRule } from '../lib/nodeAgentClient';

/**
 * Per-deployment firewall: IP/CIDR/header/path/user-agent allow+block rules, per-IP rate limiting, and HTTP Basic
 * Auth password protection for the whole deployment -- all actually enforced at the edge by the node agent (see
 * services/node-agent/src/waf.js and the /agent/waf-check forwardAuth route), not just recorded in the database.
 *
 * Before this file, every one of these settings was saved here and then "synced" to the node agent, which is to say
 * a request was sent to an endpoint that logged a line and did nothing -- a customer could "block" an attacker's IP
 * and it would keep reaching their app unchanged. That is fixed for: allow/block/rate_limit rules matching by IP,
 * IP range (CIDR), request header, path, or user agent; and password protection.
 *
 * Two things are deliberately NOT accepted, rather than accepted and silently ignored the way everything used to be:
 *  - matchType "country" (no GeoIP source was ever wired in to check it against)
 *  - action "turnstile_challenge", and the separate wafTurnstileEnabled toggle (needs an interactive challenge page
 *    and server-side token verification that were never built)
 * Both are rejected with a clear message instead of a generic validation error, and the toggle is reported back as
 * permanently off/unsupported regardless of whatever was saved in the database before this change.
 *
 * WAF is only enforced for `proxied` deployments (the only mode with a public HTTP router in front of it); it does
 * not apply to direct_port or internal exposure. The forwardAuth middleware that makes any of this possible is
 * attached to the Traefik router at container-creation time, so a deployment created before this feature shipped
 * only starts being protected after its next redeploy -- there is no way to retrofit it onto an already-running
 * container without restarting it.
 */

export const wafRouter = Router();

wafRouter.use(requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req))) return null;
  return deployment;
}

/** Pushes the deployment's current enabled rules + password hash to its node. This IS the enforcement mechanism. */
async function pushWafState(deployment: { id: string; node: { id: string; ip: string } }) {
  const [rules, dep] = await Promise.all([
    prisma.wafRule.findMany({ where: { deploymentId: deployment.id, isEnabled: true }, orderBy: { createdAt: 'asc' } }),
    prisma.deployment.findUnique({ where: { id: deployment.id }, select: { deploymentProtectionPasswordHash: true } }),
  ]);
  const payload: WafSyncRule[] = rules.map((r: (typeof rules)[number]) => ({
    id: r.id,
    action: r.action as WafSyncRule['action'],
    matchType: r.matchType as WafSyncRule['matchType'],
    matchValue: r.matchValue,
    rateLimitPerMinute: r.rateLimitPerMinute ?? null,
    isEnabled: r.isEnabled,
  }));
  await notifyAgentWafSync(deployment.node, deployment.id, payload, dep?.deploymentProtectionPasswordHash ?? null);
}

// GET /api/deployments/:id/waf/rules — List WAF rules & security settings
wafRouter.get('/deployments/:id/waf/rules', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const rules = await prisma.wafRule.findMany({
    where: { deploymentId: deployment.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    rules,
    enforced: true,
    enforcementNote:
      'Rules apply only to proxied (HTTPS) deployments and take effect immediately for anything already running the WAF gateway. A deployment redeployed before this feature shipped needs one more redeploy to start being protected.',
    // Reported as unsupported regardless of what was saved before this fix -- it never did anything, and pretending
    // otherwise here would repeat the exact bug this file exists to correct.
    turnstileChallenge: { enabled: false, supported: false },
    hasProtectionPassword: Boolean(deployment.deploymentProtectionPasswordHash),
  });
});

const SUPPORTED_ACTIONS = ['allow', 'block', 'rate_limit'] as const;
const SUPPORTED_MATCH_TYPES = ['ip', 'ip_range', 'header', 'path', 'user_agent'] as const;

const createWafRuleSchema = z
  .object({
    action: z.enum(SUPPORTED_ACTIONS),
    matchType: z.enum(SUPPORTED_MATCH_TYPES),
    matchValue: z.string().min(1).max(500),
    description: z.string().max(255).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(100_000).optional(),
  })
  .refine((d) => d.action !== 'rate_limit' || Number.isInteger(d.rateLimitPerMinute), {
    message: 'rateLimitPerMinute (requests allowed per IP per minute) is required when action is "rate_limit"',
    path: ['rateLimitPerMinute'],
  });

function rejectUnsupportedRuleFields(body: unknown, res: import('express').Response): boolean {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.matchType === 'country') {
    res.status(400).json({ error: 'Country-based rules are not available yet (no location lookup is wired in). Use an IP or IP-range rule instead.' });
    return true;
  }
  if (b.action === 'turnstile_challenge') {
    res.status(400).json({ error: 'The Turnstile-challenge action is not available yet. Use "block" or "rate_limit" instead.' });
    return true;
  }
  return false;
}

// POST /api/deployments/:id/waf/rules — Create WAF rule
wafRouter.post('/deployments/:id/waf/rules', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
  if (rejectUnsupportedRuleFields(req.body, res)) return;

  const parsed = createWafRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.wafRule.count({ where: { deploymentId: deployment.id } });
  if (existing >= 100) {
    return res.status(400).json({ error: 'This deployment already has 100 WAF rules, which is the limit. Delete one before adding another.' });
  }

  const rule = await prisma.wafRule.create({
    data: {
      deploymentId: deployment.id,
      action: parsed.data.action,
      matchType: parsed.data.matchType,
      matchValue: parsed.data.matchValue,
      description: parsed.data.description || null,
      rateLimitPerMinute: parsed.data.action === 'rate_limit' ? parsed.data.rateLimitPerMinute! : null,
      isEnabled: true,
    },
  });

  await pushWafState(deployment);
  res.status(201).json({ ok: true, rule });
});

// DELETE /api/deployments/:id/waf/rules/:ruleId — Delete WAF rule
wafRouter.delete('/deployments/:id/waf/rules/:ruleId', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const rule = await prisma.wafRule.findFirst({
    where: { id: req.params.ruleId, deploymentId: deployment.id },
  });
  if (!rule) return res.status(404).json({ error: 'WAF rule not found' });

  await prisma.wafRule.delete({ where: { id: rule.id } });
  await pushWafState(deployment);
  res.json({ ok: true });
});

// POST /api/deployments/:id/waf/turnstile — was a toggle; kept as an endpoint so old clients get a clear
// explanation instead of a 404, but it can no longer turn anything on.
wafRouter.post('/deployments/:id/waf/turnstile', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const schema = z.object({ enabled: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.enabled) {
    return res.status(400).json({ error: 'Turnstile challenge protection is not available yet. Use a "block" or "rate_limit" WAF rule, or password-protect the deployment instead.' });
  }
  res.json({ ok: true, turnstileChallenge: { enabled: false, supported: false } });
});

// POST /api/deployments/:id/waf/protection — Set or clear URL Password Protection (HTTP Basic Auth)
wafRouter.post('/deployments/:id/waf/protection', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const schema = z.object({ password: z.string().min(8).max(200).optional().nullable() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const password = parsed.data.password?.trim();
  const hash = password ? await bcrypt.hash(password, 12) : null;

  await prisma.deployment.update({
    where: { id: deployment.id },
    // Clearing deploymentProtectionPassword too: only the hash is used going forward, and there is no reason to
    // keep an older, reversible copy of a secret alongside the one-way hash that actually matters now.
    data: { deploymentProtectionPasswordHash: hash, deploymentProtectionPassword: null },
  });

  await pushWafState(deployment);
  await prisma.auditLog.create({ data: { adminId: req.user!.id, action: 'deployment.waf.protection_updated', target: `${deployment.id}: ${hash ? 'enabled' : 'disabled'}` } }).catch((err: unknown) => logger.warn({ err }, 'audit log write failed'));
  res.json({ ok: true, isProtected: Boolean(hash) });
});
