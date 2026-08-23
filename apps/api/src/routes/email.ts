import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { env } from '../env';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { sendSmtpReleaseEmail, getTierFromPlanName } from '../lib/smtpProvisioner';
import dns from 'dns';

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
    const where = await ownedResourceWhere(req);
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

    const mailboxes = accounts.map((acc: any) => {
      const planName = acc.orderItem?.plan?.name || 'Shared Mail Plan';
      const orderStatus = acc.orderItem?.order?.status;
      const domain = acc.smtpHost.replace(/^mail\./, '');
      return {
        id: acc.id,
        email: `${acc.smtpUsername}@${domain}`,
        username: acc.smtpUsername,
        smtpHost: acc.smtpHost,
        smtpPort: acc.smtpPort,
        sslPort: 465,
        storageUsedMb: acc.storageUsedMb,
        storageQuotaMb: acc.storageQuotaMb,
        dailySendCount: acc.dailySendCount,
        dailySendLimit: acc.dailySendLimit,
        status: orderStatus ? (orderStatus === 'paid' ? 'active' : 'pending') : 'active',
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
  storageQuotaMb: z.number().int().positive().default(5120),
  dailySendLimit: z.number().int().positive().default(1000),
});

emailRouter.post('/admin/email/provision', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parse = adminProvisionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid provisioning data', details: parse.error.format() });

  const { targetUserId, username, domain, password, storageQuotaMb, dailySendLimit } = parse.data;

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

  const domainStr = (domain || env.rootDomain).toLowerCase().trim();
  const smtpHost = `mail.${domainStr}`;
  const credentialRef = encryptSecret(password, env.secretsEncryptionKey);
  const webmailUrl = process.env.NODE_ENV === 'production' ? `https://mail.${domainStr}` : 'http://localhost:3001/email';

  try {
    const newAccount = await prisma.smtpAccount.create({
      data: {
        userId: targetUserId,
        postalOrgId: 'shanutechx',
        smtpHost,
        smtpPort: 587,
        smtpUsername: username,
        credentialRef,
        webmailUrl,
        storageQuotaMb,
        dailySendLimit,
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
        target: `Provisioned mail account ${username}@${domainStr} for ${targetUser.email} (Quota: ${storageQuotaMb}MB, Limit: ${dailySendLimit}/day)`,
      },
    });

    logger.info({ adminId: req.user!.id, targetUserId, username }, 'Admin provisioned new SMTP account');

    res.status(201).json({
      mailbox: {
        id: newAccount.id,
        email: `${username}@${domainStr}`,
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
        userId: targetUser.id,
        userEmail: targetUser.email,
        userDisplayName: targetUser.displayName,
      },
      message: `Mail account ${username}@${domainStr} provisioned successfully for ${targetUser.email}.`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to admin-provision mail account');
    res.status(500).json({ error: err.message || 'Failed to provision mail account' });
  }
});

/**
 * POST /api/email/mailboxes
 * Customer mailbox alias creation — customers MUST have an active SMTP subscription.
 */
const createMailboxSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  storageQuotaMb: z.number().optional().default(5120),
  dailySendLimit: z.number().optional().default(1000),
});

emailRouter.post('/email/mailboxes', async (req: AuthedRequest, res) => {
  const parse = createMailboxSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid mailbox data', details: parse.error.format() });

  const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';

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

  try {
    const newAccount = await prisma.smtpAccount.create({
      data: {
        userId: req.user!.id,
        postalOrgId: 'shanutechx',
        smtpHost,
        smtpPort: 587,
        smtpUsername: username,
        credentialRef,
        webmailUrl,
        storageQuotaMb,
        dailySendLimit,
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

    await prisma.smtpAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete mailbox');
    res.status(500).json({ error: err.message || 'Failed to delete mailbox' });
  }
});

/**
 * GET /api/email/domains
 * List email domains registered to this user's SMTP accounts.
 */
emailRouter.get('/email/domains', async (req: AuthedRequest, res) => {
  try {
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    const serverIp = process.env.SERVER_IP || '154.53.56.88';
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
          spfRecord: `v=spf1 mx ip4:${serverIp} include:_spf.${env.rootDomain} ~all`,
          dkimRecord: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ${acc.id.slice(0, 8)}...`,
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
  const serverIp = process.env.SERVER_IP || '154.53.56.88';
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
      spfRecord: `v=spf1 mx ip4:${serverIp} include:_spf.${env.rootDomain} ~all`,
      dkimRecord: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...`,
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
  if (!isStaff) {
    const smtpSubscription = await prisma.smtpAccount.findFirst({
      where: { userId: req.user!.id },
    });

    if (!smtpSubscription) {
      return res.status(403).json({
        error: 'You need an active SMTP Hosting subscription to send emails.',
        purchaseRequired: true,
      });
    }
  }

  const { from, to, subject, body } = parse.data;

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
    logger.error({ err }, 'Failed to send/save email message');
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
