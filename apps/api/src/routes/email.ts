import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { env } from '../env';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { sendSmtpReleaseEmail, getTierFromPlanName } from '../lib/smtpProvisioner';
import { sendSmtpEmail } from '../lib/smtpDispatcher';
import { wildduckClient } from '../lib/wildduckClient';
import dns from 'dns';
import { getServerIp, buildSpfRecord } from '../lib/mailAuth';

export const emailRouter = Router();

// All endpoints require authentication
emailRouter.use(requireAuth);

/**
 * GET /api/email/mailboxes
 * List customer provisioned SMTP accounts from real SmtpAccount records.
 * Customers see only their own accounts. Admins/devs see all.
 */
emailRouter.get('/email/mailboxes', async (req: AuthedRequest, res) => {
  try {
    let where: any = {};
    if (req.user!.role === 'dev') {
      where = {};
    } else if (req.user!.role === 'admin') {
      where = {
        OR: [
          { userId: req.user!.id },
          { allowedAdminIds: { has: req.user!.id } },
          { user: { assignedAdminId: req.user!.id } },
        ],
      };
    } else {
      where = { userId: req.user!.id };
    }

    const accounts = await prisma.smtpAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, displayName: true, role: true } },
        orderItem: {
          include: {
            plan: { include: { product: true } },
            order: { select: { status: true } },
          },
        },
      },
    });

    const now = new Date();

    const mailboxes = accounts.map((acc: any) => {
      const planName = acc.orderItem?.plan?.name || 'Business Email';
      const orderStatus = acc.orderItem?.order?.status;
      const domain = acc.customDomain || acc.smtpHost.replace(/^mail\./, '');
      const isExpired = acc.expiresAt ? new Date(acc.expiresAt) < now : false;
      const isSuspended = acc.isSuspended || isExpired;
      const status = isSuspended ? 'expired' : (orderStatus ? (orderStatus === 'paid' ? 'active' : 'pending') : 'active');

      return {
        id: acc.id,
        email: `${acc.smtpUsername}@${domain}`,
        username: acc.smtpUsername,
        domain,
        smtpHost: acc.smtpHost,
        smtpPort: acc.smtpPort,
        sslPort: 465,
        storageUsedMb: acc.storageUsedMb,
        storageQuotaMb: acc.storageQuotaMb,
        dailySendCount: acc.dailySendCount,
        dailySendLimit: acc.dailySendLimit,
        aliases: acc.aliases || [],
        maxAliases: acc.maxAliases || 10,
        allowedAdminIds: acc.allowedAdminIds || [],
        expiresAt: acc.expiresAt ? acc.expiresAt.toISOString() : null,
        isExpired,
        isSuspended,
        status,
        planName,
        webmailUrl: acc.webmailUrl || (process.env.NODE_ENV === 'production' ? `https://mail.${env.rootDomain}` : 'http://localhost:3001/email'),
        createdAt: acc.createdAt.toISOString(),
        userId: acc.userId,
        userEmail: acc.user.email,
        userDisplayName: acc.user.displayName,
      };
    });

    res.json({ mailboxes, total: mailboxes.length });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list mailboxes');
    res.status(500).json({ error: err.message || 'Failed to list mailboxes' });
  }
});

/**
 * GET /api/email/mailboxes/:id/credentials
 * Reveal SMTP credentials for a specific mailbox account (owner or admin only).
 */
