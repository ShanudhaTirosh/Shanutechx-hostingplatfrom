import { Router } from 'express';
import fs from 'fs';
import path from 'path';
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

export const catalogRouter = Router();
catalogRouter.use(requireAuth);

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
  return {
    slug,
    filename,
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    slogan: meta.slogan ?? '',
    documentation: meta.documentation ?? '',
    category: meta.category ?? 'other',
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()) : [],
    logo: meta.logo ?? '',
    port: meta.port ? parseInt(meta.port, 10) : null,
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
  return typeof slug === 'string' && /^[a-z0-9-]+$/i.test(slug);
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
  if (!isValidSlug(req.params.slug)) return res.status(400).json({ error: 'Invalid template slug format' });
  try {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid template data', details: parsed.error.flatten() });
    }

    const { slug } = req.params;
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
    try {
      // Create temporary file to parse
      const tempPath = path.join(TEMPLATES_DIR, `.temp-${slug}.yaml`);
      fs.writeFileSync(tempPath, yaml, 'utf8');
      
      templateDetails = parseTemplateYaml(tempPath);
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
    } catch (parseError: any) {
      return res.status(400).json({ 
        error: 'Invalid YAML syntax', 
        details: parseError.message 
      });
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
      // Full YAML replacement - validate new YAML
      try {
        const tempPath = path.join(TEMPLATES_DIR, `.temp-${slug}.yaml`);
        fs.writeFileSync(tempPath, updates.yaml, 'utf8');
        
        const newTemplateDetails = parseTemplateYaml(tempPath);
        fs.unlinkSync(tempPath);
        
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
      }
    } else {
      // Metadata-only update - preserve existing YAML content
      finalYaml = existingContent;
    }

    // Build new comment header (merge existing with updates)
    const metadata = {
      documentation: updates.documentation ?? existingTemplate.documentation,
      slogan: updates.slogan ?? existingTemplate.slogan,
      category: updates.category ?? existingTemplate.category,
      tags: updates.tags ?? existingTemplate.tags,
      logo: updates.logo ?? existingTemplate.logo,
      port: updates.port !== undefined ? updates.port : existingTemplate.port,
    };

    const commentLines: string[] = [];
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
  // 24 random bytes, base64url-encoded (~32 chars, alphanumeric-ish,
  // safe to embed directly in a Compose env value with no quoting
  // concerns) — plenty of entropy for a service credential.
  return crypto.randomBytes(24).toString('base64url');
}

import { scanTextForAbuse, banUserAndTeardownResources } from '../lib/abuseDetector';

const deploySchema = z.object({
  slug: z.string().min(1),
  nodeId: z.string().min(1),
  envVars: z.record(z.string()).optional(),
  projectName: z.string().min(1).optional(),
  teamId: z.string().nullable().optional(),
});

/**
 * POST /api/catalog/deploy
 * Deploys a template via the node-agent docker compose endpoint.
 */
