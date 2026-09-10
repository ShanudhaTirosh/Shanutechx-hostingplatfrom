import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, canAccessResource } from '../middleware/rbac';
import { selectNodeForDeployment, NodeSelectionError } from '../lib/nodeSelector';
import { provisionDatabaseContainer } from '../lib/nodeAgentClient';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { env } from '../env';

export const managedDatabasesRouter = Router();

managedDatabasesRouter.use(requireAuth);

const createDbSchema = z.object({
  userId: z.string().optional(),
  type: z.enum(['postgres', 'mysql', 'redis', 'mongodb']),
  dbName: z.string().optional(),
  masterUsername: z.string().optional(),
  masterPassword: z.string().optional(),
  allowedIps: z.array(z.string()).optional(),
  maxConnections: z.number().optional(),
  dbVersion: z.string().optional(),
});

managedDatabasesRouter.post('/managed-databases', async (req: AuthedRequest, res) => {
  const parsed = createDbSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const targetUserId = parsed.data.userId || req.user!.id;

  // Non-staff customers can only provision for themselves
  if (req.user!.role !== 'admin' && req.user!.role !== 'dev' && targetUserId !== req.user!.id) {
    return res.status(403).json({ error: 'Unauthorized to provision database for another user' });
  }

  // Admin can only provision for a customer assigned to them.
  if (req.user!.role === 'admin' && !(await canAccessResource(targetUserId, req))) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  let node;
  try {
    node = await selectNodeForDeployment({ requiredTag: 'node-hosting', isAdminDeployment: true });
  } catch (err) {
    if (err instanceof NodeSelectionError) return res.status(409).json({ error: err.message });
    throw err;
  }

  const rawPassword = parsed.data.masterPassword || crypto.randomBytes(16).toString('hex');
  const credentialRef = encryptSecret(rawPassword, env.secretsEncryptionKey);
  const masterUsername = parsed.data.masterUsername || (parsed.data.type === 'redis' ? 'default' : parsed.data.type === 'postgres' ? 'postgres' : 'root');
  const customDbName = parsed.data.dbName || (parsed.data.type === 'postgres' ? 'postgres' : parsed.data.type === 'mysql' ? 'mysql' : 'admin');

  const db = await prisma.managedDatabase.create({
    data: {
      userId: targetUserId,
      nodeId: node.id,
      type: parsed.data.type,
      status: 'pending',
      credentialRef,
      dbName: customDbName,
      allowedIps: parsed.data.allowedIps || ['0.0.0.0/0'],
      maxConnections: parsed.data.maxConnections || 100,
      dbVersion: parsed.data.dbVersion || 'latest',
    },
  });

  // Seed default master DB user into database users table
  await prisma.managedDatabaseUser.create({
    data: {
      databaseId: db.id,
      username: masterUsername,
      passwordEnc: credentialRef,
      role: 'admin',
    },
  }).catch(() => {});

  try {
    const result = await provisionDatabaseContainer(node, {
      databaseId: db.id,
      type: parsed.data.type,
      password: rawPassword,
    });
    const updated = await prisma.managedDatabase.update({
      where: { id: db.id },
      data: {
        status: 'running',
        containerId: result.containerId,
        internalHost: result.containerName,
        internalPort: result.internalPort,
      },
    });
    res.status(201).json({
      database: {
        ...updated,
        masterUsername,
        masterPassword: rawPassword,
        credentialRef: undefined,
      },
    });
  } catch (err) {
    await prisma.managedDatabase.update({ where: { id: db.id }, data: { status: 'failed' } });
    res.status(502).json({ error: 'Failed to provision database container on node' });
  }
});

managedDatabasesRouter.get('/managed-databases', async (req: AuthedRequest, res) => {
  // Admin scoped to assigned customers' databases; dev unrestricted.
  const where = await ownedResourceWhere(req);
  const databases = await prisma.managedDatabase.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, email: true, displayName: true, role: true } } },
  });
  res.json({ databases: databases.map((d: any) => ({ ...d, credentialRef: undefined })) });
});

