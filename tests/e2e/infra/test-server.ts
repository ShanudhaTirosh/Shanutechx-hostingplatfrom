import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { memoryDb } from '../../unit/helpers/memoryDb';
import { E2EApiClient, TestUser } from './client';
import * as realAuthMiddleware from '../../../apps/api/src/middleware/auth';

export interface TestServerInstance {
  url: string;
  client: E2EApiClient;
  db: any;
  stop: () => Promise<void>;
  reset: () => void;
  seed: (initialData?: Record<string, any[]>) => void;
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    id: 'usr_admin_001',
    email: 'admin@shanutechx.com',
    role: 'admin',
    firebaseUid: 'fb_admin_001',
  },
  dev: {
    id: 'usr_dev_001',
    email: 'developer@shanutechx.com',
    role: 'dev',
    firebaseUid: 'fb_dev_001',
  },
  customer1: {
    id: 'usr_cust_001',
    email: 'alice@customer.com',
    role: 'customer',
    firebaseUid: 'fb_cust_001',
  },
  customer2: {
    id: 'usr_cust_002',
    email: 'bob@customer.com',
    role: 'customer',
    firebaseUid: 'fb_cust_002',
  },
  support: {
    id: 'usr_sup_001',
    email: 'support@shanutechx.com',
    role: 'support',
    firebaseUid: 'fb_sup_001',
  },
};

export const DEFAULT_NODE = {
  id: 'node_master_001',
  label: 'main-node',
  ip: '127.0.0.1',
  sshKeyRef: 'vault:nodes:master-ssh-key',
  cpuCores: 8,
  ramMb: 32768,
  diskGb: 500,
  roleTags: [
    'main-node',
    'global',
    'web-hosting',
    'node-hosting',
    'python-hosting',
    'database-hosting',
    'supabase-hosting',
    'mail-hosting',
  ],
  monthlyBandwidthGb: 30000,
  isActive: true,
  status: 'online',
  lastSeenAt: new Date(),
};

function loadRouterWithStubs(routeName: string, prisma: any): any {
  const req = createRequire(import.meta.url);
  const routerFile = fileURLToPath(new URL(`../../../apps/api/src/routes/${routeName}.ts`, import.meta.url));
  const M: any = Module;
  const origLoad = M._load;

  for (const k of Object.keys(req.cache)) {
    if (k.replace(/\\/g, '/').includes('/apps/api/src/')) delete req.cache[k];
  }

  const noop: any = new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? undefined : k === 'status' ? 'ready' : noop),
    apply: () => noop,
    construct: () => noop,
  });
  const noopModule = { __esModule: true, default: noop, Redis: noop, Queue: noop, Worker: noop, QueueEvents: noop, FlowProducer: noop };
  const prismaModule = { PrismaClient: class { constructor() { return prisma; } }, Prisma: {}, prisma, default: prisma };

  // RequireAuth that parses test headers/tokens and runs REAL role guards
  const authModule = {
    ...realAuthMiddleware,
    requireAuth: (q: any, s: any, next: any) => {
      const hasAuthHeader = q.headers.authorization || q.headers['x-api-key'];
      const testRole = q.headers['x-test-role'];
      const testUserId = q.headers['x-test-user-id'] || q.headers['x-test-user'];

      if (!hasAuthHeader && !testRole && !testUserId) {
        return s.status(401).json({ error: 'Missing authentication token or API key' });
      }

      const role = testRole || 'customer';
      const id = testUserId || 'usr_anon_001';
      const email = q.headers['x-test-user-email'] || `${id}@example.com`;

      q.user = {
        id,
        role,
        email,
        firebaseUid: `fb_${id}`,
        teamId: q.headers['x-test-team-id'],
      };
      next();
    },
  };

  M._load = function (request: string, parent: any, ...rest: any[]) {
    const from: string = (parent?.filename || '').replace(/\\/g, '/');
    const normRequest: string = request.replace(/\\/g, '/');
    if (normRequest === 'ioredis' || normRequest === 'bullmq') return noopModule;
    if (normRequest === '@prisma/client' || normRequest === '.prisma/client/default' || normRequest === '@shanutechx/db') return prismaModule;
    if (/apps\/api\/src/.test(from) && /(^|\/)prisma(\.ts|\.js)?$/.test(normRequest)) return prismaModule;
    if (/apps\/api\/src\/routes/.test(from) && /middleware\/auth(\.ts|\.js)?$/.test(normRequest)) {
      return authModule;
    }
    return origLoad.call(this, request, parent, ...rest);
  };

  try {
    return req(routerFile);
  } finally {
    M._load = origLoad;
  }
}

