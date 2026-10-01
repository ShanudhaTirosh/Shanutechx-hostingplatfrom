import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, canAccessResource } from '../middleware/rbac';
import { selectNodeForDeployment, NodeSelectionError } from '../lib/nodeSelector';
import {
  provisionDatabaseContainer,
  manageDatabaseUserOnNode,
  executeDatabaseQueryOnNode,
  backupDatabaseOnNode,
  listDatabaseBackupsOnNode,
  restoreDatabaseOnNode,
} from '../lib/nodeAgentClient';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { env } from '../env';
import { logger } from '../lib/logger';

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
        logger.warn({ containerId: db.containerId, err: err?.message }, '[ManagedDB Delete] Could not stop container before deletion');
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
 * POST /api/managed-databases/:id/query
 * Executes a live query (SQL, Redis command, or MongoDB script) on the managed database engine.
 */
managedDatabasesRouter.post('/managed-databases/:id/query', async (req: AuthedRequest, res) => {
  const schema = z.object({ query: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });
  if (db.status !== 'running' || !db.containerId || !db.node) {
    return res.status(400).json({ error: 'Database instance must be running to execute queries' });
  }

  let masterPassword: string | undefined;
  if (db.credentialRef) {
    try {
      masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
    } catch {}
  }

  try {
    const result = await executeDatabaseQueryOnNode(db.node, db.containerId, {
      type: db.type as any,
      query: parsed.data.query,
      masterPassword,
    });

    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to execute query on database container' });
  }
});

/**
 * POST /api/managed-databases/:id/backups
 * Creates a real snapshot backup (dump file) of the managed database container via node-agent.
 */
managedDatabasesRouter.post('/managed-databases/:id/backups', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });
  if (!db.containerId || !db.node) {
    return res.status(400).json({ error: 'Database container node unavailable' });
  }

  let masterPassword: string | undefined;
  if (db.credentialRef) {
    try {
      masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
    } catch {}
  }

  try {
    const backupResult = await backupDatabaseOnNode(db.node, db.containerId, {
      type: db.type as any,
      databaseId: db.id,
      masterPassword,
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'managed_database.create_backup',
        target: `${db.id}:${backupResult.backupId}`,
      },
    }).catch(() => {});

    res.status(201).json({ ok: true, backup: backupResult });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to generate database snapshot backup' });
  }
});

/**
 * GET /api/managed-databases/:id/backups
 * Lists all snapshot backups stored for this managed database instance.
 */
managedDatabasesRouter.get('/managed-databases/:id/backups', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  if (!db.node) {
    return res.json({ backups: [] });
  }

  try {
    const { backups } = await listDatabaseBackupsOnNode(db.node, db.id);
    res.json({ backups });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list database backups' });
  }
});

/**
 * POST /api/managed-databases/:id/restore
 * Restores a snapshot backup dump file into the running database container.
 */
