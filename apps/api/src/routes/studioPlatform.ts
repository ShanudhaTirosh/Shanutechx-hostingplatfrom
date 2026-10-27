import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { logger } from '../lib/logger';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { decryptSecret } from '../lib/secretsVault';
import undici from 'undici';

export const studioPlatformRouter = Router();

// Internal Secret or Authenticated Admin/Dev Guard
function verifyStudioAccess(req: Request, res: Response, next: NextFunction) {
  // If internal agent secret header is provided
  const internalSecret = req.headers['x-internal-secret'] || req.headers['x-agent-secret'];
  if (internalSecret && (internalSecret === env.discordInternalSecret || internalSecret === env.nodeAgentSecret)) {
    return next();
  }

  // Local loopback calls (e.g. Studio running in container or host calling platform API locally)
  const remoteIp = req.socket.remoteAddress || '';
  if (remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp.includes('127.0.0.1')) {
    return next();
  }

  // Otherwise, require cryptographic authentication token (Firebase Auth Bearer token)
  return requireAuth(req as AuthedRequest, res, () => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Missing user identity for Supabase Studio.' });
    }

    // Dev superuser role has unrestricted access across the platform
    if (user.role === 'dev') {
      return next();
    }

    if (user.role !== 'admin') {
      logger.warn({ userId: user.id, role: user.role }, 'Non-admin/dev access attempt on Studio Platform API blocked');
      return res.status(403).json({ error: 'Access denied. Dev or Admin role required for Supabase Admin Studio.' });
    }

    const allowedList = env.allowedAdminEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = user.email.toLowerCase();
    if (allowedList.length > 0 && !allowedList.includes(userEmail) && !allowedList.includes('*')) {
      logger.warn({ userEmail, allowedList }, 'Unauthorized email attempt on Studio Platform API');
      return res.status(403).json({ error: 'Access denied. Email unauthorized for Supabase Admin Studio.' });
    }

    next();
  });
}

studioPlatformRouter.use(verifyStudioAccess);

// Profile
studioPlatformRouter.get('/profile', (req: Request, res: Response) => {
  const allowedEmail = env.allowedAdminEmails.split(',')[0]?.trim() || 'tiroshbrot123@gmail.com';
  res.json({
    id: allowedEmail,
    primary_email: allowedEmail,
    username: allowedEmail.split('@')[0],
    first_name: 'ShanuTechX',
    last_name: 'Developer',
    is_alpha_user: true,
    free_project_limit: 100,
  });
});

// Profile Permissions (Crucial for Studio UI to render action controls & tabs)
studioPlatformRouter.get('/profile/permissions', (_req: Request, res: Response) => {
  res.json([
    {
      action: '*',
      resource_name: '*',
      organization_id: 1,
    },
  ]);
});

// Deployment Mode
studioPlatformRouter.get('/deployment-mode', (_req: Request, res: Response) => {
  res.json({ is_cli_mode: false, is_platform: true });
});

// Notifications
studioPlatformRouter.get('/notifications', (_req: Request, res: Response) => res.json([]));
studioPlatformRouter.get('/notifications/summary', (_req: Request, res: Response) => res.json({ unread_count: 0 }));

// Organizations List
studioPlatformRouter.get('/organizations', (_req: Request, res: Response) => {
  const allowedEmail = env.allowedAdminEmails.split(',')[0]?.trim() || 'tiroshbrot123@gmail.com';
  res.json([
    {
      id: 1,
      slug: 'shanutechx-org',
      name: 'ShanuTechX Enterprise',
      billing_email: allowedEmail,
    },
  ]);
});

// Single Organization Details
studioPlatformRouter.get('/organizations/:slug', (req: Request, res: Response) => {
  const allowedEmail = env.allowedAdminEmails.split(',')[0]?.trim() || 'tiroshbrot123@gmail.com';
  res.json({
    id: 1,
    slug: req.params.slug || 'shanutechx-org',
    name: 'ShanuTechX Enterprise',
    billing_email: allowedEmail,
  });
});

// Organization Members
studioPlatformRouter.get('/organizations/:slug/members', (_req: Request, res: Response) => {
  const allowedEmail = env.allowedAdminEmails.split(',')[0]?.trim() || 'tiroshbrot123@gmail.com';
  res.json([
    {
      id: 1,
      primary_email: allowedEmail,
      username: allowedEmail.split('@')[0],
      role_name: 'Owner',
      is_owner: true,
    },
  ]);
});