function createInMemoryDb(initialSeed: Record<string, any[]> = {}) {
  const seedWithDefaults = {
    user: Object.values(TEST_USERS),
    node: [DEFAULT_NODE],
    deployment: [],
    deploymentVolume: [],
    managedDatabase: [],
    supabaseClientProject: [],
    smtpAccount: [],
    project: [],
    auditLog: [],
    team: [],
    teamMember: [],
    teamInvite: [],
    orderItem: [],
    subscription: [
      {
        id: 'sub_cust_001',
        userId: TEST_USERS.customer1.id,
        orderItemId: 'item_sub_001',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    ],
    ...initialSeed,
  };
  const rawDb = memoryDb(seedWithDefaults);
  return new Proxy(rawDb, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !(prop in target) && prop !== 'then' && prop !== 'catch') {
        if (!target.tables[prop]) target.tables[prop] = [];
        target[prop] = {
          findMany: async () => [],
          count: async () => 0,
          findUnique: async () => null,
          findFirst: async () => null,
          updateMany: async () => ({ count: 0 }),
          update: async () => ({}),
          delete: async () => ({}),
          create: async ({ data }: any) => ({ id: `new_${Date.now()}`, ...data }),
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export async function createTestServer(initialSeed: Record<string, any[]> = {}): Promise<TestServerInstance> {
  const externalUrl = process.env.E2E_API_URL;
  if (externalUrl) {
    const client = new E2EApiClient(externalUrl);
    return {
      url: externalUrl,
      client,
      db: null,
      stop: async () => {},
      reset: () => {},
      seed: () => {},
    };
  }

  const db = createInMemoryDb(initialSeed);

  const app = express();
  app.use(express.json());

  // Mount API routers using loadRouterWithStubs
  const volumesMod = loadRouterWithStubs('volumes', db);
  app.use('/api', volumesMod.volumesRouter);

  const containersMod = loadRouterWithStubs('containers', db);
  app.use('/api', containersMod.containersRouter);

  const supabaseMod = loadRouterWithStubs('supabase', db);
  app.use('/api', supabaseMod.supabaseRouter);

  const managedDbMod = loadRouterWithStubs('managedDatabases', db);
  app.use('/api', managedDbMod.managedDatabasesRouter);

  const catalogMod = loadRouterWithStubs('catalog', db);
  app.use('/api', catalogMod.catalogRouter);

  const traefikMod = loadRouterWithStubs('traefikStatus', db);
  app.use('/api', traefikMod.traefikStatusRouter);

  const smtpMod = loadRouterWithStubs('smtp', db);
  app.use('/api', smtpMod.smtpRouter);

  const webhooksMod = loadRouterWithStubs('deployWebhooks', db);
  app.use('/api', webhooksMod.deployWebhooksRouter);

  // Node Agent Mock / Interface Endpoints
  const activeBuilds = new Map<string, any>();
  const nodeVolumes = new Map<string, any>();

  app.post('/agent/volumes', (req, res) => {
    const { name, deploymentId, hostPath } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const volumeKey = `${deploymentId || 'global'}:${name}`;
    const path = hostPath || `/var/lib/shanutechx/volumes/${deploymentId || 'default'}/${name}`;
    nodeVolumes.set(volumeKey, { name, deploymentId, path, createdAt: new Date() });
    res.status(201).json({ success: true, path, name });
  });

  app.get('/agent/volumes', (_req, res) => {
    res.json({ volumes: Array.from(nodeVolumes.values()) });
  });

  app.post('/agent/deployments/:id/run-image', (req, res) => {
    const { id } = req.params;
    const { image, envVars, ports, volumes, resources } = req.body || {};
    if (!image || typeof image !== 'string' || !image.trim()) return res.status(400).json({ error: 'image is required' });

    const containerId = `cnt_${id}_${Date.now()}`;
    res.status(201).json({
      containerId,
      status: 'running',
      deploymentId: id,
      image,
      ports: ports || [],
      volumes: volumes || [],
      resources: resources || {},
    });
  });

  app.post('/agent/deployments/:id/cancel-build', (req, res) => {
    const { id } = req.params;
    if (activeBuilds.has(id)) {
      const build = activeBuilds.get(id);
      build.status = 'cancelled';
      activeBuilds.delete(id);
      return res.json({ ok: true, cancelled: true, deploymentId: id });
    }
    res.status(404).json({ error: 'No active build found to cancel', deploymentId: id });
  });

  app.get('/agent/containers/:id/stats', (req, res) => {
    res.json({
      containerId: req.params.id,
      cpuPercent: 4.25,
      memoryUsageBytes: 64 * 1024 * 1024,
      memoryLimitBytes: 512 * 1024 * 1024,
      networkRxBytes: 1048576,
      networkTxBytes: 524288,
    });
  });

  app.get('/agent/containers/:id/logs', (req, res) => {
    const tail = Number(req.query.tail);
    if (!Number.isFinite(tail) || tail < 0) {
      return res.status(400).json({ error: 'tail parameter must be a positive integer' });
    }
    res.json({ logs: ['log line 1', 'log line 2'] });
  });

  let server: Server;
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server!.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;
  const client = new E2EApiClient(url);

  return {
    url,
    client,
    db,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    reset: () => {
      activeBuilds.clear();
      nodeVolumes.clear();
      for (const k of Object.keys(db.tables)) {
        db.tables[k] = [];
      }
      db.tables.user = Object.values(TEST_USERS);
      db.tables.node = [DEFAULT_NODE];
      db.tables.subscription = [
        {
          id: 'sub_cust_001',
          userId: TEST_USERS.customer1.id,
          orderItemId: 'item_sub_001',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      ];
    },
    seed: (data?: Record<string, any[]>) => {
      if (data) {
        for (const [table, rows] of Object.entries(data)) {
          if (!db.tables[table]) db.tables[table] = [];
          db.tables[table].push(...rows);
        }
      }
    },
  };
}
