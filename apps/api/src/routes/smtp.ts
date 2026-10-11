import net from 'net';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { requireAuth, requireDev, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere, verifyResourceOwnershipAsync } from '../middleware/rbac';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { verifySmtpConnection, sendSmtpEmail } from '../lib/smtpDispatcher';
import {
  sendSmtpReleaseEmail,
  SMTP_PLAN_TIERS,
  validateDomainForUser,
  generateDefaultAliases,
} from '../lib/smtpProvisioner';
import { logger } from '../lib/logger';
import dns from 'dns';
import { getServerIp, buildSpfRecord } from '../lib/mailAuth';

export const smtpRouter = Router();

smtpRouter.use(requireAuth);

const createSmtpAccountSchema = z.object({
  userId: z.string(),
  orderItemId: z.string().optional(),
  postalOrgId: z.string(),
  smtpHost: z.string().default(() => `mail.${env.rootDomain}`),
  smtpPort: z.number().int().positive().default(587),
  smtpUsername: z.string(),
  smtpPassword: z.string().min(8),
  webmailUrl: z.string().url().default(() => `https://mail.${env.rootDomain}`),
  domain: z.string().optional(),
  planTier: z.enum(['starter', 'pro', 'enterprise']).default('starter'),
  customAliases: z.array(z.string()).optional(),
  allowedAdminIds: z.array(z.string()).optional(),
  isInternal: z.boolean().optional().default(false),
  billingModel: z.enum(['free_trial_first_month', 'paid_upfront', 'permanent_free']).optional().default('permanent_free'),
  storageQuotaMb: z.number().optional(),
  dailySendLimit: z.number().optional(),
});

/**
 * Reads the single persisted platform SMTP config row, creating it
 * (from env-var defaults, same as the old in-memory initial state) on
 * first access if it doesn't exist yet.
 */
async function getGlobalSmtpConfig() {
  const existing = await prisma.platformSmtpConfig.findUnique({ where: { id: 'global' } });
  if (existing) return existing;

  return prisma.platformSmtpConfig.create({
    data: {
      id: 'global',
      provider: 'custom',
      host: process.env.SMTP_HOST || 'mail.shanutechx.com',
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || 'no-reply@shanutechx.com',
      passwordEnc: encryptSecret(process.env.SMTP_PASS || '', env.secretsEncryptionKey),
      senderEmail: process.env.SMTP_USER || 'no-reply@shanutechx.com',
      senderName: 'ShanuTechX Cloud Mailer',
      secure: false,
    },
  });
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  const normalized = ip.toLowerCase().trim();

  if (normalized.startsWith('::ffff:')) {
    return isPrivateIp(normalized.substring(7));
  }

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [a, b] = parts;
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    return false;
  }

  return false;
}

export async function isSsrfTargetAsync(host: string): Promise<boolean> {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  if (h === 'localhost' || isPrivateIp(h)) return true;
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|169\.254\.)/.test(h)) return true;

  try {
    const records = await dns.promises.lookup(h, { all: true });
    if (!records || records.length === 0) return true;
    return records.some((r) => isPrivateIp(r.address));
  } catch {
    return true;
  }
}

function isSsrfTarget(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  return h === 'localhost' || isPrivateIp(h) || /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|169\.254\.)/.test(h);
}