catalogRouter.post('/catalog/deploy', async (req: AuthedRequest, res) => {
  const parsed = deploySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { slug, nodeId: inputNodeId, envVars: customerEnvVars = {}, projectName, teamId } = parsed.data;

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

  // Fill in any required secret the customer didn't supply with a fresh,
  // strong random value (see AUTO_GENERATED_SECRET_KEYS above). Track
  // which ones we generated so we can hand them back in the response --
  // this is the only time they're ever shown, so the customer needs to
  // save them now.
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

  const yamlContent = fs.readFileSync(resolved, 'utf8');
  const meta = parseMeta(yamlContent, path.basename(resolved));
  const composeName = projectName ?? `${slug}-${Date.now().toString(36)}`;

  const isAdmin = req.user!.role === 'admin' || req.user!.role === 'dev';
  let node;
  try {
    node = await selectNodeForDeployment({
      requiredTag: 'node-hosting',
      isAdminDeployment: isAdmin,
      explicitNodeId: inputNodeId !== 'default' ? inputNodeId : undefined,
    });
  } catch (err) {
    if (err instanceof NodeSelectionError) return res.status(409).json({ error: err.message });
    throw err;
  }

  const nodeId = node.id;

  try {
    const agentRes = await fetch(nodeAgentUrl(node.ip, '/agent/compose/up'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-secret': env.nodeAgentSecret,
      },
      body: JSON.stringify({ composeYaml: yamlContent, projectName: composeName, envVars }),
    });

    if (!agentRes.ok) {
      const body = (await agentRes.json().catch(() => ({}))) as Record<string, unknown>;
      return res.status(agentRes.status).json({ error: (body.error as string) ?? 'Agent error' });
    }

    const agentData = await agentRes.json() as Record<string, unknown>;

    const deployment = await prisma.deployment.create({
      data: {
        userId: req.user!.id,
        teamId: teamId ?? null,
        nodeId,
        status: 'running',
        containerId: composeName,
        subdomain: composeName,
        repoUrl: `template:${slug}`,
        internalPort: meta.port ?? 80,
      },
    });

    // Automatic Managed Database provisioning & connection wiring for templates requiring database services
    const managedDatabasesCreated: any[] = [];
    const templateDbTypes: Array<{ type: 'postgres' | 'mysql' | 'redis' | 'mongodb'; port: number; secretKey?: string }> = [];

    if (slug === 'wordpress') {
      templateDbTypes.push({ type: 'mysql', port: 3306, secretKey: 'WORDPRESS_DB_PASSWORD' });
    } else if (slug === 'n8n') {
      templateDbTypes.push({ type: 'postgres', port: 5432, secretKey: 'DB_POSTGRESDB_PASSWORD' });
    } else if (slug === 'redis') {
      templateDbTypes.push({ type: 'redis', port: 6379, secretKey: 'REDIS_PASSWORD' });
    } else if (slug === 'mongodb') {
      templateDbTypes.push({ type: 'mongodb', port: 27017, secretKey: 'MONGO_INITDB_ROOT_PASSWORD' });
    } else if (slug === 'hermes-agent') {
      templateDbTypes.push({ type: 'redis', port: 6379, secretKey: 'HERMES_SECRET_KEY' });
    } else if (slug === 'supabase-lite') {
      templateDbTypes.push({ type: 'postgres', port: 5432, secretKey: 'POSTGRES_PASSWORD' });
    }

    for (const dbMeta of templateDbTypes) {
      const dbPassword = (dbMeta.secretKey && envVars[dbMeta.secretKey]) || (dbMeta.secretKey && generatedSecrets[dbMeta.secretKey]) || generateStrongSecret();
      const encCred = encryptSecret(dbPassword, env.secretsEncryptionKey);
      const mDb = await prisma.managedDatabase.create({
        data: {
          userId: req.user!.id,
          nodeId,
          type: dbMeta.type,
          status: 'running',
          containerId: `${composeName}-${dbMeta.type}`,
          internalHost: `${composeName}-db`,
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

    logger.info({ slug, nodeId, deploymentId: deployment.id, databases: managedDatabasesCreated.length }, 'Template deployed with automated database wiring');
    res.status(201).json({
      deployment,
      agent: agentData,
      ...(managedDatabasesCreated.length > 0 ? { managedDatabases: managedDatabasesCreated } : {}),
      // Only present if we generated any secret the customer didn't
      // supply -- shown once, not persisted anywhere in retrievable
      // plaintext form, so the frontend must surface these to the
      // customer immediately (e.g. a "save these now" dialog) and never
      // rely on fetching them again later.
      ...(Object.keys(generatedSecrets).length > 0 ? { generatedSecrets } : {}),
    });
  } catch (err: any) {
    logger.error({ err, slug, nodeId }, 'Failed to deploy template');
    res.status(500).json({ error: err.message ?? 'Deploy failed' });
  }
});