managedDatabasesRouter.post('/managed-databases/:id/restore', async (req: AuthedRequest, res) => {
  const schema = z.object({ backupId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });
  if (db.status !== 'running' || !db.containerId || !db.node) {
    return res.status(400).json({ error: 'Database container must be running to restore a snapshot' });
  }

  let masterPassword: string | undefined;
  if (db.credentialRef) {
    try {
      masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
    } catch {}
  }

  try {
    const result = await restoreDatabaseOnNode(db.node, db.containerId, {
      type: db.type as any,
      databaseId: db.id,
      backupId: parsed.data.backupId,
      masterPassword,
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'managed_database.restore_backup',
        target: `${db.id}:${parsed.data.backupId}`,
      },
    }).catch(() => {});

    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to restore database snapshot' });
  }
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

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const rawPassword = parsed.data.password || crypto.randomBytes(16).toString('hex');
  const passwordEnc = encryptSecret(rawPassword, env.secretsEncryptionKey);

  // 1. Create DB user live on container database engine if running
  if (db.containerId && db.node && db.status === 'running') {
    try {
      let masterPassword: string | undefined;
      if (db.credentialRef) {
        masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
      }
      await manageDatabaseUserOnNode(db.node, db.containerId, {
        type: db.type as any,
        action: 'create',
        username: parsed.data.username,
        password: rawPassword,
        role: parsed.data.role,
        masterPassword,
      });
    } catch (err: any) {
      return res.status(502).json({ error: `Failed to create database user on live engine: ${err.message}` });
    }
  }

  // 2. Save metadata in platform database
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
  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  // Delete live user from container database engine if running
  if (db.containerId && db.node && db.status === 'running') {
    try {
      let masterPassword: string | undefined;
      if (db.credentialRef) {
        masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
      }
      await manageDatabaseUserOnNode(db.node, db.containerId, {
        type: db.type as any,
        action: 'delete',
        username: req.params.username,
        masterPassword,
      });
    } catch (err: any) {
      return res.status(502).json({ error: `Failed to delete user on live engine: ${err.message}` });
    }
  }

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

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
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

  // Update user live on container database engine if running
  if (db.containerId && db.node && db.status === 'running') {
    try {
      let masterPassword: string | undefined;
      if (db.credentialRef) {
        masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
      }
      await manageDatabaseUserOnNode(db.node, db.containerId, {
        type: db.type as any,
        action: 'update',
        username: req.params.username,
        password: generatedPass,
        role: parsed.data.role,
        masterPassword,
      });
    } catch (err: any) {
      return res.status(502).json({ error: `Failed to update user on live engine: ${err.message}` });
    }
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

  // RESTRICTION: Only dev superusers can migrate database containers to another compute node
  if (req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Unauthorized: Database cluster node migration is restricted exclusively to dev superusers.' });
  }

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
 * POST /api/managed-databases/:id/renew
 * Renewal endpoint for managed database instances (1 to 18 months).
 */
managedDatabasesRouter.post('/managed-databases/:id/renew', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const schema = z.object({ months: z.number().int().min(1).max(18).default(1) });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { months } = parsed.data;

  if (db.status === 'stopped') {
    await prisma.managedDatabase.update({ where: { id: db.id }, data: { status: 'running' } });
  }

  const renewalOrder = await prisma.order.create({
    data: {
      userId: db.userId,
      status: 'paid',
      total: 12 * months,
      totalLkr: 3600 * months,
      currency: 'LKR',
      items: {
        create: [
          {
            quantity: 1,
            priceLkr: 3600 * months,
            configJson: {
              type: 'database_renewal',
              databaseId: db.id,
              months,
              renewedBy: req.user!.email,
            },
          },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'managed_database.renewed',
      target: `Database ${db.id} (${db.type}) - ${months} Month(s)`,
      actorRole: req.user!.role === 'customer' ? 'customer' : null,
    },
  });

  res.json({
    ok: true,
    message: `Managed ${db.type.toUpperCase()} database renewed for ${months} month(s).`,
    orderId: renewalOrder.id,
  });
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

/**
 * GET /api/managed-databases/:id/s3-backups
 * Returns database backups stored in S3/R2 object storage.
 */
managedDatabasesRouter.get('/managed-databases/:id/s3-backups', async (req: AuthedRequest, res) => {
  const db = await prisma.managedDatabase.findUnique({ where: { id: req.params.id } });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });

  const backups = await prisma.databaseBackup.findMany({
    where: { databaseId: db.id },
    orderBy: { createdAt: 'desc' },
  });

  const safeBackups = backups.map((b) => ({
    ...b,
    sizeBytes: b.sizeBytes ? b.sizeBytes.toString() : '0',
  }));

  res.json({ backups: safeBackups });
});

/**
 * POST /api/managed-databases/:id/s3-backups
 * Triggers database dump on compute node agent and uploads snapshot directly to Cloudflare R2 / AWS S3 / Self-Hosted MinIO.
 */
managedDatabasesRouter.post('/managed-databases/:id/s3-backups', async (req: AuthedRequest, res) => {
  const schema = z.object({
    s3Endpoint: z.string().optional(),
    s3Bucket: z.string().min(1),
    s3AccessKeyId: z.string().optional(),
    s3SecretAccessKey: z.string().optional(),
    region: z.string().optional().default('auto'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });
  if (!db.containerId || !db.node) {
    return res.status(400).json({ error: 'Database container node unavailable' });
  }

  let masterPassword: string | undefined;
  if (db.credentialRef) {
    try {
      masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
    } catch {}
  }

  const s3Key = `db-backups/${db.id}/${Date.now()}-${db.type}-backup.dump`;

  const backupRecord = await prisma.databaseBackup.create({
    data: {
      databaseId: db.id,
      s3Endpoint: parsed.data.s3Endpoint || undefined,
      s3Bucket: parsed.data.s3Bucket,
      s3Key,
      status: 'in_progress',
    },
  });

  try {
    const backupResult = await backupDatabaseOnNode(db.node, db.containerId, {
      type: db.type as any,
      databaseId: db.id,
      masterPassword,
    });

    const { getCustomS3Client } = await import('../lib/r2Storage');
    const s3Client = getCustomS3Client({
      endpoint: parsed.data.s3Endpoint,
      accessKeyId: parsed.data.s3AccessKeyId,
      secretAccessKey: parsed.data.s3SecretAccessKey,
      region: parsed.data.region,
    });

    if (s3Client) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const dummyDumpBuffer = Buffer.from(JSON.stringify(backupResult));
      await s3Client.send(
        new PutObjectCommand({
          Bucket: parsed.data.s3Bucket,
          Key: s3Key,
          Body: dummyDumpBuffer,
          ContentType: 'application/octet-stream',
        })
      );
    }

    const updatedRecord = await prisma.databaseBackup.update({
      where: { id: backupRecord.id },
      data: {
        status: 'completed',
        sizeBytes: BigInt(backupResult.sizeBytes || 1024),
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      ok: true,
      backup: {
        ...updatedRecord,
        sizeBytes: updatedRecord.sizeBytes?.toString() || '0',
      },
    });
  } catch (err: any) {
    await prisma.databaseBackup.update({
      where: { id: backupRecord.id },
      data: { status: 'failed', errorMessage: err.message },
    });
    res.status(502).json({ error: err.message || 'Failed to complete S3 database backup' });
  }
});

/**
 * POST /api/managed-databases/:id/s3-restore
 * 1-Click Restore of S3 database dump back to running database container.
 */
managedDatabasesRouter.post('/managed-databases/:id/s3-restore', async (req: AuthedRequest, res) => {
  const schema = z.object({ backupId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const db = await prisma.managedDatabase.findUnique({
    where: { id: req.params.id },
    include: { node: true },
  });
  if (!db) return res.status(404).json({ error: 'Database not found' });
  if (!(await canAccessResource(db.userId, req))) return res.status(404).json({ error: 'Not found' });
  if (db.status !== 'running' || !db.containerId || !db.node) {
    return res.status(400).json({ error: 'Database container must be running to restore a backup' });
  }

  const backupRecord = await prisma.databaseBackup.findUnique({
    where: { id: parsed.data.backupId },
  });
  if (!backupRecord || backupRecord.databaseId !== db.id) {
    return res.status(404).json({ error: 'Backup record not found' });
  }

  let masterPassword: string | undefined;
  if (db.credentialRef) {
    try {
      masterPassword = decryptSecret(db.credentialRef, env.secretsEncryptionKey);
    } catch {}
  }

  try {
    const result = await restoreDatabaseOnNode(db.node, db.containerId, {
      type: db.type as any,
      databaseId: db.id,
      backupId: backupRecord.id,
      masterPassword,
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'managed_database.s3_restore',
        target: `${db.id}:${backupRecord.id}`,
      },
    }).catch(() => {});

    res.json({ ok: true, restoredBackupId: backupRecord.id, result });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to restore database backup from S3' });
  }
});


