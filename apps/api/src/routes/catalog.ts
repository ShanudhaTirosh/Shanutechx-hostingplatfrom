import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { env } from '../env';
import { encryptSecret } from '../lib/secretsVault';
import { invalidateCache } from '../lib/catalog/catalog-manager';
import { parseTemplateYaml, validateTemplateStructure } from '../lib/catalog/template-parser';
import { selectNodeForDeployment, NodeSelectionError } from '../lib/nodeSelector';
import { syncCatalogToFirebase } from '../lib/firebaseSync';
import { validateCustomSubdomain } from '../lib/subdomain';
import { createSubdomainRecord } from '../lib/cloudflare';

export const catalogRouter = Router();
catalogRouter.use('/catalog', requireAuth);

// ── Template catalogue ────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.resolve(__dirname, '../../../../templates');

interface TemplateMeta {
  slug: string;
  filename: string;
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  tags: string[];
  logo: string;
  port: number | null;
  requiresExposedPort: boolean;
  defaultInternalPort: number | null;
  recommendedExposureMode: 'internal_only' | 'ssl_with_proxy' | 'ssl_direct' | 'no_ssl' | 'raw_tcp';
}

// In-memory cache for template catalog
let catalogCache: { data: TemplateMeta[], expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Parse the comment-header metadata from a Coolify-style YAML template. */
function parseMeta(content: string, filename: string): TemplateMeta {
  const lines = content.split('\n');
  const meta: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^#\s+(\w+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
    if (!line.startsWith('#') && line.trim()) break;
  }
  const slug = path.basename(filename, path.extname(filename));
  const parsedPort = meta.defaultInternalPort ? parseInt(meta.defaultInternalPort, 10) : (meta.port ? parseInt(meta.port, 10) : null);
  const reqPort = meta.requiresExposedPort !== undefined
    ? meta.requiresExposedPort.toLowerCase() === 'true'
    : parsedPort !== null;
  const recMode = (meta.recommendedExposureMode as any) || (parsedPort !== null || reqPort ? 'ssl_with_proxy' : 'ssl_with_proxy');

  return {
    slug,
    filename,
    name: meta.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    slogan: meta.slogan ?? '',
    documentation: meta.documentation ?? '',
    category: meta.category ?? 'other',
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()) : [],
    logo: meta.logo ?? '',
    port: parsedPort,
    requiresExposedPort: reqPort,
    defaultInternalPort: parsedPort,
    recommendedExposureMode: recMode,
  };
}