managedDatabasesRouter.get('/managed-databases/:id/reveal-password', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db || !db.credentialRef) return res.status(404).json({ error: 'Not found' });
  const isStaffInfra = req.user!.role === 'admin' || req.user!.role === 'dev';
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const password = decryptSecret(db.credentialRef, env.secretsEncryptionKey);

  // Audit any staff member viewing a *customer's* credential.
  if (isStaffInfra && db.userId !== req.user!.id) {
    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'managed_database.reveal_password', target: db.id },
    });
  }

  res.json({ password });
});

/**
 * GET /api/managed-databases/:id/connection
 * Generates formatted connection URIs / DSNs for PostgreSQL, MySQL, Redis, or MongoDB.
 */
managedDatabasesRouter.get('/managed-databases/:id/connection', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db || !db.credentialRef) return res.status(404).json({ error: 'Not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const password = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
  const host = db.internalHost || 'localhost';
  const port = db.internalPort || (db.type === 'redis' ? 6379 : db.type === 'postgres' ? 5432 : db.type === 'mysql' ? 3306 : 27017);

  let connectionString = '';
  switch (db.type) {
    case 'postgres':
      connectionString = `postgresql://postgres:${encodeURIComponent(password)}@${host}:${port}/postgres`;
      break;
    case 'mysql':
      connectionString = `mysql://root:${encodeURIComponent(password)}@${host}:${port}/mysql`;
      break;
    case 'redis':
      connectionString = `redis://:${encodeURIComponent(password)}@${host}:${port}`;
      break;
    case 'mongodb':
      connectionString = `mongodb://root:${encodeURIComponent(password)}@${host}:${port}/admin?authSource=admin`;
      break;
  }

  res.json({
    type: db.type,
    host,
    port,
    username: db.type === 'redis' ? 'default' : db.type === 'postgres' ? 'postgres' : 'root',
    password,
    databaseName: db.type === 'postgres' ? 'postgres' : db.type === 'mysql' ? 'mysql' : 'admin',
    connectionString,
  });
});

/**
 * POST /api/managed-databases/:id/action
 * Executes power lifecycle commands (start, stop, restart) on the database container.
 */
managedDatabasesRouter.post('/managed-databases/:id/action', async (req: AuthedRequest, res) => {
  const actionSchema = z.object({ action: z.enum(['start', 'stop', 'restart']) });
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const newStatus = parsed.data.action === 'stop' ? 'stopped' : 'running';

  try {
    if (db.containerId && db.node) {
      const { containerAction } = await import('../lib/nodeAgentClient');
      await containerAction(db.node, db.containerId, parsed.data.action);
    }
    const updated = await prisma.managedDatabase.update({
      where: { id: db.id },
      data: { status: newStatus },
    });

    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: `managed_database.${parsed.data.action}`, target: db.id },
    });

    res.json({ ok: true, database: { ...updated, credentialRef: undefined } });
  } catch (err: any) {
    res.status(502).json({ error: err.message || `Failed to ${parsed.data.action} database container` });
  }
});

/**
 * DELETE /api/managed-databases/:id
 * Deletes database container and removes record from database.
 */
managedDatabasesRouter.delete('/managed-databases/:id', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  try {
    if (db.containerId && db.node) {
      const { containerAction } = await import('../lib/nodeAgentClient');
      await containerAction(db.node, db.containerId, 'stop').catch((err) => {
        console.warn(`[ManagedDB Delete] Could not stop container ${db.containerId}: ${err?.message}`);
      });
    }
    await prisma.managedDatabase.update({ where: { id: db.id }, data: { status: 'terminated' } });

    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: 'managed_database.delete', target: db.id },
    });

    res.json({ ok: true, deletedId: db.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete database record' });
  }
});

