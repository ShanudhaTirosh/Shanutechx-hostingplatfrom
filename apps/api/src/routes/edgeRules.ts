import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';

export const edgeRulesRouter = Router();

edgeRulesRouter.use(requireAuth);

async function loadOwnedDeployment(req: AuthedRequest, id: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { node: true },
  });
  if (!deployment) return null;
  if (!(await canAccessResource(deployment.userId, req))) return null;
  return deployment;
}

const rewriteRuleSchema = z.object({
  source: z.string().min(1).max(255),
  destination: z.string().min(1).max(500),
});

const redirectRuleSchema = z.object({
  source: z.string().min(1).max(255),
  destination: z.string().min(1).max(500),
  permanent: z.boolean().default(false),
});

const headerRuleSchema = z.object({
  source: z.string().min(1).max(255),
  headers: z.array(
    z.object({
      key: z.string().min(1).max(100),
      value: z.string().min(1).max(500),
    })
  ),
});

const cronRuleSchema = z.object({
  path: z.string().min(1).max(255),
  schedule: z.string().min(1).max(100), // Cron expression e.g. "0 * * * *"
  description: z.string().max(255).optional(),
});

const edgeRulesConfigSchema = z.object({
  rewrites: z.array(rewriteRuleSchema).optional().default([]),
  redirects: z.array(redirectRuleSchema).optional().default([]),
  headers: z.array(headerRuleSchema).optional().default([]),
  crons: z.array(cronRuleSchema).optional().default([]),
});

// GET /api/deployments/:id/edge-rules — Get Edge Rules configuration
edgeRulesRouter.get('/deployments/:id/edge-rules', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const edgeRules = (deployment.edgeRules as any) || {
    rewrites: [],
    redirects: [],
    headers: [],
    crons: [],
  };

  res.json({ edgeRules });
});

// PUT /api/deployments/:id/edge-rules — Update Edge Rules configuration
edgeRulesRouter.put('/deployments/:id/edge-rules', async (req: AuthedRequest, res) => {
  const deployment = await loadOwnedDeployment(req, req.params.id);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const parsed = edgeRulesConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: { edgeRules: parsed.data as any },
  });

  // NOTE: these are saved but not yet enforced anywhere -- there is no node-side mechanism (Traefik middleware,
  // cron scheduler, ...) wired up to read this configuration. Reporting `enforced: false` honestly rather than
  // pretending a "sync" call that used to be a no-op made any of this take effect.
  res.json({ ok: true, edgeRules: updated.edgeRules, enforced: false });
});