function readCatalog(): TemplateMeta[] {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    logger.warn({ TEMPLATES_DIR }, 'Templates directory not found');
    return [];
  }
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => {
      const content = fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8');
      return parseMeta(content, f);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get cached catalog or read from disk if cache is stale.
 * Implements 5-minute TTL cache to avoid disk reads on every request.
 */
function getCachedCatalog(): TemplateMeta[] {
  const now = Date.now();
  
  if (catalogCache && now < catalogCache.expiresAt) {
    return catalogCache.data;
  }
  
  // Cache miss or expired - read from disk
  logger.info('Catalog cache miss - reading from disk');
  const data = readCatalog();
  catalogCache = {
    data,
    expiresAt: now + CACHE_TTL,
  };
  
  return data;
}

/**
 * Manually invalidate catalog cache (useful for testing or when templates are updated).
 * Can be called from admin endpoints if needed.
 */
export function invalidateCatalogCache(): void {
  catalogCache = null;
  logger.info('Catalog cache invalidated');
}

/** Build the URL to call a node-agent endpoint. */
function nodeAgentUrl(nodeIp: string, path: string) {
  return `http://${nodeIp}:${env.nodeAgentPort}${path}`;
}

/**
 * GET /api/catalog/nodes
 * Returns active nodes available for template deployments (admin/dev only).
 * MUST be registered before /catalog/:slug so 'nodes' is not matched as a slug.
 */
catalogRouter.get('/catalog/nodes', requireAdminOrDev, async (_req, res) => {
  const nodes = await prisma.node.findMany({
    select: { id: true, label: true, ip: true, isActive: true },
    where: { isActive: true },
    orderBy: { label: 'asc' },
  });
  res.json({ nodes: nodes.map((n: any) => ({ id: n.id, name: n.label, location: n.ip, status: n.isActive ? 'online' : 'offline' })) });
});

/**
 * GET /api/catalog
 * Searchable catalog of all YAML templates.
 */
catalogRouter.get('/catalog', (_req, res) => {
  try {
    let catalog = getCachedCatalog();
    const { search, category } = _req.query as Record<string, string>;

    if (category && category !== 'all') {
      catalog = catalog.filter((t) => t.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      catalog = catalog.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slogan.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    const allCats = [...new Set(getCachedCatalog().map((t) => t.category))].sort();
    res.json({ templates: catalog, categories: allCats, total: catalog.length });
  } catch (err: any) {
    logger.error({ err }, 'Failed to read template catalog');
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug);
}

/**
 * GET /api/catalog/:slug
 * Returns full YAML content for a specific template.
 * Access: All authenticated users
 */
catalogRouter.get('/catalog/:slug', (req, res) => {
  if (!isValidSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid template slug format' });
  const filename = `${req.params.slug}.yaml`;
  const filePath = path.join(TEMPLATES_DIR, filename);
  const altPath = path.join(TEMPLATES_DIR, `${req.params.slug}.yml`);
  const resolved = fs.existsSync(filePath) ? filePath : fs.existsSync(altPath) ? altPath : null;
  if (!resolved) return res.status(404).json({ error: 'Template not found' });

  const content = fs.readFileSync(resolved, 'utf8');
  const meta = parseMeta(content, path.basename(resolved));
  res.json({ template: { ...meta, yaml: content } });
});

// ── Template deploy ───────────────────────────────────────────────────────────

// Auto-generated secret keys for catalog templates
const AUTO_GENERATED_SECRET_KEYS: Record<string, string[]> = {
  lavalink: ['LAVALINK_PASSWORD'],
  livekit: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'],
  mongodb: ['MONGO_INITDB_ROOT_PASSWORD'],
  n8n: ['DB_POSTGRESDB_PASSWORD'],
  redis: ['REDIS_PASSWORD'],
  wordpress: ['MYSQL_ROOT_PASSWORD', 'WORDPRESS_DB_PASSWORD'],
  'hermes-agent': ['HERMES_SECRET_KEY'],
  grafana: ['GF_SECURITY_ADMIN_PASSWORD'],
  'uptime-kuma': ['UPTIME_KUMA_SECRET'],
  'supabase-lite': ['POSTGRES_PASSWORD'],
};

function generateStrongSecret(): string {
  return crypto.randomBytes(24).toString('base64url');
}

import { scanTextForAbuse, banUserAndTeardownResources } from '../lib/abuseDetector';

const deploySchema = z
  .object({
    slug: z.string().min(1).optional(),
    templateSlug: z.string().min(1).optional(),
    nodeId: z.string().min(1),
    envVars: z.record(z.string()).optional(),
    projectName: z.string().min(1).optional(),
    teamId: z.string().nullable().optional(),
  })
  .refine((data) => data.slug || data.templateSlug, {
    message: 'slug or templateSlug is required',
  });

/**
 * POST /api/catalog/deploy
 * Deploys a template via the node-agent docker compose endpoint.
 * B-04 FIX: Must be registered BEFORE /catalog/:slug so 'deploy' is not treated as a slug parameter.
 */
catalogRouter.post('/catalog/deploy', async (req: AuthedRequest, res) => {
  const parsed = deploySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const slug = parsed.data.slug || parsed.data.templateSlug!;
  const { nodeId: inputNodeId, envVars: customerEnvVars = {}, projectName, teamId } = parsed.data;

  // Abuse protection scan on environment variables & project name
  const abuseScanText = JSON.stringify(customerEnvVars) + (projectName || '') + slug;
  const abuseCheck = scanTextForAbuse(abuseScanText);
  if (abuseCheck.flagged) {
    await banUserAndTeardownResources({
      userId: req.user!.id,
      reason: `Prohibited content detected during catalog deployment: ${abuseCheck.reason}`,
      detectedBy: 'Automated Abuse Scanner (Catalog Deployment)',
    });
    return res.status(403).json({ error: `Account suspended due to policy violation: ${abuseCheck.reason}` });
  }

  const envVars = { ...customerEnvVars };
  const generatedSecrets: Record<string, string> = {};
  for (const key of AUTO_GENERATED_SECRET_KEYS[slug] ?? []) {
    if (!envVars[key]) {
      const value = generateStrongSecret();
      envVars[key] = value;
      generatedSecrets[key] = value;
    }
  }

  const filename = `${slug}.yaml`;
  const filePath = path.join(TEMPLATES_DIR, filename);
  const altPath = path.join(TEMPLATES_DIR, `${slug}.yml`);
  const resolved = fs.existsSync(filePath) ? filePath : fs.existsSync(altPath) ? altPath : null;
  if (!resolved) return res.status(404).json({ error: `Template "${slug}" not found` });

  let composeName = `${slug}-${Date.now().toString(36)}`;
  if (projectName && projectName.trim()) {
    const val = await validateCustomSubdomain(projectName);
    if (!val.valid || !val.formatted) {
      return res.status(400).json({ error: val.error ?? 'Invalid project name' });
    }
    composeName = val.formatted;
  }

  const yamlContent = fs.readFileSync(resolved, 'utf8');
  const meta = parseMeta(yamlContent, path.basename(resolved));

  // Auto-detect and generate any missing $SERVICE_PASSWORD_* placeholders in template YAML
  const servicePasswordMatches = Array.from(new Set(yamlContent.match(/\$SERVICE_PASSWORD_[A-Za-z0-9_]+/g) || []));
  for (const rawMatch of servicePasswordMatches) {
    const envKey = rawMatch.replace(/^\$/, '');
    if (!envVars[envKey]) {
      const value = generateStrongSecret();
      envVars[envKey] = value;
      generatedSecrets[envKey] = value;
    }
  }

  const isAdmin = req.user!.role === 'admin' || req.user!.role === 'dev';
  if (!isAdmin && inputNodeId && inputNodeId !== 'default') {
    return res.status(403).json({ error: 'Explicit node selection is restricted to administrators and dev staff' });
  }

  let node;
  try {
    node = await selectNodeForDeployment({
      requiredTag: 'node-hosting',
      isAdminDeployment: isAdmin,
      explicitNodeId: isAdmin && inputNodeId !== 'default' ? inputNodeId : undefined,
    });
  } catch (err) {
    if (err instanceof NodeSelectionError) return res.status(409).json({ error: err.message });
    throw err;
  }

  const targetSubdomain = meta.requiresExposedPort !== false ? composeName : null;

  // Verify uniqueness before calling node agent to prevent concurrent name collisions (MED-04)
  const existingDeployment = await prisma.deployment.findFirst({
    where: {
      OR: [
        { containerId: composeName },
        ...(targetSubdomain ? [{ subdomain: targetSubdomain }] : []),
      ],
    },
  });
  if (existingDeployment) {
    return res.status(409).json({ error: `Deployment with project name or subdomain "${composeName}" already exists` });
  }

  // Pre-reserve deployment record in pending status
  let deployment;
  try {
    deployment = await prisma.deployment.create({
      data: {
        userId: req.user!.id,
        teamId: teamId ?? null,
        nodeId: node.id,
        status: 'pending',
        containerId: composeName,
        subdomain: targetSubdomain,
        repoUrl: `template:${slug}`,
        internalPort: meta.port ?? 80,
        exposureMode: meta.recommendedExposureMode || 'ssl_with_proxy',
      },
    });
  } catch (createErr: any) {
    if (createErr?.code === 'P2002') {
      return res.status(409).json({ error: `Subdomain or deployment name "${composeName}" is already reserved` });
    }
    throw createErr;
  }

  try {
    const agentRes = await fetch(nodeAgentUrl(node.ip, '/agent/compose/up'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-secret': env.nodeAgentSecret,
      },
      body: JSON.stringify({ composeYaml: yamlContent, projectName: composeName, envVars }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!agentRes.ok) {
      await prisma.deployment.delete({ where: { id: deployment.id } }).catch(() => {});
      const body = (await agentRes.json().catch(() => ({}))) as Record<string, unknown>;
      return res.status(agentRes.status).json({ error: (body.error as string) ?? 'Agent error' });
    }

    const agentData = await agentRes.json() as Record<string, unknown>;

    if (targetSubdomain && node.ip) {
      try {
        await createSubdomainRecord(targetSubdomain, node.ip, true);
        logger.info({ targetSubdomain, ip: node.ip }, 'Auto-registered Cloudflare SSL proxy DNS record for catalog deployment');
      } catch (dnsErr) {
        logger.warn({ dnsErr, targetSubdomain }, 'Cloudflare DNS auto-record registration skipped or failed');
      }
    }

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'running' },
    });

    const managedDatabasesCreated: any[] = [];
    const templateDbTypes: Array<{ type: 'postgres' | 'mysql' | 'redis' | 'mongodb'; port: number; secretKey?: string; serviceName?: string }> = [];

    if (slug === 'wordpress') {
      templateDbTypes.push({ type: 'mysql', port: 3306, secretKey: 'WORDPRESS_DB_PASSWORD', serviceName: 'db' });
    } else if (slug === 'n8n') {
      templateDbTypes.push({ type: 'postgres', port: 5432, secretKey: 'DB_POSTGRESDB_PASSWORD', serviceName: 'postgres' });
    } else if (slug === 'redis') {
      templateDbTypes.push({ type: 'redis', port: 6379, secretKey: 'REDIS_PASSWORD', serviceName: 'redis' });
    } else if (slug === 'mongodb') {
      templateDbTypes.push({ type: 'mongodb', port: 27017, secretKey: 'MONGO_INITDB_ROOT_PASSWORD', serviceName: 'mongodb' });
    } else if (slug === 'hermes-agent') {
      templateDbTypes.push({ type: 'redis', port: 6379, secretKey: 'HERMES_SECRET_KEY', serviceName: 'redis' });
    } else if (slug === 'supabase-lite') {
      templateDbTypes.push({ type: 'postgres', port: 5432, secretKey: 'POSTGRES_PASSWORD', serviceName: 'postgres' });
    }

    for (const dbMeta of templateDbTypes) {
      const dbPassword = (dbMeta.secretKey && envVars[dbMeta.secretKey]) || (dbMeta.secretKey && generatedSecrets[dbMeta.secretKey]) || generateStrongSecret();
      const encCred = encryptSecret(dbPassword, env.secretsEncryptionKey);
      const hostName = dbMeta.serviceName || `${composeName}-db`;
      const mDb = await prisma.managedDatabase.create({
        data: {
          userId: req.user!.id,
          nodeId: node.id,
          type: dbMeta.type,
          status: 'running',
          containerId: `${composeName}-${hostName}`,
          internalHost: hostName,
          internalPort: dbMeta.port,
          credentialRef: encCred,
        },
      });
      managedDatabasesCreated.push({ id: mDb.id, type: mDb.type, internalHost: mDb.internalHost, internalPort: mDb.internalPort });
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `catalog.deploy:${slug}`,
        target: deployment.id,
      },
    });

    logger.info({ slug, nodeId: node.id, deploymentId: deployment.id, databases: managedDatabasesCreated.length }, 'Template deployed with automated database wiring');
    res.status(201).json({
      deployment,
      agent: agentData,
      ...(managedDatabasesCreated.length > 0 ? { managedDatabases: managedDatabasesCreated } : {}),
      ...(Object.keys(generatedSecrets).length > 0 ? { generatedSecrets } : {}),
    });
  } catch (err: any) {
    logger.error({ err, slug, nodeId: node?.id }, 'Failed to deploy template');
    res.status(500).json({ error: err.message ?? 'Deploy failed' });
  }
});

/**
 * POST /api/catalog/:slug
 * Create a new template in the catalog.
 * Access: Admin and Dev only
 */
const createTemplateSchema = z.object({
  name: z.string().optional(),
  slogan: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  logo: z.string().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  documentation: z.string().optional(),
  yaml: z.string().min(1), // Full YAML content including services
});

catalogRouter.post('/catalog/:slug', requireRole('admin', 'dev'), async (req: AuthedRequest, res) => {
  const rawSlug = String(req.params.slug || '').trim().toLowerCase();
  if (!isValidSlug(rawSlug)) return res.status(400).json({ error: 'Invalid template slug format' });
  try {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid template data', details: parsed.error.flatten() });
    }

    const slug = rawSlug;
    const { yaml, name, slogan, category, tags, logo, port, documentation } = parsed.data;

    // Check if template already exists
    const filename = `${slug}.yaml`;
    const filePath = path.join(TEMPLATES_DIR, filename);
    const altPath = path.join(TEMPLATES_DIR, `${slug}.yml`);
    
    if (fs.existsSync(filePath) || fs.existsSync(altPath)) {
      return res.status(409).json({ error: 'Template already exists', slug });
    }

    // Validate YAML syntax and structure
    let templateDetails;
    const tempPath = path.join(os.tmpdir(), `.stx-temp-${slug}-${Date.now()}.yaml`);
    try {
      fs.writeFileSync(tempPath, yaml, 'utf8');
      templateDetails = parseTemplateYaml(tempPath);
    } catch (parseError: any) {
      return res.status(400).json({ 
        error: 'Invalid YAML syntax', 
        details: parseError.message 
      });
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
    }

    // Validate template structure
    const validation = validateTemplateStructure(templateDetails);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Template validation failed', 
        details: validation.errors 
      });
    }

    // Build comment header from provided metadata
    const commentLines: string[] = [];
    if (name) commentLines.push(`# name: ${name}`);
    if (documentation) commentLines.push(`# documentation: ${documentation}`);
    if (slogan) commentLines.push(`# slogan: ${slogan}`);
    if (category) commentLines.push(`# category: ${category}`);
    if (tags && tags.length > 0) commentLines.push(`# tags: ${tags.join(',')}`);
    if (logo) commentLines.push(`# logo: ${logo}`);
    if (port !== null && port !== undefined) commentLines.push(`# port: ${port}`);
    
    // Extract YAML content without comment header (if any)
    const yamlLines = yaml.split('\n');
    const contentStart = yamlLines.findIndex(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });
    
    const yamlContent = contentStart >= 0 ? yamlLines.slice(contentStart).join('\n') : yaml;
    
    // Combine comment header with YAML content
    const finalContent = commentLines.length > 0 
      ? `${commentLines.join('\n')}\n\n${yamlContent}`
      : yamlContent;

    // Write the new template file
    fs.writeFileSync(filePath, finalContent, 'utf8');

    // Invalidate catalog cache
    invalidateCache();
    invalidateCatalogCache();
    void syncCatalogToFirebase().catch(() => {});

    // Parse the created file to return consistent metadata
    const createdTemplate = parseTemplateYaml(filePath);

    // Log audit event
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `catalog.create:${slug}`,
        target: slug,
      },
    });

    logger.info({ slug, userId: req.user!.id }, 'Template created');

    res.status(201).json({ 
      template: {
        slug: createdTemplate.slug,
        filename: createdTemplate.filename,
        name: createdTemplate.name,
        slogan: createdTemplate.slogan,
        documentation: createdTemplate.documentation,
        category: createdTemplate.category,
        tags: createdTemplate.tags,
        logo: createdTemplate.logo,
        port: createdTemplate.port,
      }
    });
  } catch (err: any) {
    logger.error({ err, slug: req.params.slug }, 'Failed to create template');
    res.status(500).json({ error: 'Failed to create template', details: err.message });
  }
});