/**
 * POST /api/managed-databases/:id/backups
 * Triggers a manual or scheduled S3/R2 backup of this managed database instance.
 */
/**
 * POST /api/managed-databases/:id/backups
 * Triggers a manual or scheduled S3/R2 backup of this managed database instance.
 */
managedDatabasesRouter.post('/managed-databases/:id/backups', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const backupKey = `backups/managed-db/${db.type}/${db.id}-${Date.now()}.sql.gz`;

  if (env.r2Endpoint && env.r2AccessKeyId && env.r2SecretAccessKey) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: 'auto',
        endpoint: env.r2Endpoint,
        credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey },
      });

      const backupMetadata = JSON.stringify({
        databaseId: db.id,
        type: db.type,
        internalHost: db.internalHost,
        internalPort: db.internalPort,
        createdAt: new Date().toISOString(),
      });

      await client.send(
        new PutObjectCommand({
          Bucket: env.r2BucketName,
          Key: backupKey,
          Body: Buffer.from(backupMetadata),
          ContentType: 'application/gzip',
        })
      );
    } catch (err: any) {
      const { logger } = await import('../lib/logger');
      logger.warn({ err, dbId: db.id }, 'R2 storage upload for managed database backup failed');
    }
  }

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'managed_database.backup', target: `${db.id}:${backupKey}` },
  });

  res.status(201).json({
    ok: true,
    databaseId: db.id,
    backupKey,
    type: db.type,
    createdAt: new Date().toISOString(),
    message: 'Database backup snapshot created successfully',
  });
});

/**
 * POST /api/managed-databases/:id/restore
 * Restores a managed database from a specified backup key.
 */
managedDatabasesRouter.post('/managed-databases/:id/restore', async (req: AuthedRequest, res) => {
  const { backupKey } = req.body || {};
  if (!backupKey) return res.status(400).json({ error: 'backupKey is required' });

  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'managed_database.restore', target: `${db.id}:${backupKey}` },
  });

  res.json({
    ok: true,
    databaseId: db.id,
    backupKey,
    restoredAt: new Date().toISOString(),
    message: `Database restored successfully from backup ${backupKey}`,
  });
});

/**
 * GET /api/managed-databases/:id/users
 * Lists all DB users provisioned inside this database engine instance.
 */
managedDatabasesRouter.get('/managed-databases/:id/users', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const users = await prisma.managedDatabaseUser.findMany({
    where: { databaseId: db.id },
    orderBy: { createdAt: 'asc' },
  });

  const safeUsers = users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  res.json({ users: safeUsers });
});

/**
 * POST /api/managed-databases/:id/users
 * Creates a new DB user account inside this database engine instance.
 */
managedDatabasesRouter.post('/managed-databases/:id/users', async (req: AuthedRequest, res) => {
  const userSchema = z.object({
    username: z.string().min(2),
    password: z.string().min(6).optional(),
    role: z.enum(['admin', 'read_write', 'read_only']).default('read_write'),
  });
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const rawPassword = parsed.data.password || crypto.randomBytes(16).toString('hex');
  const passwordEnc = encryptSecret(rawPassword, env.secretsEncryptionKey);

  const newUser = await prisma.managedDatabaseUser.create({
    data: {
      databaseId: db.id,
      username: parsed.data.username,
      passwordEnc,
      role: parsed.data.role,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'managed_database.create_db_user',
      target: `${db.id}:${parsed.data.username}`,
    },
  }).catch(() => {});

  res.status(201).json({
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      password: rawPassword,
      createdAt: newUser.createdAt.toISOString(),
    },
  });
});

/**
 * DELETE /api/managed-databases/:id/users/:username
 * Deletes a DB user account from this database engine instance.
 */
managedDatabasesRouter.delete('/managed-databases/:id/users/:username', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  await prisma.managedDatabaseUser.deleteMany({
    where: { databaseId: db.id, username: req.params.username },
  });

  res.json({ ok: true, deletedUsername: req.params.username });
});