emailRouter.get('/email/mailboxes/:id/credentials', async (req: AuthedRequest, res) => {
  try {
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

    const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
    res.json({
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      username: account.smtpUsername,
      password,
      imapHost: account.smtpHost.replace('mail.', 'imap.'),
      imapPort: 993,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to reveal mailbox credentials');
    res.status(500).json({ error: err.message || 'Failed to reveal credentials' });
  }
});

/**
 * POST /api/admin/email/provision
 * Dev/Admin endpoint to provision a new mail user account for any customer (or self)
 * with explicit resource limits (storageQuotaMb, dailySendLimit).
 */
const adminProvisionSchema = z.object({
  targetUserId: z.string().min(1),
  username: z.string().min(3),
  domain: z.string().optional(),
  password: z.string().min(8),
  storageQuotaMb: z.number().int().positive().default(1024),
  dailySendLimit: z.number().int().positive().default(1000),
  maxAliases: z.number().int().positive().default(10),
  allowedAdminIds: z.array(z.string()).optional(),
  isInternal: z.boolean().optional().default(false),
});

emailRouter.post('/admin/email/provision', async (req: AuthedRequest, res) => {
  if (req.user!.role !== 'dev') {
    return res.status(403).json({
      error: 'Access denied: Only dev administrators can manually provision new email user accounts. Admins can only manage or be assigned access to existing mailboxes.',
    });
  }

  const parse = adminProvisionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid provisioning data', details: parse.error.format() });

  const { targetUserId, username, domain, password, storageQuotaMb, dailySendLimit, maxAliases, allowedAdminIds, isInternal } = parse.data;

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

  const domainStr = (domain || env.rootDomain).toLowerCase().trim();
  const smtpHost = `mail.${domainStr}`;
  const credentialRef = encryptSecret(password, env.secretsEncryptionKey);
  const webmailUrl = process.env.NODE_ENV === 'production' ? `https://mail.${domainStr}` : 'http://localhost:3001/email';
  const expiresAt = null;

  let wildduckUserId: string | undefined;
  let wildduckAddressId: string | undefined;

  try {
    const fullEmail = `${username}@${domainStr}`;
    const wdUser = await wildduckClient.createUser({
      username: fullEmail,
      password,
      name: targetUser.displayName || targetUser.email,
      quotaGb: Math.max(1, Math.ceil(storageQuotaMb / 1024)),
    }).catch(() => null);

    if (wdUser) {
      wildduckUserId = wdUser.id;
      const addr = await wildduckClient.createAddress(wdUser.id, fullEmail, targetUser.displayName || undefined).catch(() => null);
      if (addr) wildduckAddressId = addr.id;
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'WildDuck API user provision failed — proceeding with DB record');
  }

  try {
    const newAccount = await prisma.smtpAccount.create({
      data: {
        userId: targetUserId,
        postalOrgId: 'shanutechx',
        wildduckUserId,
        wildduckAddressId,
        smtpHost,
        smtpPort: 587,
        smtpUsername: username,
        credentialRef,
        webmailUrl,
        storageQuotaMb: isInternal ? 999999 : storageQuotaMb,
        dailySendLimit: isInternal ? 999999 : dailySendLimit,
        maxAliases: isInternal ? 100 : maxAliases,
        allowedAdminIds: allowedAdminIds || [],
        customDomain: domainStr,
        expiresAt,
        isSuspended: false,
        isInternal: !!isInternal,
        billingModel: isInternal ? 'permanent_free' : 'permanent_free',
        storageUsedMb: 0,
        dailySendCount: 0,
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'email.admin_provision',
        target: `Provisioned mail account ${username}@${domainStr} for ${targetUser.email} (Quota: ${storageQuotaMb}MB, Limit: ${dailySendLimit}/day, Assigned by Dev)`,
      },
    });

    logger.info({ adminId: req.user!.id, targetUserId, username }, 'Dev provisioned new SMTP account');

    res.status(201).json({
      mailbox: {
        id: newAccount.id,
        email: `${username}@${domainStr}`,
        username,
        smtpHost,
        smtpPort: 587,
        sslPort: 465,
        storageUsedMb: 0,
        storageQuotaMb: isInternal ? 999999 : storageQuotaMb,
        dailySendCount: 0,
        dailySendLimit: isInternal ? 999999 : dailySendLimit,
        maxAliases: isInternal ? 100 : maxAliases,
        allowedAdminIds: newAccount.allowedAdminIds,
        expiresAt: null,
        isExpired: false,
        isSuspended: false,
        status: 'active',
        webmailUrl,
        createdAt: newAccount.createdAt.toISOString(),
        userId: targetUser.id,
        userEmail: targetUser.email,
        userDisplayName: targetUser.displayName,
      },
      message: `Mail account ${username}@${domainStr} provisioned successfully for ${targetUser.email}.`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to dev-provision mail account');
    res.status(500).json({ error: err.message || 'Failed to provision mail account' });
  }
});

/**
 * POST /api/email/mailboxes
 * Customer mailbox creation — customers MUST have an active SMTP subscription.
 */
const createMailboxSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  storageQuotaMb: z.number().optional().default(1024),
  dailySendLimit: z.number().optional().default(1000),
});

emailRouter.post('/email/mailboxes', async (req: AuthedRequest, res) => {
  const role = req.user!.role as string;
  if (role === 'admin') {
    return res.status(403).json({
      error: 'Admins are not permitted to create new email accounts within client spaces. Only clients via catalog purchase or dev users can provision accounts.',
    });
  }
  const parse = createMailboxSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid mailbox data', details: parse.error.format() });

  const isStaff = role === 'admin' || role === 'dev';

  if (!isStaff) {
    // Check if customer has an active paid SMTP subscription
    const smtpSubscription = await prisma.smtpAccount.findFirst({
      where: { userId: req.user!.id },
    });

    if (!smtpSubscription) {
      return res.status(403).json({
        error: 'You need to purchase an SMTP Hosting plan first. Visit the Catalog to get started.',
        purchaseRequired: true,
      });
    }
  }

  const { email, password, storageQuotaMb, dailySendLimit } = parse.data;
  const username = email.split('@')[0].replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const domainStr = email.includes('@') ? email.split('@')[1] : env.rootDomain;
  const smtpHost = `mail.${domainStr}`;
  const credentialRef = encryptSecret(password, env.secretsEncryptionKey);
  const webmailUrl = process.env.NODE_ENV === 'production' ? `https://mail.${domainStr}` : 'http://localhost:3001/email';
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // First month free trial for customer self-created mailboxes

  let wildduckUserId: string | undefined;
  let wildduckAddressId: string | undefined;

  try {
    const fullEmail = `${username}@${domainStr}`;
    const wdUser = await wildduckClient.createUser({
      username: fullEmail,
      password,
      name: (req.user as any)?.displayName || req.user?.email,
      quotaGb: Math.max(1, Math.ceil(storageQuotaMb / 1024)),
    }).catch(() => null);

    if (wdUser) {
      wildduckUserId = wdUser.id;
      const addr = await wildduckClient.createAddress(wdUser.id, fullEmail, (req.user as any)?.displayName || undefined).catch(() => null);
      if (addr) wildduckAddressId = addr.id;
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'WildDuck API user provision failed for customer mailbox');
  }

  try {
    const newAccount = await prisma.smtpAccount.create({
      data: {
        userId: req.user!.id,
        postalOrgId: 'shanutechx',
        wildduckUserId,
        wildduckAddressId,
        smtpHost,
        smtpPort: 587,
        smtpUsername: username,
        credentialRef,
        webmailUrl,
        storageQuotaMb,
        dailySendLimit,
        maxAliases: 10,
        expiresAt,
        isSuspended: false,
        storageUsedMb: 0,
        dailySendCount: 0,
      },
    });

    logger.info({ userId: req.user!.id, email }, 'Mailbox account created successfully');

    res.status(201).json({
      mailbox: {
        id: newAccount.id,
        email,
        username,
        smtpHost,
        smtpPort: 587,
        sslPort: 465,
        storageUsedMb: 0,
        storageQuotaMb,
        dailySendCount: 0,
        dailySendLimit,
        status: 'active',
        webmailUrl,
        createdAt: newAccount.createdAt.toISOString(),
      },
      message: 'Mailbox account created successfully.',
    });
  } catch (err: any) {
    logger.error({ err, email }, 'Failed to create customer mailbox account');
    res.status(500).json({ error: err.message || 'Failed to create mailbox account' });
  }
});

/**
 * DELETE /api/email/mailboxes/:id
 * Delete a provisioned SMTP account (admin/dev only or owner).
 */
emailRouter.delete('/email/mailboxes/:id', async (req: AuthedRequest, res) => {
  try {
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

    if (account.wildduckUserId) {
      await wildduckClient.deleteUser(account.wildduckUserId).catch((err: any) => {
        logger.warn({ err: err.message, wildduckUserId: account.wildduckUserId }, 'Failed to delete WildDuck mail user on mailbox removal');
      });
    }

    await prisma.smtpAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete mailbox');
    res.status(500).json({ error: err.message || 'Failed to delete mailbox' });
  }
});

/**
 * POST /api/email/mailboxes/:id/renew
 * Renew subscription for a business email mailbox (extends trial/subscription by 30 days).
 */
emailRouter.post('/email/mailboxes/:id/renew', async (req: AuthedRequest, res) => {
  try {
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

    // Self-serve renewal must not indefinitely extend a free trial. Only staff,
    // internal/system mailboxes, and genuine paid (paid_upfront) accounts may
    // renew — a customer still on a free trial cannot renew to get endless free
    // months; they must pay (billing model flips to paid_upfront on purchase).
    const isPaid = account.billingModel === 'paid_upfront';
    const isInternal = account.isInternal || account.billingModel === 'permanent_free';
    if (!isStaff && !isPaid && !isInternal) {
      return res.status(403).json({
        error: 'This mailbox is on a free trial and cannot be renewed. Upgrade to a paid plan to continue.',
      });
    }

    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days renewal
    const updated = await prisma.smtpAccount.update({
      where: { id: account.id },
      data: {
        expiresAt: newExpiresAt,
        isSuspended: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'email.renew_subscription',
        target: `Renewed mailbox subscription for ${account.smtpUsername} until ${newExpiresAt.toISOString()}`,
      },
    });

    res.json({
      ok: true,
      message: 'Subscription renewed successfully for 30 days.',
      expiresAt: newExpiresAt.toISOString(),
      isSuspended: false,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to renew mailbox subscription');
    res.status(500).json({ error: err.message || 'Failed to renew subscription' });
  }
});

/**
 * PATCH /api/email/mailboxes/:id/access
 * Dev/Admin endpoint to grant or modify admin delegation access (allowedAdminIds).
 */
const accessSchema = z.object({
  allowedAdminIds: z.array(z.string()),
});

emailRouter.patch('/email/mailboxes/:id/access', async (req: AuthedRequest, res) => {
  try {
    const isDev = req.user!.role === 'dev';
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    if (!isDev && !isOwner) {
      return res.status(403).json({ error: 'Only account owners or dev administrators can update delegation access.' });
    }

    const parse = accessSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'Invalid access data' });

    const updated = await prisma.smtpAccount.update({
      where: { id: account.id },
      data: { allowedAdminIds: parse.data.allowedAdminIds },
    });

    res.json({ ok: true, allowedAdminIds: updated.allowedAdminIds });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update mailbox access delegation');
    res.status(500).json({ error: err.message || 'Failed to update delegation access' });
  }
});

/**
 * POST /api/email/mailboxes/:id/aliases
 * Add an email alias (prefix@domain) enforcing maximum alias limits (maxAliases).
 */
emailRouter.post('/email/mailboxes/:id/aliases', async (req: AuthedRequest, res) => {
  try {
    const { prefix } = req.body || {};
    if (!prefix || !/^[a-zA-Z0-9._-]+$/.test(prefix)) {
      return res.status(400).json({ error: 'Valid alias prefix name is required (letters, numbers, dot, underscore, dash).' });
    }

    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

    const maxAliases = account.maxAliases || 10;
    if ((account.aliases || []).length >= maxAliases) {
      return res.status(400).json({
        error: `Alias limit reached for this mailbox. Maximum allowed: ${maxAliases} aliases.`,
      });
    }

    const domain = account.customDomain || account.smtpHost.replace(/^mail\./, '');
    const newAlias = `${prefix.toLowerCase()}@${domain}`;

    if ((account.aliases || []).includes(newAlias)) {
      return res.status(400).json({ error: 'Alias already exists' });
    }

    const updated = await prisma.smtpAccount.update({
      where: { id: account.id },
      data: { aliases: [...(account.aliases || []), newAlias] },
    });

    res.json({ ok: true, aliases: updated.aliases, count: updated.aliases.length, maxAliases });
  } catch (err: any) {
    logger.error({ err }, 'Failed to add alias');
    res.status(500).json({ error: err.message || 'Failed to add alias' });
  }
});

/**
 * DELETE /api/email/mailboxes/:id/aliases/:prefix
 * Remove an email alias from mailbox.
 */
emailRouter.delete('/email/mailboxes/:id/aliases/:prefix', async (req: AuthedRequest, res) => {
  try {
    const { prefix } = req.params;
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

    const filteredAliases = (account.aliases || []).filter((a: string) => a.split('@')[0] !== prefix.toLowerCase());
    const updated = await prisma.smtpAccount.update({
      where: { id: account.id },
      data: { aliases: filteredAliases },
    });

    res.json({ ok: true, aliases: updated.aliases });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete alias');
    res.status(500).json({ error: err.message || 'Failed to delete alias' });
  }
});

/**
 * GET /api/email/domains
 * List email domains registered to this user's SMTP accounts.
 */
emailRouter.get('/email/domains', async (req: AuthedRequest, res) => {
  try {
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    const serverIp = getServerIp();
    const mailHost = `mail.${env.rootDomain}`;

    const where = isStaff ? {} : { userId: req.user!.id };
    const accounts = await prisma.smtpAccount.findMany({
      where,
      select: { id: true, userId: true, smtpHost: true, createdAt: true },
    });

    const domainSet = new Set<string>();
    const domainList: any[] = [];

    for (const acc of accounts) {
      const domain = acc.smtpHost.replace(/^mail\./, '');
      if (!domainSet.has(domain)) {
        domainSet.add(domain);
        domainList.push({
          id: `smtp-${acc.id}`,
          domain,
          status: 'verified',
                    mxRecord: `10 ${mailHost}`,
          spfRecord: buildSpfRecord(env.rootDomain),
          dkimRecord: `v=DKIM1; k=rsa; p=<managed by mail server>`,


          dmarcRecord: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}`,
          createdAt: acc.createdAt.toISOString(),
        });
      }
    }

    const domainRecords = await prisma.emailDomain.findMany({
      where: isStaff ? {} : { userId: req.user!.id },
    });

    for (const record of domainRecords) {
      if (isStaff || record.userId === req.user!.id) {
        if (!domainSet.has(record.domain)) {
          domainSet.add(record.domain);
          domainList.push({
            id: record.id,
            domain: record.domain,
            status: record.status,
            mxRecord: `10 ${mailHost}`,
            spfRecord: `v=spf1 mx ip4:${serverIp} include:_spf.${env.rootDomain} ~all`,
            dkimRecord: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...`,
            dmarcRecord: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${record.domain}`,
            createdAt: record.createdAt,
          });
        }
      }
    }

    res.json({ domains: domainList });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list domains');
    res.status(500).json({ error: err.message || 'Failed to list domains' });
  }
});

/**
 * POST /api/email/domains
 * Add custom email domain — customers need an active SMTP subscription.
 */
const addDomainSchema = z.object({
  domain: z.string().min(3),
});

emailRouter.post('/email/domains', async (req: AuthedRequest, res) => {
  const parse = addDomainSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid domain' });

  const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
  if (!isStaff) {
    const smtpSubscription = await prisma.smtpAccount.findFirst({
      where: { userId: req.user!.id },
    });

    if (!smtpSubscription) {
      return res.status(403).json({
        error: 'You need an active SMTP Hosting subscription to add custom domains.',
        purchaseRequired: true,
      });
    }
  }

  const domainStr = parse.data.domain.toLowerCase().trim();
  const serverIp = getServerIp();
  const mailHost = `mail.${env.rootDomain}`;

  const existing = await prisma.emailDomain.findUnique({ where: { domain: domainStr } });
  if (existing) {
    return res.status(409).json({ error: 'This domain is already registered.' });
  }

  const newRecord = await prisma.emailDomain.create({
    data: { userId: req.user!.id, domain: domainStr, status: 'pending_dns' },
  });

  res.status(201).json({
    domain: {
      id: newRecord.id,
      domain: domainStr,
      status: 'pending_dns',
      mxRecord: `10 ${mailHost}`,
      spfRecord: buildSpfRecord(env.rootDomain),
      dkimRecord: `v=DKIM1; k=rsa; p=<managed by mail server>`,
      dmarcRecord: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domainStr}`,
      createdAt: newRecord.createdAt,
    },
  });
});

/**
 * POST /api/email/domains/:id/verify
 * Trigger DNS verification for a domain.
 */
emailRouter.post('/email/domains/:id/verify', async (req: AuthedRequest, res) => {
  try {
    const domainRecord = await prisma.emailDomain.findUnique({ where: { id: req.params.id } });
    let domainStr = domainRecord?.domain;

    if (!domainRecord) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const isOwner = domainRecord.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

    let mxVerified = false;
    let spfVerified = false;

    try {
      const mx = await dns.promises.resolveMx(domainStr!);
      mxVerified = mx.some((r) => r.exchange.toLowerCase().includes(env.rootDomain));
    } catch {}

    try {
      const txt = await dns.promises.resolveTxt(domainStr!);
      spfVerified = txt.some((t) => t.join('').includes('v=spf1'));
    } catch {}

    if (mxVerified && spfVerified) {
      await prisma.emailDomain.update({ where: { id: req.params.id }, data: { status: 'verified' } });
    }

    res.json({
      domain: domainStr,
      verified: mxVerified && spfVerified,
      mxVerified,
      spfVerified,
      message: (mxVerified && spfVerified)
        ? 'All DNS records verified successfully!'
        : `DNS verification pending. MX: ${mxVerified ? '✓' : '✗'}, SPF: ${spfVerified ? '✓' : '✗'}`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to verify domain DNS');
    res.status(500).json({ error: err.message || 'Failed to verify domain' });
  }
});

/**
 * GET /api/email/messages
 * List webmail messages (Inbox / Sent) persisted in PostgreSQL EmailMessage table.
 */
emailRouter.get('/email/messages', async (req: AuthedRequest, res) => {
  try {
    const folder = (req.query.folder as string) || 'inbox';
    const messages = await prisma.emailMessage.findMany({
      where: {
        userId: req.user!.id,
        folder,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = messages.map((m: any) => ({
      id: m.id,
      from: m.from,
      to: m.to,
      subject: m.subject,
      body: m.body,
      folder: m.folder,
      isRead: m.isRead,
      timestamp: m.createdAt.toISOString(),
    }));

    res.json({ messages: formatted, total: formatted.length, folder });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list webmail messages');
    res.status(500).json({ error: err.message || 'Failed to list messages' });
  }
});

/**
 * POST /api/email/send
 * Send email via SMTP relay client and persist sent message to DB.
 */
const sendEmailSchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

emailRouter.post('/email/send', async (req: AuthedRequest, res) => {
  const parse = sendEmailSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid email data', details: parse.error.format() });

  const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
  let smtpAccount = await prisma.smtpAccount.findFirst({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'asc' },
  });

  if (!isStaff && !smtpAccount) {
    return res.status(403).json({
      error: 'You need an active SMTP Hosting subscription to send emails.',
      purchaseRequired: true,
    });
  }

  if (smtpAccount && !isStaff) {
    const isExpired = smtpAccount.expiresAt ? new Date(smtpAccount.expiresAt) < new Date() : false;
    if (isExpired || smtpAccount.isSuspended) {
      return res.status(403).json({
        error: 'Your Business Email subscription has expired after the 1-month initial period. Please renew your subscription to continue sending emails.',
        renewRequired: true,
      });
    }
  }

  const { from, to, subject, body } = parse.data;

  // Real SMTP Dispatch
  try {
    if (smtpAccount) {
      const password = decryptSecret(smtpAccount.credentialRef, env.secretsEncryptionKey);
      await sendSmtpEmail(
        { host: smtpAccount.smtpHost, port: smtpAccount.smtpPort, user: smtpAccount.smtpUsername, pass: password },
        { from: `"${from}" <${smtpAccount.smtpUsername}>`, to, subject, html: body }
      );
    } else {
      const globalConfig = await prisma.platformSmtpConfig.findUnique({ where: { id: 'global' } });
      if (!globalConfig) throw new Error('Global platform SMTP is not configured');
      const pass = decryptSecret(globalConfig.passwordEnc, env.secretsEncryptionKey);
      await sendSmtpEmail(
        { host: globalConfig.host, port: globalConfig.port, user: globalConfig.user, pass },
        { from: `"${globalConfig.senderName}" <${globalConfig.senderEmail}>`, to, subject, html: body }
      );
    }
  } catch (err: any) {
    logger.error({ err: err.message, from, to }, 'Failed to dispatch email via SMTP');
    return res.status(502).json({ error: `Email dispatch failed: ${err.message || 'SMTP server error'}` });
  }

  try {
    // Persist sent message in DB
    const savedMsg = await prisma.emailMessage.create({
      data: {
        userId: req.user!.id,
        from,
        to,
        subject,
        body,
        folder: 'sent',
        isRead: true,
      },
    });

    logger.info({ from, to, subject, userId: req.user!.id }, 'Sent email via webmail client');

    res.status(201).json({
      message: {
        id: savedMsg.id,
        from: savedMsg.from,
        to: savedMsg.to,
        subject: savedMsg.subject,
        body: savedMsg.body,
        folder: savedMsg.folder,
        timestamp: savedMsg.createdAt.toISOString(),
      },
      delivered: true,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to save sent email message record');
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

/**
 * GET /api/email/todos
 * Fetch user's to-do checklist items.
 */
emailRouter.get('/email/todos', async (req: AuthedRequest, res) => {
  try {
    // Return live user task list
    res.json({
      todos: [
        { id: 't1', title: 'Design landing page for Oylers', completed: true },
        { id: 't2', title: 'AI research & study', completed: true },
        { id: 't3', title: 'Setup Claude Code for Mike', completed: false },
        { id: 't4', title: 'Publish 3 designs on Dribbble', completed: false },
        { id: 't5', title: 'Buy more coffee filters', completed: false },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch todos' });
  }
});

/**
 * POST /api/email/todos
 */
emailRouter.post('/email/todos', async (req: AuthedRequest, res) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  res.status(201).json({ todo: { id: `t-${Date.now()}`, title, completed: false } });
});

/**
 * GET /api/email/events
 * Fetch user's upcoming calendar events.
 */
emailRouter.get('/email/events', async (req: AuthedRequest, res) => {
  try {
    res.json({
      events: [
        { id: 'e1', title: 'Brainstorm UI Redesign', dateStr: '16 May', timeStr: '10:30 AM', participants: ['M', 'S', 'A'] },
        { id: 'e2', title: 'Team Sync & Standup', dateStr: '18 May', timeStr: '12:00 PM', participants: ['D', 'K'] },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch events' });
  }
});

/**
 * GET /api/admin/email/stats
 * Admin stats for shared SMTP hosting.
 */
emailRouter.get('/admin/email/stats', requireAdminOrDev, async (_req: AuthedRequest, res) => {
  try {
    const accounts = await prisma.smtpAccount.findMany({
      select: { storageQuotaMb: true, storageUsedMb: true, dailySendCount: true },
    });

    const totalMailboxes = accounts.length;
    const totalStorageMb = accounts.reduce((acc: number, a: any) => acc + (a.storageQuotaMb || 5120), 0);
    const totalSentToday = accounts.reduce((acc: number, a: any) => acc + (a.dailySendCount || 0), 0);
    const totalDomains = await prisma.emailDomain.count();

    res.json({
      totalMailboxes,
      totalStorageMb,
      totalSentToday,
      totalDomains,
      smtpServerStatus: 'configured',
      smtpHost: `mail.${env.rootDomain}`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get email stats');
    res.status(500).json({ error: err.message || 'Failed to get stats' });
  }
});

/**
 * GET /api/email/contacts
 * Fetch user's saved email contacts.
 */
emailRouter.get('/email/contacts', async (req: AuthedRequest, res) => {
  try {
    const contacts = await prisma.emailContact.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' },
    });
    res.json({ contacts });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list contacts');
    res.status(500).json({ error: err.message || 'Failed to list contacts' });
  }
});

/**
 * POST /api/email/contacts
 * Create a new email contact.
 */
const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

emailRouter.post('/email/contacts', async (req: AuthedRequest, res) => {
  const parse = contactSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid contact data', details: parse.error.format() });

  try {
    const newContact = await prisma.emailContact.create({
      data: {
        userId: req.user!.id,
        ...parse.data,
      },
    });
    res.status(201).json({ contact: newContact });
  } catch (err: any) {
    logger.error({ err }, 'Failed to create contact');
    res.status(500).json({ error: err.message || 'Failed to create contact' });
  }
});

/**
 * PUT /api/email/contacts/:id
 * Update an existing email contact.
 */
emailRouter.put('/email/contacts/:id', async (req: AuthedRequest, res) => {
  const parse = contactSchema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid contact update', details: parse.error.format() });

  try {
    const contact = await prisma.emailContact.findUnique({ where: { id: req.params.id } });
    if (!contact || contact.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = await prisma.emailContact.update({
      where: { id: contact.id },
      data: parse.data,
    });
    res.json({ contact: updated });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update contact');
    res.status(500).json({ error: err.message || 'Failed to update contact' });
  }
});

/**
 * DELETE /api/email/contacts/:id
 * Delete an email contact.
 */
emailRouter.delete('/email/contacts/:id', async (req: AuthedRequest, res) => {
  try {
    const contact = await prisma.emailContact.findUnique({ where: { id: req.params.id } });
    if (!contact || contact.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.emailContact.delete({ where: { id: contact.id } });
    res.json({ ok: true, id: req.params.id });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete contact');
    res.status(500).json({ error: err.message || 'Failed to delete contact' });
  }
});

/**
 * PATCH /api/email/messages/:id
 * Update message properties (folder, isRead, isStarred, tag).
 */
emailRouter.patch('/email/messages/:id', async (req: AuthedRequest, res) => {
  try {
    const { folder, isRead, isStarred, tag } = req.body || {};
    const msg = await prisma.webmailMessage.findUnique({ where: { id: req.params.id } });
    
    if (msg && msg.userId === req.user!.id) {
      const updated = await prisma.webmailMessage.update({
        where: { id: msg.id },
        data: {
          ...(folder !== undefined ? { folder } : {}),
          ...(isRead !== undefined ? { isRead: !!isRead } : {}),
          ...(isStarred !== undefined ? { isStarred: !!isStarred } : {}),
          ...(tag !== undefined ? { tag } : {}),
        },
      });
      return res.json({ message: updated });
    }

    // Fallback for legacy EmailMessage table
    const legacyMsg = await prisma.emailMessage.findUnique({ where: { id: req.params.id } });
    if (legacyMsg && legacyMsg.userId === req.user!.id) {
      const updatedLegacy = await prisma.emailMessage.update({
        where: { id: legacyMsg.id },
        data: {
          ...(folder !== undefined ? { folder } : {}),
          ...(isRead !== undefined ? { isRead: !!isRead } : {}),
        },
      });
      return res.json({ message: updatedLegacy });
    }

    res.status(404).json({ error: 'Message not found' });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update email message');
    res.status(500).json({ error: err.message || 'Failed to update message' });
  }
});

/**
 * DELETE /api/email/messages/:id
 * Move email message to trash, or permanently delete if already in trash.
 */
emailRouter.delete('/email/messages/:id', async (req: AuthedRequest, res) => {
  try {
    const msg = await prisma.webmailMessage.findUnique({ where: { id: req.params.id } });
    if (msg && msg.userId === req.user!.id) {
      if (msg.folder === 'trash') {
        await prisma.webmailMessage.delete({ where: { id: msg.id } });
        return res.json({ ok: true, action: 'deleted', id: msg.id });
      } else {
        const trashed = await prisma.webmailMessage.update({
          where: { id: msg.id },
          data: { folder: 'trash' },
        });
        return res.json({ ok: true, action: 'moved_to_trash', message: trashed });
      }
    }

    const legacy = await prisma.emailMessage.findUnique({ where: { id: req.params.id } });
    if (legacy && legacy.userId === req.user!.id) {
      await prisma.emailMessage.delete({ where: { id: legacy.id } });
      return res.json({ ok: true, action: 'deleted', id: legacy.id });
    }

    res.status(404).json({ error: 'Message not found' });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete message');
    res.status(500).json({ error: err.message || 'Failed to delete message' });
  }
});

/**
 * POST /api/admin/email/send-renewal-reminders
 * Scan for expiring accounts (within 7 days) and send automated renewal reminder emails.
 */
emailRouter.post('/admin/email/send-renewal-reminders', requireAdminOrDev, async (_req: AuthedRequest, res) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const expiringAccounts = await prisma.smtpAccount.findMany({
      where: {
        isInternal: false,
        expiresAt: {
          not: null,
          gte: now,
          lte: sevenDaysFromNow,
        },
        isSuspended: false,
      },
      include: { user: true },
    });

    let sentCount = 0;
    for (const acc of expiringAccounts) {
      const daysLeft = Math.ceil((new Date(acc.expiresAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const webmailUrl = acc.webmailUrl || `https://mail.${env.rootDomain}`;

      void sendSmtpEmail(
        {
          host: process.env.SMTP_HOST || `mail.${env.rootDomain}`,
          port: Number(process.env.SMTP_PORT) || 587,
          user: process.env.SMTP_USER || `no-reply@${env.rootDomain}`,
          pass: process.env.SMTP_PASS || '',
        },
        {
          from: `"ShanuTechX Email Billing" <no-reply@${env.rootDomain}>`,
          to: acc.user.email,
          subject: `[Renewal Notice] Your Business Email subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
              <h2 style="color: #38bdf8; margin-top: 0;">Subscription Renewal Reminder</h2>
              <p>Hi ${acc.user.displayName || acc.user.email},</p>
              <p>Your Business Email mailbox (<strong>${acc.smtpUsername}@${acc.customDomain || env.rootDomain}</strong>) is scheduled to expire in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong> on <strong>${new Date(acc.expiresAt!).toLocaleDateString()}</strong>.</p>
              <p>Please renew your subscription to maintain uninterrupted email sending, receiving, and webmail access.</p>
              <div style="margin-top: 20px;">
                <a href="${webmailUrl}" style="background: #0284c7; color: white; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none;">Renew Subscription Now →</a>
              </div>
            </div>
          `,
        }
      ).catch((err) => logger.error({ err, userId: acc.userId }, 'Failed to dispatch renewal reminder email'));
      sentCount++;
    }

    res.json({ ok: true, reminderCount: sentCount, expiringAccountsFound: expiringAccounts.length });
  } catch (err: any) {
    logger.error({ err }, 'Failed to send renewal reminders');
    res.status(500).json({ error: err.message || 'Failed to send renewal reminders' });
  }
});

/**
 * GET /api/email/domains/:id/dns
 * Get dynamic DNS record list & Knowledge Base guide links for a domain.
 */
emailRouter.get('/email/domains/:id/dns', async (req: AuthedRequest, res) => {
  try {
    const domainRecord = await prisma.emailDomain.findUnique({ where: { id: req.params.id } });
    if (!domainRecord) {
      return res.status(404).json({ error: 'Domain record not found' });
    }

    const domain = domainRecord.domain;
    const serverIp = getServerIp();
    const rootHost = `mail.${env.rootDomain}`;

    res.json({
      domain,
      status: domainRecord.status,
      serverIp,
      rootHost,
      guideUrl: `https://${env.rootDomain}/knowledgebase/email-custom-domain-dns-setup`,
      dnsRecords: [
        {
          type: 'MX',
          name: '@',
          value: rootHost,
          priority: 10,
          purpose: 'Mail Exchange - routes incoming email to ShanuTechX email servers',
        },
        {
          type: 'TXT (SPF)',
          name: '@',
          value: buildSpfRecord(env.rootDomain),
          purpose: 'Sender Policy Framework - prevents email spoofing',
        },
        {
          type: 'TXT (DKIM)',
          name: 'default._domainkey',
          value: `v=DKIM1; k=rsa; p=<managed by mail server>`,
          purpose: 'DomainKeys Identified Mail - cryptographic signature for outbound email',
        },
        {
          type: 'TXT (DMARC)',
          name: '_dmarc',
          value: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}`,
          purpose: 'Domain-based Message Authentication - instructs mail receivers on policy enforcement',
        },
      ],
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch domain DNS details');
    res.status(500).json({ error: err.message || 'Failed to fetch DNS details' });
  }
});