// Organization Roles
studioPlatformRouter.get('/organizations/:slug/roles', (_req: Request, res: Response) => {
  res.json([
    { id: 1, name: 'Owner' },
    { id: 2, name: 'Administrator' },
    { id: 3, name: 'Developer' },
  ]);
});

// Organization Available Postgres Versions
studioPlatformRouter.get('/organizations/:slug/available-versions', (_req: Request, res: Response) => {
  res.json(['15.1.1.78', '16.3.0.0', '17.0.0.0']);
});

// Organization Subscription / Billing
studioPlatformRouter.get('/organizations/:slug/billing/subscription', (_req: Request, res: Response) => {
  res.json({
    tier: { name: 'Enterprise (Self-Hosted Cloud Unlimited)', id: 'enterprise' },
    billing_via_partner: false,
  });
});

// Helper to format database record into Studio platform project schema
function formatStudioPlatformProject(p: any) {
  const targetHost = p.nodeIp || '127.0.0.1';
  const apiPort = p.apiPort ?? 8001;
  const dbPort = p.dbPort ?? 5432;
  const rootDomain = env.rootDomain || 'shanutechx.com';
  const cleanSlug = p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '') : 'default';
  const hostSubdomain = `supabase-${cleanSlug}.${rootDomain}`;

  const isLocalHost = !p.nodeIp || p.nodeIp === '127.0.0.1' || p.nodeIp === 'localhost';
  const apiUrl = isLocalHost ? `http://localhost:${apiPort}` : `http://${hostSubdomain}:${apiPort}`;

  let dbPass = 'postgres';
  if (p.dbPasswordEnc) {
    try {
      dbPass = decryptSecret(p.dbPasswordEnc, env.secretsEncryptionKey);
    } catch (e) {
      logger.warn({ err: e, id: p.id }, 'Failed decrypting dbPasswordEnc for studio project');
    }
  }

  let jwtSecret = 'secret';
  if (p.jwtSecretEnc) {
    try {
      jwtSecret = decryptSecret(p.jwtSecretEnc, env.secretsEncryptionKey);
    } catch {}
  }

  const dbUrl = `postgresql://postgres:${encodeURIComponent(dbPass)}@${targetHost}:${dbPort}/${p.dbName || 'postgres'}`;

  return {
    id: p.id,
    ref: p.id,
    name: p.name,
    organization_id: 1,
    status: p.status === 'ACTIVE' ? 'ACTIVE_HEALTHY' : p.status,
    region: p.region || 'ap-southeast-1',
    cloud_provider: 'AWS',
    inserted_at: p.createdAt,
    endpoint: apiUrl,
    db_host: targetHost,
    db_port: dbPort,
    db_name: p.dbName || 'postgres',
    db_user: 'postgres',
    jwt_secret: jwtSecret,
    service_key: p.serviceKey || p.serviceKeyEnc || p.anonKey || 'service_key',
    anon_key: p.anonKey || 'anon_key',
    connectionString: dbUrl,
  };
}

// List Projects (for Official Supabase Studio Dropdown Switcher)
studioPlatformRouter.get('/projects', async (_req: Request, res: Response) => {
  try {
    const dbProjects = await prisma.supabaseClientProject.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const formattedProjects = dbProjects.map(formatStudioPlatformProject);
    res.json(formattedProjects);
  } catch (err: any) {
    logger.error({ err }, 'Failed listing platform projects for studio');
    res.status(500).json({ error: 'Failed retrieving platform projects' });
  }
});

// Organization Projects List
studioPlatformRouter.get('/organizations/:slug/projects', async (_req: Request, res: Response) => {
  try {
    const dbProjects = await prisma.supabaseClientProject.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(dbProjects.map(formatStudioPlatformProject));
  } catch (err: any) {
    logger.error({ err }, 'Failed listing org projects for studio');
    res.status(500).json({ error: 'Failed retrieving org projects' });
  }
});

// Get Project Details by Ref
studioPlatformRouter.get('/projects/:ref', async (req: Request, res: Response) => {
  try {
    const { ref } = req.params;
    const project = await prisma.supabaseClientProject.findUnique({
      where: { id: ref },
    });

    if (!project) {
      res.status(404).json({ error: `Project ref "${ref}" not found` });
      return;
    }

    res.json(formatStudioPlatformProject(project));
  } catch (err: any) {
    logger.error({ err, ref: req.params.ref }, 'Failed retrieving platform project ref');
    res.status(500).json({ error: 'Failed loading project ref details' });
  }
});