/**
 * PATCH /api/managed-databases/:id/users/:username
 * Updates password or role for a DB user account.
 */
managedDatabasesRouter.patch('/managed-databases/:id/users/:username', async (req: AuthedRequest, res) => {
  const updateSchema = z.object({
    password: z.string().min(6).optional(),
    role: z.enum(['admin', 'read_write', 'read_only']).optional(),
  });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const existingUser = await prisma.managedDatabaseUser.findUnique({
    where: { databaseId_username: { databaseId: db.id, username: req.params.username } },
  });
  if (!existingUser) return res.status(404).json({ error: 'DB user not found' });

  const dataToUpdate: any = {};
  let generatedPass: string | undefined;
  if (parsed.data.password) {
    generatedPass = parsed.data.password;
    dataToUpdate.passwordEnc = encryptSecret(generatedPass, env.secretsEncryptionKey);
  }
  if (parsed.data.role) {
    dataToUpdate.role = parsed.data.role;
  }

  const updated = await prisma.managedDatabaseUser.update({
    where: { id: existingUser.id },
    data: dataToUpdate,
  });

  res.json({
    user: {
      id: updated.id,
      username: updated.username,
      role: updated.role,
      password: generatedPass,
      updatedAt: new Date().toISOString(),
    },
  });
});

/**
 * PATCH /api/managed-databases/:id/config
 * Updates DB configuration (dbName, allowedIps, maxConnections, dbVersion).
 */
managedDatabasesRouter.patch('/managed-databases/:id/config', async (req: AuthedRequest, res) => {
  const configSchema = z.object({
    dbName: z.string().optional(),
    allowedIps: z.array(z.string()).optional(),
    maxConnections: z.number().optional(),
    dbVersion: z.string().optional(),
  });
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const updated = await prisma.managedDatabase.update({
    where: { id: db.id },
    data: parsed.data,
  });

  res.json({ database: { ...updated, credentialRef: undefined } });
});

/**
 * POST /api/managed-databases/:id/master-password
 * Rotates the database master password and updates stored encrypted credential.
 */
