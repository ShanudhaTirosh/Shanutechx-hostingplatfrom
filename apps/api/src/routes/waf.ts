import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { env } from '../env';
import { logger } from '../lib/logger';
import { notifyAgentWafSync } from '../lib/nodeAgentClient';

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

// GET /api/deployments/:id/waf/rules — List WAF rules & security settings
wafRouter.get('/deployments/:id/waf/rules', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const rules = await prisma.wafRule.findMany({
    where: { deploymentId: deployment.id },
    orderBy: { createdAt: 'desc' },
  });

  const hasProtection = Boolean(deployment.deploymentProtectionPassword);

  res.json({
    rules,
    wafTurnstileEnabled: deployment.wafTurnstileEnabled,
    hasProtectionPassword: hasProtection,
  });
});

const createWafRuleSchema = z.object({
  action: z.enum(['allow', 'block', 'rate_limit', 'turnstile_challenge']),
  matchType: z.enum(['ip', 'ip_range', 'header', 'path', 'user_agent', 'country']),
  matchValue: z.string().min(1).max(500),
  description: z.string().max(255).optional(),
});

// POST /api/deployments/:id/waf/rules — Create WAF rule
wafRouter.post('/deployments/:id/waf/rules', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = createWafRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const rule = await prisma.wafRule.create({
    data: {
      deploymentId: deployment.id,
      action: parsed.data.action,
      matchType: parsed.data.matchType,
      matchValue: parsed.data.matchValue,
      description: parsed.data.description || null,
      isEnabled: true,
    },
  });

  // Sync updated rules with VPS node agent Traefik proxy
  void notifyAgentWafSync(deployment.node, deployment.id).catch((err) => {
    logger.warn({ err, deploymentId: deployment.id }, 'WAF rule sync warning');
  });

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

  void notifyAgentWafSync(deployment.node, deployment.id).catch((err) => {
    logger.warn({ err, deploymentId: deployment.id }, 'WAF rule sync warning');
  });

  res.json({ ok: true });
});

// POST /api/deployments/:id/waf/turnstile — Toggle Cloudflare Turnstile Challenge Protection
wafRouter.post('/deployments/:id/waf/turnstile', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const schema = z.object({ enabled: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: { wafTurnstileEnabled: parsed.data.enabled },
  });

  void notifyAgentWafSync(deployment.node, deployment.id).catch((err) => {
    logger.warn({ err, deploymentId: deployment.id }, 'Turnstile sync warning');
  });

  res.json({ ok: true, wafTurnstileEnabled: updated.wafTurnstileEnabled });
});

// POST /api/deployments/:id/waf/protection — Set or clear URL Password Protection (Basic Auth)
wafRouter.post('/deployments/:id/waf/protection', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const schema = z.object({
    password: z.string().min(4).max(100).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let protectionPasswordEnc: string | null = null;
  if (parsed.data.password && parsed.data.password.trim().length > 0) {
    protectionPasswordEnc = encryptSecret(parsed.data.password, env.secretsEncryptionKey);
  }

  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { deploymentProtectionPassword: protectionPasswordEnc },
  });

  void notifyAgentWafSync(deployment.node, deployment.id).catch((err) => {
    logger.warn({ err, deploymentId: deployment.id }, 'Protection sync warning');
  });

  res.json({ ok: true, isProtected: Boolean(protectionPasswordEnc) });
});