// Project Pause Status
studioPlatformRouter.get('/projects/:ref/pause/status', async (req: Request, res: Response) => {
  try {
    const project = await prisma.supabaseClientProject.findUnique({ where: { id: req.params.ref } });
    const isPaused = project?.status === 'STOPPED' || project?.status === 'SUSPENDED';
    res.json({
      status: project?.status === 'ACTIVE' ? 'ACTIVE_HEALTHY' : (project?.status || 'ACTIVE_HEALTHY'),
      is_paused: isPaused,
    });
  } catch {
    res.json({ status: 'ACTIVE_HEALTHY', is_paused: false });
  }
});

// Project Status
studioPlatformRouter.get('/projects/:ref/status', async (req: Request, res: Response) => {
  try {
    const project = await prisma.supabaseClientProject.findUnique({ where: { id: req.params.ref } });
    res.json({
      status: project?.status === 'ACTIVE' ? 'ACTIVE_HEALTHY' : (project?.status || 'ACTIVE_HEALTHY'),
    });
  } catch {
    res.json({ status: 'ACTIVE_HEALTHY' });
  }
});

// API Props for Project
studioPlatformRouter.get('/props/project/:ref/api', async (req: Request, res: Response) => {
  try {
    const { ref } = req.params;
    const project = await prisma.supabaseClientProject.findUnique({
      where: { id: ref },
    });

    if (!project) {
      res.status(404).json({ error: `Project ref "${ref}" not found` });
      return;
    }

    const formatted = formatStudioPlatformProject(project);
    res.json({
      project: {
        ref: formatted.ref,
        name: formatted.name,
        endpoint: formatted.endpoint,
        anon_key: formatted.anon_key,
        service_key: formatted.service_key,
      },
      autoApiKey: formatted.anon_key,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed loading project API props' });
  }
});

// Project Databases List
studioPlatformRouter.get('/projects/:ref/databases', (_req: Request, res: Response) => {
  res.json([{ id: 'primary', name: 'primary', status: 'ACTIVE_HEALTHY' }]);
});

// Project Custom Domains
studioPlatformRouter.get('/projects/:ref/custom-domains', (_req: Request, res: Response) => {
  res.json({ custom_domains: [] });
});

// Project Storage Configuration
studioPlatformRouter.get('/projects/:ref/config/storage', (_req: Request, res: Response) => {
  res.json({
    file_size_limit: 52428800,
    features: { imageTransformation: true },
  });
});

// Project PostgREST Configuration
studioPlatformRouter.get('/projects/:ref/postgrest', async (req: Request, res: Response) => {
  res.json({
    db_schema: 'public',
    max_rows: 1000,
    db_extra_search_path: 'public, extensions',
  });
});

// Dynamic PG-Meta Proxy for Official Studio
studioPlatformRouter.all(['/pg-meta/:ref', '/pg-meta/:ref/*'], async (req: Request, res: Response) => {
  try {
    const { ref } = req.params;
    const project = await prisma.supabaseClientProject.findUnique({
      where: { id: ref },
    });

    if (!project) {
      res.status(404).json({ error: `Project ref "${ref}" not found` });
      return;
    }

    const formatted = formatStudioPlatformProject(project);
    const defaultMetaUrl = process.env.SUPABASE_META_URL || 'http://localhost:8080';
    const pathSuffix = (req.params as any)[0] || '';
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';

    // Resolve target host: inside docker network use default meta or remote host
    const isLocal = formatted.db_host === '127.0.0.1' || formatted.db_host === 'localhost';
    const baseMetaUrl = isLocal ? defaultMetaUrl : `http://${formatted.db_host}:8080`;
    const targetUrl = `${baseMetaUrl.replace(/\/+$/, '')}/${pathSuffix}${queryString}`;

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-connection-encrypted': formatted.connectionString,
      'x-postgres-connection-string': formatted.connectionString,
    };

    const fetchOptions: any = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const proxyRes = await undici.fetch(targetUrl, fetchOptions);
    const data = await proxyRes.text();

    res.status(proxyRes.status);
    proxyRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    res.send(data);
  } catch (err: any) {
    logger.error({ err, ref: req.params.ref }, 'Failed proxying pg-meta request for platform studio');
    res.status(500).json({ error: 'Failed forwarding postgres-meta request' });
  }
});
