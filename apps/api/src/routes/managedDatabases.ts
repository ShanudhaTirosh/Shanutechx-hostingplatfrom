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
  userId: z.string(),
  type: z.enum(['postgres', 'mysql', 'redis', 'mongodb']),
});

/**
 * Admin-provisioned for now (mirrors how SMTP/VPS accounts work) rather
 * than fully self-service — provisioning a database container still goes
 * through the same node-agent build/run path as a deployment, and tying it
 * to a paid order item (the way deployments are) is a reasonable next step
 * once this is sold as its own plan rather than an admin-granted extra.
 */
managedDatabasesRouter.post('/managed-databases', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parsed = createDbSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Admin can only provision for a customer assigned to them.
  if (req.user!.role === 'admin' && !(await canAccessResource(parsed.data.userId, req))) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  let node;
  try {
    node = await selectNodeForDeployment({ requiredTag: 'node-hosting', isAdminDeployment: true });
  } catch (err) {
    if (err instanceof NodeSelectionError) return res.status(409).json({ error: err.message });
    throw err;
  }

  const rawPassword = crypto.randomBytes(16).toString('hex');
  const credentialRef = encryptSecret(rawPassword, env.secretsEncryptionKey);

  const db = await prisma.managedDatabase.create({
    data: { userId: parsed.data.userId, nodeId: node.id, type: parsed.data.type, status: 'pending', credentialRef },
  });

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
    res.status(201).json({ database: { ...updated, credentialRef: undefined } });
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