/**
 * PATCH /api/catalog/:slug
 * Update an existing template in the catalog.
 * Access: Admin and Dev only
 */
const updateTemplateSchema = z.object({
  name: z.string().optional(),
  slogan: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  logo: z.string().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  documentation: z.string().optional(),
  yaml: z.string().optional(), // Full YAML content including services (optional for partial updates)
});

catalogRouter.patch('/catalog/:slug', requireRole('admin', 'dev'), async (req: AuthedRequest, res) => {
  if (!isValidSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid template slug format' });
  try {
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid template data', details: parsed.error.flatten() });
    }

    const { slug } = req.params;
    const updates = parsed.data;

    // Find existing template file
    const filename = `${slug}.yaml`;
    const filePath = path.join(TEMPLATES_DIR, filename);
    const altPath = path.join(TEMPLATES_DIR, `${slug}.yml`);
    const resolved = fs.existsSync(filePath) ? filePath : fs.existsSync(altPath) ? altPath : null;
    
    if (!resolved) {
      return res.status(404).json({ error: 'Template not found', slug });
    }

    // Read existing content
    const existingContent = fs.readFileSync(resolved, 'utf8');
    
    // Parse existing template to get current metadata
    const existingTemplate = parseTemplateYaml(resolved);

    // Determine what to update
    let finalYaml: string;
    
    if (updates.yaml) {
      const tempPath = path.join(os.tmpdir(), `.stx-temp-${slug}-${Date.now()}.yaml`);
      try {
        fs.writeFileSync(tempPath, updates.yaml, 'utf8');
        
        const newTemplateDetails = parseTemplateYaml(tempPath);
        
        const validation = validateTemplateStructure(newTemplateDetails);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: 'Template validation failed', 
            details: validation.errors 
          });
        }
        
        finalYaml = updates.yaml;
      } catch (parseError: any) {
        return res.status(400).json({ 
          error: 'Invalid YAML syntax', 
          details: parseError.message 
        });
      } finally {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
      }
    } else {
      // Metadata-only update - preserve existing YAML content
      finalYaml = existingContent;
    }

    // Build new comment header (merge existing with updates)
    const metadata = {
      name: updates.name ?? existingTemplate.name,
      documentation: updates.documentation ?? existingTemplate.documentation,
      slogan: updates.slogan ?? existingTemplate.slogan,
      category: updates.category ?? existingTemplate.category,
      tags: updates.tags ?? existingTemplate.tags,
      logo: updates.logo ?? existingTemplate.logo,
      port: updates.port !== undefined ? updates.port : existingTemplate.port,
    };

    const commentLines: string[] = [];
    if (metadata.name) commentLines.push(`# name: ${metadata.name}`);
    if (metadata.documentation) commentLines.push(`# documentation: ${metadata.documentation}`);
    if (metadata.slogan) commentLines.push(`# slogan: ${metadata.slogan}`);
    if (metadata.category) commentLines.push(`# category: ${metadata.category}`);
    if (metadata.tags && metadata.tags.length > 0) commentLines.push(`# tags: ${metadata.tags.join(',')}`);
    if (metadata.logo) commentLines.push(`# logo: ${metadata.logo}`);
    if (metadata.port !== null && metadata.port !== undefined) commentLines.push(`# port: ${metadata.port}`);

    // Extract YAML content without comment header
    const yamlLines = finalYaml.split('\n');
    const contentStart = yamlLines.findIndex(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });
    
    const yamlContent = contentStart >= 0 ? yamlLines.slice(contentStart).join('\n') : finalYaml;
    
    // Combine new comment header with YAML content
    const finalContent = commentLines.length > 0 
      ? `${commentLines.join('\n')}\n\n${yamlContent}`
      : yamlContent;

    // Write updated template
    fs.writeFileSync(resolved, finalContent, 'utf8');

    // Invalidate catalog cache
    invalidateCache();
    invalidateCatalogCache();
    void syncCatalogToFirebase().catch(() => {});

    // Parse the updated file to return consistent metadata
    const updatedTemplate = parseTemplateYaml(resolved);

    // Log audit event
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `catalog.update:${slug}`,
        target: slug,
      },
    });

    logger.info({ slug, userId: req.user!.id }, 'Template updated');

    res.json({ 
      template: {
        slug: updatedTemplate.slug,
        filename: updatedTemplate.filename,
        name: updatedTemplate.name,
        slogan: updatedTemplate.slogan,
        documentation: updatedTemplate.documentation,
        category: updatedTemplate.category,
        tags: updatedTemplate.tags,
        logo: updatedTemplate.logo,
        port: updatedTemplate.port,
      }
    });
  } catch (err: any) {
    logger.error({ err, slug: req.params.slug }, 'Failed to update template');
    res.status(500).json({ error: 'Failed to update template', details: err.message });
  }
});