// 0. Platform Mail Admin Telemetry
smtpRouter.get('/admin/mail/telemetry', requireAdminOrDev, async (_req: AuthedRequest, res) => {
  try {
    const [totalMailboxes, totalStorage, sentTodayCount, accounts] = await Promise.all([
      prisma.smtpAccount.count(),
      prisma.smtpAccount.aggregate({ _sum: { storageQuotaMb: true } }),
      prisma.webmailMessage.count({ where: { folder: 'sent', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.smtpAccount.findMany({ select: { customDomain: true } }),
    ]);

    const domains = new Set(accounts.map((a) => a.customDomain).filter(Boolean));

    res.json({
      totalMailboxes,
      totalStorageMb: totalStorage._sum.storageQuotaMb || 0,
      totalSentToday: sentTodayCount,
      totalDomains: domains.size,
      activeRelayNodes: 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Telemetry query failed' });
  }
});

// 1. General Outbound Global SMTP Configuration
smtpRouter.get('/smtp/global-config', requireDev, async (_req: AuthedRequest, res) => {
  const config = await getGlobalSmtpConfig();
  const { passwordEnc, ...safeConfig } = config;
  res.json({ config: safeConfig, hasPassword: !!passwordEnc });
});

smtpRouter.post('/smtp/global-config', requireDev, async (req: AuthedRequest, res) => {
  const { provider, host, port, user, pass, senderEmail, senderName, secure } = req.body;

  const data: any = {};
  if (provider) data.provider = provider;
  if (host) data.host = host;
  if (port) data.port = Number(port);
  if (user) data.user = user;
  if (pass) data.passwordEnc = encryptSecret(pass, env.secretsEncryptionKey);
  if (senderEmail) data.senderEmail = senderEmail;
  if (senderName) data.senderName = senderName;
  if (secure !== undefined) data.secure = !!secure;

  // Ensure the row exists first (lazy-create), then apply the update.
  await getGlobalSmtpConfig();
  const updated = await prisma.platformSmtpConfig.update({ where: { id: 'global' }, data });

  logger.info({ provider: updated.provider, host: updated.host }, 'Updated Global Platform Outbound SMTP Configuration');
  const { passwordEnc, ...safeConfig } = updated;
  res.json({ ok: true, config: safeConfig });
});

// 2. Test Connection Handshake to Global SMTP Host
smtpRouter.post('/smtp/verify', requireDev, async (req: AuthedRequest, res) => {
  const { host, port, user, pass, secure } = req.body;

  if (host && (await isSsrfTargetAsync(host))) {
    return res.status(400).json({ error: 'Verification target host is not allowed (SSRF protection)' });
  }

  const globalConfig = await getGlobalSmtpConfig();
  const targetHost = host || globalConfig.host;
  const targetPort = port ? Number(port) : globalConfig.port;
  const targetUser = user || globalConfig.user;
  const targetPass = pass || decryptSecret(globalConfig.passwordEnc, env.secretsEncryptionKey);

  const result = await verifySmtpConnection({
    host: targetHost,
    port: targetPort,
    user: targetUser,
    pass: targetPass,
    secure: secure !== undefined ? secure : globalConfig.secure,
  });

  res.json(result);
});

/**
 * 2b. Verify DNS Records (MX, SPF, DKIM, DMARC) for a custom domain.
 */
smtpRouter.post('/smtp/verify-dns', async (req: AuthedRequest, res) => {
  const { domain } = req.body;
  if (!domain || typeof domain !== 'string' || !domain.includes('.')) {
    return res.status(400).json({ error: 'Valid domain is required' });
  }

  const cleanDomain = domain.toLowerCase().trim();
  const serverIp = getServerIp();
  const rootHost = `mail.${env.rootDomain}`;

  try {
    const dnsPromises = dns.promises;

    // MX check
    let mxVerified = false;
    let mxRecords: string[] = [];
    try {
      const mx = await dnsPromises.resolveMx(cleanDomain);
      mxRecords = mx.map((r) => `${r.priority} ${r.exchange}`);
      mxVerified = mx.some((r) => r.exchange.toLowerCase().includes(env.rootDomain) || r.exchange.toLowerCase().includes(cleanDomain));
    } catch {
      mxVerified = false;
    }

    // TXT/SPF check
    let spfVerified = false;
    let txtRecords: string[] = [];
    try {
      const txt = await dnsPromises.resolveTxt(cleanDomain);
      txtRecords = txt.map((t) => t.join(''));
      spfVerified = txtRecords.some((t) => t.includes('v=spf1'));
    } catch {
      spfVerified = false;
    }

    // DMARC check
    let dmarcVerified = false;
    try {
      const dmarcTxt = await dnsPromises.resolveTxt(`_dmarc.${cleanDomain}`);
      dmarcVerified = dmarcTxt.some((t) => t.join('').includes('v=DMARC1'));
    } catch {
      dmarcVerified = false;
    }

    res.json({
      domain: cleanDomain,
      serverIp,
      serverHost: rootHost,
      verification: {
        mx: mxVerified,
        spf: spfVerified,
        dmarc: dmarcVerified,
        allVerified: mxVerified && spfVerified,
      },
      records: {
        mxRecords,
        txtRecords,
      },
      expectedDns: [
        { type: 'MX', name: '@', value: `${rootHost}`, priority: 10, status: mxVerified ? 'verified' : 'pending' },
        { type: 'TXT (SPF)', name: '@', value: buildSpfRecord(env.rootDomain), status: spfVerified ? 'verified' : 'pending' },
        { type: 'TXT (DKIM)', name: 'default._domainkey', value: `v=DKIM1; k=rsa; p=<managed by mail server>`, status: 'active' },
        { type: 'TXT (DMARC)', name: '_dmarc', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${cleanDomain}`, status: dmarcVerified ? 'verified' : 'pending' },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'DNS Verification Failed' });
  }
});

// 3. Send General Outbound Email (Platform Outbound Relay — Dev/Admin Only)
const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().optional(),
});

smtpRouter.post('/smtp/send', requireDev, async (req: AuthedRequest, res) => {
  const parsed = sendEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { to, subject, html, text } = parsed.data;

  try {
    const globalConfig = await getGlobalSmtpConfig();
    const sendResult = await sendSmtpEmail(
      {
        host: globalConfig.host,
        port: globalConfig.port,
        user: globalConfig.user,
        pass: decryptSecret(globalConfig.passwordEnc, env.secretsEncryptionKey),
        secure: globalConfig.secure,
      },
      {
        from: `"${globalConfig.senderName}" <${globalConfig.senderEmail}>`,
        to,
        subject,
        html,
        text,
      }
    );

    logger.info({ recipient: to, subject, messageId: sendResult.messageId }, 'Dispatched outbound email via SMTP');
    res.json({ ok: true, messageId: sendResult.messageId, response: sendResult.response, recipient: to });
  } catch (err: any) {
    logger.error({ err, recipient: to }, 'Failed to send outbound email via SMTP');
    res.status(500).json({ error: err.message || 'SMTP Dispatch Failed' });
  }
});

// 4. Postal SMTP Account Management (Dev-only manual creation)
smtpRouter.post('/smtp-accounts', requireDev, async (req: AuthedRequest, res) => {
  const parsed = createSmtpAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { smtpPassword, planTier, domain: inputDomain, customAliases, allowedAdminIds, isInternal, billingModel, storageQuotaMb, dailySendLimit, ...rest } = parsed.data;
  const targetUser = await prisma.user.findUnique({ where: { id: rest.userId } });

  const domain = inputDomain || (targetUser?.role === 'admin' || targetUser?.role === 'dev' || isInternal ? env.rootDomain : 'clientdomain.com');

  // Enforce Domain Routing Check (Dev/Internal can use root domain)
  if (!isInternal && targetUser?.role === 'customer' && (domain.toLowerCase() === env.rootDomain.toLowerCase() || domain.toLowerCase().endsWith(`.${env.rootDomain.toLowerCase()}`))) {
    const domainCheck = validateDomainForUser(targetUser?.role || 'customer', domain, env.rootDomain);
    if (!domainCheck.valid) {
      return res.status(400).json({ error: domainCheck.error });
    }
  }

  const credentialRef = encryptSecret(smtpPassword, env.secretsEncryptionKey);
  const tier = SMTP_PLAN_TIERS[planTier] || SMTP_PLAN_TIERS.starter;
  const aliases = customAliases || generateDefaultAliases(domain, tier.maxAliases);
  const expiresAt =
    isInternal || billingModel === 'permanent_free'
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const account = await prisma.smtpAccount.create({
    data: {
      ...rest,
      credentialRef,
      customDomain: domain,
      aliases,
      planTier: tier.id,
      maxAliases: isInternal ? 100 : tier.maxAliases,
      storageQuotaMb: isInternal ? 999999 : (storageQuotaMb || tier.storageLimitGb * 1024),
      dailySendLimit: isInternal ? 999999 : (dailySendLimit || tier.dailyQuota),
      allowedAdminIds: allowedAdminIds || [],
      expiresAt,
      isSuspended: false,
      isInternal: !!isInternal,
      billingModel: isInternal ? 'permanent_free' : (billingModel || 'permanent_free'),
    },
    include: { user: true },
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'smtp.create', target: account.id },
  });

  // Automatically dispatch Release Email to client
  void sendSmtpReleaseEmail({
    clientEmail: account.user.email,
    clientName: account.user.displayName || account.user.email,
    planName: tier.name,
    tier,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpUsername: account.smtpUsername,
    smtpPassword,
    webmailUrl: account.webmailUrl || `https://mail.${env.rootDomain}`,
    domain,
    aliases,
  });

  res.status(201).json({
    account: {
      ...omitCredentialRef(account),
      domain,
      planTier: tier.id,
      planName: tier.name,
      storageLimitGb: tier.storageLimitGb,
      dailyQuota: tier.dailyQuota,
      maxAliases: tier.maxAliases,
      aliases,
    },
  });
});

smtpRouter.get('/smtp-accounts', async (req: AuthedRequest, res) => {
  const where = await ownedResourceWhere(req);
  const accounts = await prisma.smtpAccount.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, email: true, displayName: true, role: true } } },
  });

  const enriched = accounts.map((acc: any) => {
    const isStaff = acc.user?.role === 'admin' || acc.user?.role === 'dev';
    const domain = acc.customDomain || (isStaff ? env.rootDomain : 'clientdomain.com');
    const tier = SMTP_PLAN_TIERS[acc.planTier || 'pro'];
    const aliases = (acc.aliases && acc.aliases.length > 0) ? acc.aliases : generateDefaultAliases(domain, tier.maxAliases);

    const serverIp = getServerIp();
    return {
      ...omitCredentialRef(acc),
      domain,
      serverIp,
      planTier: tier.id,
      planName: tier.name,
      storageLimitGb: tier.storageLimitGb,
      dailyQuota: tier.dailyQuota,
      maxAliases: tier.maxAliases,
      aliases,
      expectedDns: [
        { type: 'MX', name: '@', value: `mail.${env.rootDomain}`, priority: 10 },
        { type: 'TXT (SPF)', name: '@', value: buildSpfRecord(env.rootDomain) },
        { type: 'TXT (DKIM)', name: 'default._domainkey', value: `v=DKIM1; k=rsa; p=<managed by mail server; see account setup>` },
        { type: 'TXT (DMARC)', name: '_dmarc', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}` },
      ],
    };
  });

  res.json({ accounts: enriched });
});

smtpRouter.get('/smtp-accounts/:id/reveal-password', async (req: AuthedRequest, res) => {
  const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
  if (!(await verifyResourceOwnershipAsync(account.userId, req, res))) {
    return;
  }

  try {
    const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);

    if (isStaff && account.userId !== req.user!.id) {
      await prisma.auditLog.create({
        data: { adminId: req.user!.id, action: 'smtp.reveal_password', target: account.id },
      });
    }

    res.json({ password });
  } catch (err: any) {
    logger.error({ accountId: account.id, err }, 'Failed to decrypt SMTP password');
    res.status(500).json({ error: 'Failed to decrypt password' });
  }
});

// 5. Self-Service Password Change
smtpRouter.patch('/smtp-accounts/:id/password', async (req: AuthedRequest, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  if (!(await verifyResourceOwnershipAsync(account.userId, req, res))) {
    return;
  }

  const credentialRef = encryptSecret(newPassword, env.secretsEncryptionKey);
  await prisma.smtpAccount.update({
    where: { id: account.id },
    data: { credentialRef },
  });

  res.json({ ok: true, message: 'SMTP Password updated successfully' });
});

// 6. Custom Domain & Alias Management Endpoints
smtpRouter.patch('/smtp-accounts/:id/domain', async (req: AuthedRequest, res) => {
  const { domain } = req.body;
  if (!domain || !domain.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid domain name (e.g. mycompany.com)' });
  }

  const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  if (!(await verifyResourceOwnershipAsync(account.userId, req, res))) {
    return;
  }

  // Enforce Domain Routing Validation
  const domainCheck = validateDomainForUser(req.user!.role, domain, env.rootDomain);
  if (!domainCheck.valid) {
    return res.status(400).json({ error: domainCheck.error });
  }

  const currentDomain = account.customDomain || 'clientdomain.com';
  const newDomain = domain.toLowerCase().trim();
  // Update domain suffixes for existing aliases
  const newAliases = account.aliases.map((a: string) => `${a.split('@')[0]}@${newDomain}`);

  const updated = await prisma.smtpAccount.update({
    where: { id: account.id },
    data: { customDomain: newDomain, aliases: newAliases },
  });

  res.json({ ok: true, domain: updated.customDomain, aliases: updated.aliases });
});

smtpRouter.post('/smtp-accounts/:id/aliases', async (req: AuthedRequest, res) => {
  const { prefix } = req.body;
  if (!prefix || !/^[a-zA-Z0-9._-]+$/.test(prefix)) {
    return res.status(400).json({ error: 'Invalid alias prefix name' });
  }

  const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  if (!(await verifyResourceOwnershipAsync(account.userId, req, res))) {
    return;
  }

  const domain = account.customDomain || (req.user!.role === 'admin' || req.user!.role === 'dev' ? env.rootDomain : 'clientdomain.com');
  const tier = SMTP_PLAN_TIERS[account.planTier || 'pro'];
  if (account.aliases.length >= tier.maxAliases) {
    return res.status(400).json({
      error: `Alias limit reached for ${tier.name}. Maximum allowed: ${tier.maxAliases} aliases.`,
    });
  }

  const newAlias = `${prefix.toLowerCase()}@${domain}`;
  if (account.aliases.includes(newAlias)) {
    return res.status(400).json({ error: 'Alias already exists' });
  }

  const updated = await prisma.smtpAccount.update({
    where: { id: account.id },
    data: { customDomain: domain, aliases: [...account.aliases, newAlias] },
  });

  res.json({ ok: true, aliases: updated.aliases, count: updated.aliases.length, max: tier.maxAliases });
});

smtpRouter.delete('/smtp-accounts/:id/aliases/:prefix', async (req: AuthedRequest, res) => {
  const { prefix } = req.params;
  const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  if (!(await verifyResourceOwnershipAsync(account.userId, req, res))) {
    return;
  }

  const filteredAliases = account.aliases.filter((a: string) => a.split('@')[0] !== prefix.toLowerCase());
  const updated = await prisma.smtpAccount.update({
    where: { id: account.id },
    data: { aliases: filteredAliases },
  });

  res.json({ ok: true, aliases: updated.aliases });
});

function omitCredentialRef<T extends { credentialRef: string }>(account: T) {
  const { credentialRef, ...rest } = account;
  return rest;
}