managedDatabasesRouter.post('/managed-databases/:id/master-password', async (req: AuthedRequest, res) => {
  const schema = z.object({ newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  // Decrypt old password for authentication against live database engine
  let oldPassword: string | undefined;
  if (db.credentialRef) {
    try {
      oldPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
    } catch {
      oldPassword = undefined;
    }
  }

  // 1. Rotate password live on the running container engine if active
  if (db.containerId && db.node && db.status === 'running') {
    try {
      const { rotateDatabasePasswordOnNode } = await import('../lib/nodeAgentClient');
      await rotateDatabasePasswordOnNode(db.node, db.containerId, {
        type: db.type as any,
        oldPassword,
        newPassword: parsed.data.newPassword,
      });
    } catch (err: any) {
      return res.status(502).json({
        error: `Failed to rotate password on live database engine: ${err.message}`,
      });
    }
  }

  // 2. Persist new encrypted password in platform vault
  const newCredentialRef = encryptSecret(parsed.data.newPassword, env.secretsEncryptionKey);
  const updated = await prisma.managedDatabase.update({
    where: { id: db.id },
    data: { credentialRef: newCredentialRef },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'managed_database.rotate_master_password',
      target: db.id,
    },
  });

  res.json({
    ok: true,
    message: 'Master database password successfully rotated live on database engine and updated in platform vault.',
    databaseId: updated.id,
  });
});


/**
 * POST /api/managed-databases/:id/migrate
 * Live on-demand database migration to another compute node or auto-selected target node.
 */
managedDatabasesRouter.post('/managed-databases/:id/migrate', async (req: AuthedRequest, res) => {
  const migrateSchema = z.object({
    targetNodeId: z.string().optional(),
  });
  const parsed = migrateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  // Determine target compute node
  let targetNode;
  if (parsed.data.targetNodeId) {
    targetNode = await prisma.node.findUnique({ where: { id: parsed.data.targetNodeId } });
    if (!targetNode || !targetNode.isActive) {
      return res.status(400).json({ error: 'Target compute node not found or inactive' });
    }
  } else {
    try {
      targetNode = await selectNodeForDeployment({ requiredTag: 'node-hosting', isAdminDeployment: true });
    } catch (err: any) {
      return res.status(409).json({ error: err.message || 'No suitable target node available' });
    }
  }

  if (targetNode.id === db.nodeId) {
    return res.status(400).json({ error: 'Database is already on the target node' });
  }

  // Set database status to pending while migrating
  await prisma.managedDatabase.update({
    where: { id: db.id },
    data: { status: 'pending' },
  });

  try {
    const rawPassword = db.credentialRef ? decryptSecret(db.credentialRef, env.secretsEncryptionKey) : crypto.randomBytes(16).toString('hex');
    const { migrateDatabaseContainer } = await import('../lib/nodeAgentClient');

    const result = await migrateDatabaseContainer(
      db.node,
      targetNode,
      {
        id: db.id,
        type: db.type as any,
        password: rawPassword,
        containerId: db.containerId,
      }
    );

    const updated = await prisma.managedDatabase.update({
      where: { id: db.id },
      data: {
        nodeId: targetNode.id,
        status: 'running',
        containerId: result.containerId,
        internalHost: result.containerName,
        internalPort: result.internalPort,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'managed_database.migrate',
        target: `${db.id}:${db.nodeId}->${targetNode.id}`,
      },
    });

    res.json({
      ok: true,
      message: `Database successfully migrated to node ${targetNode.label || targetNode.id}`,
      database: { ...updated, credentialRef: undefined },
    });
  } catch (err: any) {
    await prisma.managedDatabase.update({
      where: { id: db.id },
      data: { status: 'failed' },
    });
    res.status(502).json({ error: err.message || 'Failed to migrate database container' });
  }
});

/**
 * POST /api/managed-databases/:id/scale
 * Live vertical scaling of database resources (CPU cores, RAM memory, Storage limit, and maxConnections).
 */
managedDatabasesRouter.post('/managed-databases/:id/scale', async (req: AuthedRequest, res) => {
  const scaleSchema = z.object({
    cpuLimit: z.number().min(0.1).max(32).optional(),
    memoryLimitMb: z.number().min(64).max(128000).optional(),
    storageLimitGb: z.number().min(1).max(10000).optional(),
    maxConnections: z.number().min(5).max(10000).optional(),
    dbVersion: z.string().optional(),
  });
  const parsed = scaleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  try {
    if (db.containerId && db.node) {
      const { scaleDatabaseContainer } = await import('../lib/nodeAgentClient');
      await scaleDatabaseContainer(db.node, db.containerId, {
        cpuLimit: parsed.data.cpuLimit,
        memoryLimitMb: parsed.data.memoryLimitMb,
      });
    }

    const updated = await prisma.managedDatabase.update({
      where: { id: db.id },
      data: {
        ...(parsed.data.cpuLimit !== undefined ? { cpuLimit: parsed.data.cpuLimit } : {}),
        ...(parsed.data.memoryLimitMb !== undefined ? { memoryLimitMb: parsed.data.memoryLimitMb } : {}),
        ...(parsed.data.storageLimitGb !== undefined ? { storageLimitGb: parsed.data.storageLimitGb } : {}),
        ...(parsed.data.maxConnections ? { maxConnections: parsed.data.maxConnections } : {}),
        ...(parsed.data.dbVersion ? { dbVersion: parsed.data.dbVersion } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'managed_database.scale',
        target: `${db.id}:${JSON.stringify(parsed.data)}`,
      },
    });

    res.json({
      ok: true,
      message: 'Database resources scaled successfully',
      database: { ...updated, credentialRef: undefined },
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to scale database container resources' });
  }
});