/**
 * DELETE /api/catalog/:slug
 * Delete a template from the catalog.
 * Access: Admin and Dev only
 */
catalogRouter.delete('/catalog/:slug', requireRole('admin', 'dev'), async (req: AuthedRequest, res) => {
  if (!isValidSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid template slug format' });
  try {
    const { slug } = req.params;

    // Find existing template file
    const filename = `${slug}.yaml`;
    const filePath = path.join(TEMPLATES_DIR, filename);
    const altPath = path.join(TEMPLATES_DIR, `${slug}.yml`);
    const resolved = fs.existsSync(filePath) ? filePath : fs.existsSync(altPath) ? altPath : null;
    
    if (!resolved) {
      return res.status(404).json({ error: 'Template not found', slug });
    }

    // Delete the file
    fs.unlinkSync(resolved);

    // Invalidate catalog cache
    invalidateCache();
    invalidateCatalogCache();
    void syncCatalogToFirebase().catch(() => {});

    // Log audit event
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: `catalog.delete:${slug}`,
        target: slug,
      },
    });

    logger.info({ slug, userId: req.user!.id }, 'Template deleted');

    res.json({ success: true, slug });
  } catch (err: any) {
    logger.error({ err, slug: req.params.slug }, 'Failed to delete template');
    res.status(500).json({ error: 'Failed to delete template', details: err.message });
  }
});


