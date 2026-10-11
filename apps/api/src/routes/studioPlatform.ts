import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { logger } from '../lib/logger';
import undici from 'undici';

export const studioPlatformRouter = Router();

// SSO Email Whitelist Guard
function verifyStudioEmailAccess(req: Request, res: Response, next: () => void) {
  const allowedList = env.allowedAdminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // If internal agent secret header is provided
  const internalSecret = req.headers['x-internal-secret'] || req.headers['x-agent-secret'];
  if (internalSecret && (internalSecret === env.discordInternalSecret || internalSecret === env.nodeAgentSecret)) {
    return next();
  }

  // Extract email from authenticated user (if auth middleware was applied) or header
  const userEmail = (req as any).user?.email?.toLowerCase() || req.headers['x-user-email']?.toString().toLowerCase();

  if (!userEmail) {
    logger.warn('Anonymous unauthenticated attempt on Studio Platform API blocked');
    res.status(401).json({ error: 'Authentication required. Missing user identity for Supabase Studio.' });
    return;
  }

  if (!allowedList.includes(userEmail) && !allowedList.includes('*')) {
    logger.warn({ userEmail, allowedList }, 'Unauthorized email attempt on Studio Platform API');
    res.status(403).json({ error: 'Access denied. Email unauthorized for Supabase Admin Studio.' });
    return;
  }

  next();
}

studioPlatformRouter.use(verifyStudioEmailAccess);

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

// Organizations
studioPlatformRouter.get('/organizations', (req: Request, res: Response) => {
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

// Helper to format database record into Studio platform project schema
function formatStudioPlatformProject(p: any) {
  const targetHost = p.nodeIp || '127.0.0.1';
  const apiPort = p.apiPort ?? 8001;
  const dbPort = p.dbPort ?? 5432;
  const rootDomain = env.rootDomain || 'shanutechx.com';
  const cleanSlug = p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '') : 'default';
  const hostSubdomain = `supabase-${cleanSlug}.${rootDomain}`;

  const apiUrl = `http://${hostSubdomain}:${apiPort}`;
  const dbUrl = `postgresql://postgres:postgres@${targetHost}:${dbPort}/${p.dbName || 'postgres'}`;

  return {
    id: p.id,
    ref: p.id,
    name: p.name,
    organization_id: 1,
    status: p.status === 'ACTIVE' ? 'ACTIVE_HEALTHY' : p.status,
    region: 'us-east-1',
    cloud_provider: 'AWS',
    inserted_at: p.createdAt,
    endpoint: apiUrl,
    db_host: targetHost,
    db_port: dbPort,
    db_name: p.dbName || 'postgres',
    db_user: 'postgres',
    jwt_secret: p.jwtSecretEnc || 'secret',
    service_key: p.serviceKeyEnc || p.anonKey || 'service_key',
    anon_key: p.anonKey || 'anon_key',
    connectionString: dbUrl,
  };
}

// List Projects (Formatted for Official Supabase Studio Dropdown)
studioPlatformRouter.get('/projects', async (req: Request, res: Response) => {
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

// Dynamic PG-Meta Proxy for Official Studio
studioPlatformRouter.all('/pg-meta/:ref/*', async (req: Request, res: Response) => {
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
    const metaPort = 8080;
    const pathSuffix = (req.params as any)[0] || '';
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    
    // Resolve target host: inside docker network use 'meta' if local or specified db_host
    const hostTarget = (formatted.db_host === '127.0.0.1' || formatted.db_host === 'localhost') ? 'meta' : formatted.db_host;
    const targetUrl = `http://${hostTarget}:${metaPort}/${pathSuffix}${queryString}`;

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
