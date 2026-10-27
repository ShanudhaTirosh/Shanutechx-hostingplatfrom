import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdminOrDev, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { env } from '../env';
import { encryptSecret, decryptSecret } from '../lib/secretsVault';
import { sendSmtpReleaseEmail, getTierFromPlanName, validateDomainForUser } from '../lib/smtpProvisioner';
import { sendSmtpEmail } from '../lib/smtpDispatcher';
import { wildduckClient } from '../lib/wildduckClient';
import dns from 'dns';
import { getServerIp, buildSpfRecord } from '../lib/mailAuth';
import { getWebmailClusterConfig, updateWebmailClusterConfig, verifyS3StorageConnection } from '../lib/webmailS3Storage';
import crypto from 'crypto';
import { isSsrfTargetAsync } from './smtp';
import { getUserEmailPlanQuotas, validateMailboxCreationQuota } from '../lib/emailPlanQuotas';
import {
  canAccessMailbox,
  getUserMailboxPermissions,
  normalizeMailboxAcl,
  normalizeMailboxProfile,
  updateMailboxAcl,
  revokeMailboxAcl,
  MailboxPermission,
} from '../lib/mailboxAcl';
import {
  avatarUploadMiddleware,
  validateImageMagicBytes,
  saveMailboxAvatar,
  deleteLocalAvatarIfExists,
} from '../lib/avatarUpload';
import { useForOwnRoutes } from '../lib/routerGuard';

export const emailRouter = Router();

// All endpoints require authentication
useForOwnRoutes(emailRouter, requireAuth);

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
    } else if (req.user!.role === 'admin' || req.user!.role === 'support') {
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
      const isCancelled = orderStatus ? (orderStatus === 'cancelled' || orderStatus === 'failed') : false;
      const isSuspended = acc.isSuspended || isExpired || isCancelled;
      const status = acc.isSuspended
        ? 'suspended'
        : isExpired
        ? 'expired'
        : isCancelled
        ? 'cancelled'
        : orderStatus === 'pending'
        ? 'pending'
        : 'active';

      const fullEmail = acc.smtpUsername.includes('@') ? acc.smtpUsername : `${acc.smtpUsername}@${domain}`;
      const username = acc.smtpUsername.includes('@') ? acc.smtpUsername.split('@')[0] : acc.smtpUsername;

      return {
        id: acc.id,
        email: fullEmail,
        username,
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
        profile: normalizeMailboxProfile(acc.profileJson, acc.user.displayName, acc.smtpUsername),
        mailboxAcl: normalizeMailboxAcl(acc.mailboxAcl),
        myPermissions: Array.from(getUserMailboxPermissions(acc, req.user!.id, req.user!.role)),
        isInternal: Boolean(acc.isInternal),
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
    const isDev = req.user!.role === 'dev';
    if (!isOwner && !isDev) {
      const perms = getUserMailboxPermissions(account, req.user!.id, req.user!.role);
      const isExplicitlyDelegated = (account.allowedAdminIds || []).includes(req.user!.id) || perms.size > 0;
      if (!isExplicitlyDelegated) {
        if (req.user!.role !== 'admin' && req.user!.role !== 'support') return res.status(403).json({ error: 'Access denied' });
        const owner = await prisma.user.findUnique({ where: { id: account.userId }, select: { assignedAdminId: true } });
        if (owner?.assignedAdminId !== req.user!.id) {
          return res.status(403).json({ error: 'Access denied: You are not assigned to this account' });
        }
      }
    }

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
 * GET /api/email/plan-quotas
 * Returns customer's plan name, max storage, allocated storage, remaining storage,
 * mailbox slots, and custom domain allowances.
 */
emailRouter.get('/email/plan-quotas', async (req: AuthedRequest, res) => {
  try {
    const quotas = await getUserEmailPlanQuotas(req.user!.id, req.user!.role);
    res.json(quotas);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch email plan quotas');
    res.status(500).json({ error: 'Failed to fetch plan quotas' });
  }
});

/**
 * GET /api/email/mailboxes/:id/website-connect
 * Returns per-mailbox SMTP & IMAP credentials with copy-paste integration configs
 * for WordPress WP Mail SMTP, Node.js/Nodemailer, Next.js, Laravel .env, Python, PHP, and Resend-style REST API.
 */
emailRouter.get('/email/mailboxes/:id/website-connect', async (req: AuthedRequest, res) => {
  try {
    const account = await prisma.smtpAccount.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    const isDev = req.user!.role === 'dev';
    if (!isOwner && !isDev) {
      if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
      const isExplicitlyDelegated = (account.allowedAdminIds || []).includes(req.user!.id);
      if (!isExplicitlyDelegated) {
        const owner = await prisma.user.findUnique({ where: { id: account.userId }, select: { assignedAdminId: true } });
        if (owner?.assignedAdminId !== req.user!.id) {
          return res.status(403).json({ error: 'Access denied: You are not assigned to this account' });
        }
      }
    }

    const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
    const domain = account.customDomain || account.smtpHost.replace(/^mail\./, '');
    const fullEmail = account.smtpUsername.includes('@')
      ? account.smtpUsername
      : `${account.smtpUsername}@${domain}`;
    const imapHost = account.smtpHost;
    const appDisplayName = account.user?.displayName || 'Website Application';
    const apiBaseUrl = process.env.NODE_ENV === 'production' ? `https://api.${env.rootDomain}` : 'http://localhost:4000';

    const credentials = {
      mailboxId: account.id,
      email: fullEmail,
      username: fullEmail,
      fullUsername: fullEmail,
      password,
      domain,
      smtp: {
        host: account.smtpHost,
        portTls: 587,
        portSsl: 465,
        encryptionTls: 'STARTTLS',
        encryptionSsl: 'SSL/TLS',
        authentication: true,
      },
      imap: {
        host: imapHost,
        port: 993,
        encryption: 'SSL/TLS',
      },
    };

    const wordpressConfig = {
      fromEmail: fullEmail,
      fromName: appDisplayName,
      mailer: 'Other SMTP',
      smtpHost: account.smtpHost,
      encryption: 'TLS',
      smtpPort: 587,
      autoTls: 'On',
      authentication: 'On',
      smtpUsername: fullEmail,
      smtpPassword: password,
      instructions: [
        '1. In your WordPress Admin panel, install and activate the "WP Mail SMTP" or "FluentSMTP" plugin.',
        '2. Select "Other SMTP" as your mailer.',
        `3. Set From Email to "${fullEmail}".`,
        `4. Set SMTP Host to "${account.smtpHost}" and SMTP Port to 587 (TLS).`,
        `5. Enable "Authentication" and enter Username "${fullEmail}" with your password.`,
        '6. Click "Save Settings" and send a test email via the plugin tab to verify.',
      ],
    };

    const laravelEnv = `# ShanuTechX Business Email Configuration (.env)
MAIL_MAILER=smtp
MAIL_HOST=${account.smtpHost}
MAIL_PORT=587
MAIL_USERNAME=${fullEmail}
MAIL_PASSWORD="${password}"
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="${fullEmail}"
MAIL_FROM_NAME="\${APP_NAME}"`;

    const nodejsSnippet = `import nodemailer from 'nodemailer';

// Create reusable transporter object using ShanuTechX SMTP
export const emailTransporter = nodemailer.createTransport({
  host: '${account.smtpHost}',
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: '${fullEmail}',
    pass: '${password}',
  },
});

export async function sendWebsiteNotification({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) {
  const info = await emailTransporter.sendMail({
    from: '"${appDisplayName}" <${fullEmail}>',
    to,
    subject,
    html: html || text,
    text,
  });
  console.log('Email delivered successfully:', info.messageId);
  return info;
}`;

    const nextjsSnippet = `// app/api/send-email/route.ts (Next.js 14 App Router)
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: '${account.smtpHost}',
  port: 587,
  secure: false,
  auth: {
    user: '${fullEmail}',
    pass: '${password}',
  },
});

export async function POST(req: Request) {
  try {
    const { to, subject, html } = await req.json();

    const info = await transporter.sendMail({
      from: '"${appDisplayName}" <${fullEmail}>',
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}`;

    const phpSnippet = `<?php
use PHPMailer\\PHPMailer\\PHPMailer;
use PHPMailer\\PHPMailer\\Exception;

require 'vendor/autoload.php';

$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->isSMTP();
    $mail->Host       = '${account.smtpHost}';
    $mail->SMTPAuth   = true;
    $mail->Username   = '${fullEmail}';
    $mail->Password   = '${password}';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    // Recipients
    $mail->setFrom('${fullEmail}', '${appDisplayName}');
    $mail->addAddress('customer@example.com');

    // Content
    $mail->isHTML(true);
    $mail->Subject = 'New Order Notification';
    $mail->Body    = '<h1>Hello!</h1><p>Your order has been received.</p>';

    $mail->send();
    echo 'Message has been sent';
} catch (Exception $e) {
    echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
}`;

    const pythonSnippet = `import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_transactional_email(recipient, subject, html_content):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = '"${appDisplayName}" <${fullEmail}>'
    msg['To'] = recipient
    msg.attach(MIMEText(html_content, 'html'))

    with smtplib.SMTP('${account.smtpHost}', 587) as server:
        server.starttls()
        server.login('${fullEmail}', '${password}')
        server.sendmail('${fullEmail}', [recipient], msg.as_string())
    print("Email delivered successfully!")`;

    const resendApiSnippet = {
      apiUrl: `${apiBaseUrl}/api/v1/emails`,
      curl: `curl -X POST ${apiBaseUrl}/api/v1/emails \\
  -H "Authorization: Bearer YOUR_SHANUTECHX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${appDisplayName} <${fullEmail}>",
    "to": "customer@example.com",
    "subject": "Order Confirmation",
    "html": "<strong>Thank you for your order!</strong>"
  }'`,
      fetchJs: `// Resend-style transactional API call
const response = await fetch('${apiBaseUrl}/api/v1/emails', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_SHANUTECHX_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: '${appDisplayName} <${fullEmail}>',
    to: 'customer@example.com',
    subject: 'Welcome to our platform!',
    html: '<p>Your account is ready.</p>',
  }),
});
const data = await response.json();
console.log('Sent email ID:', data.id);`,
    };

    res.json({
      credentials,
      integrations: {
        wordpress: wordpressConfig,
        laravel: laravelEnv,
        nodejs: nodejsSnippet,
        nextjs: nextjsSnippet,
        php: phpSnippet,
        python: pythonSnippet,
        resendApi: resendApiSnippet,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to generate website connection configs');
    res.status(500).json({ error: err.message || 'Failed to generate connection configs' });
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
  if (req.user!.role !== 'dev' && req.user!.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied: Only dev or admin administrators can manually provision new email user accounts.',
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
 * Customer mailbox creation — hardened with plan subscription limits and customizable storage quota.
 */
const createMailboxSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  storageQuotaMb: z.number().int().min(256).max(1048576).optional().default(1024),
  dailySendLimit: z.number().int().positive().optional(),
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

  const { email, password, storageQuotaMb } = parse.data;
  const username = email.split('@')[0].replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const domainStr = (email.includes('@') ? email.split('@')[1] : env.rootDomain).toLowerCase().trim();

  // Enforce customer domain rule: Customers must use their own verified custom domain.
  const domainCheck = validateDomainForUser(role, domainStr, env.rootDomain);
  if (!domainCheck.valid) {
    return res.status(403).json({ error: domainCheck.error });
  }

  // Hardened Plan Subscription & Storage Quota validation
  const quotaValidation = await validateMailboxCreationQuota(req.user!.id, role, storageQuotaMb, domainStr);
  if (!quotaValidation.allowed) {
    return res.status(quotaValidation.status || 403).json({
      error: quotaValidation.error,
      code: quotaValidation.code,
      quotas: quotaValidation.quotas,
      purchaseRequired: quotaValidation.code === 'PURCHASE_REQUIRED',
    });
  }

  const finalSendLimit = parse.data.dailySendLimit || quotaValidation.quotas.dailySendLimit;
  const smtpHost = `mail.${env.rootDomain}`;
  const credentialRef = encryptSecret(password, env.secretsEncryptionKey);
  const webmailUrl = process.env.NODE_ENV === 'production' ? `https://mail.${env.rootDomain}` : 'http://localhost:3001/webmail';
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const fullEmail = `${username}@${domainStr}`;

  let wildduckUserId: string | undefined;
  let wildduckAddressId: string | undefined;

  try {
    if (env.wildduckApiKey && domainStr) {
      await wildduckClient.createDomain(domainStr).catch(() => null);
      await wildduckClient.getOrCreateDkim(domainStr, 'wildduck').catch(() => null);
    }

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
        smtpUsername: fullEmail,
        credentialRef,
        webmailUrl,
        storageQuotaMb,
        dailySendLimit: finalSendLimit,
        maxAliases: quotaValidation.quotas.maxAliases,
        customDomain: domainStr === env.rootDomain ? null : domainStr,
        expiresAt,
        isSuspended: false,
        storageUsedMb: 0,
        dailySendCount: 0,
      },
    });

    logger.info({ userId: req.user!.id, email, storageQuotaMb }, 'Mailbox account created and quota allocated');

    res.status(201).json({
      mailbox: {
        id: newAccount.id,
        email,
        username,
        domain: domainStr,
        smtpHost,
        smtpPort: 587,
        sslPort: 465,
        storageUsedMb: 0,
        storageQuotaMb,
        dailySendCount: 0,
        dailySendLimit: finalSendLimit,
        status: 'active',
        webmailUrl,
        createdAt: newAccount.createdAt.toISOString(),
      },
      message: `Mailbox account ${email} provisioned successfully with ${storageQuotaMb} MB quota.`,
    });
  } catch (err: any) {
    logger.error({ err, email }, 'Failed to create customer mailbox account');
    res.status(500).json({ error: err.message || 'Failed to create mailbox account' });
  }
});

/**
 * PATCH /api/email/mailboxes/:id/quota
 * Resize mailbox storage quota within user plan's remaining storage pool.
 */
const resizeQuotaSchema = z.object({
  storageQuotaMb: z.number().int().min(256).max(1048576),
});

emailRouter.patch('/email/mailboxes/:id/quota', async (req: AuthedRequest, res) => {
  const parse = resizeQuotaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid storage quota value', details: parse.error.format() });

  const { storageQuotaMb } = parse.data;
  const userId = req.user!.id;
  const role = req.user!.role;

  try {
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    if (role !== 'dev' && account.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this mailbox' });
    }

    if (role !== 'dev') {
      const quotas = await getUserEmailPlanQuotas(userId, role);
      const quotaDifference = storageQuotaMb - account.storageQuotaMb;
      if (quotaDifference > quotas.remainingStorageMb) {
        return res.status(403).json({
          error: `Cannot increase quota by ${quotaDifference} MB. Only ${quotas.remainingStorageMb} MB storage remaining on your plan pool.`,
          remainingStorageMb: quotas.remainingStorageMb,
          maxStorageMb: quotas.maxStorageMb,
        });
      }
    }

    // Update in WildDuck cluster
    if (account.wildduckUserId) {
      await wildduckClient.updateUser(account.wildduckUserId, {
        quotaGb: Math.max(1, Math.ceil(storageQuotaMb / 1024)),
      }).catch((e) => logger.warn({ err: e.message }, 'WildDuck quota update warning'));
    }

    const updated = await prisma.smtpAccount.update({
      where: { id: account.id },
      data: { storageQuotaMb },
    });

    res.json({
      success: true,
      mailboxId: updated.id,
      storageQuotaMb: updated.storageQuotaMb,
      message: `Storage quota updated to ${updated.storageQuotaMb} MB.`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to resize mailbox quota');
    res.status(500).json({ error: err.message || 'Failed to update storage quota' });
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
      try {
        await wildduckClient.deleteUser(account.wildduckUserId);
      } catch (err: any) {
        logger.error({ err, wildduckUserId: account.wildduckUserId }, 'WildDuck mail user deletion failed — aborting mailbox removal to prevent orphan');
        return res.status(502).json({ error: 'Failed to deprovision mailbox on mail server. Please retry.' });
      }
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

    const months = Math.min(18, Math.max(1, Number(req.body?.months) || 1));

    if (!isStaff && !isInternal) {
      const pricePerMonthLkr = 1500;
      const totalLkr = pricePerMonthLkr * months;
      const renewalOrder = await prisma.order.create({
        data: {
          userId: account.userId,
          status: 'awaiting_payment',
          total: Math.round(totalLkr / 300),
          totalLkr,
          currency: 'LKR',
          items: {
            create: [
              {
                quantity: 1,
                priceLkr: totalLkr,
                configJson: {
                  type: 'mailbox_renewal',
                  mailboxId: account.id,
                  username: account.smtpUsername,
                  months,
                },
              },
            ],
          },
        },
      });

      return res.json({
        ok: true,
        requiresPayment: true,
        orderId: renewalOrder.id,
        totalLkr,
        message: `Renewal order #${renewalOrder.id} generated for ${months} month(s). Please submit payment proof to activate renewal.`,
      });
    }

    const baseDate = account.expiresAt && account.expiresAt.getTime() > Date.now() ? account.expiresAt : new Date();
    const newExpiresAt = new Date(baseDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);
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
        target: `Renewed mailbox subscription for ${account.smtpUsername} for ${months} month(s) until ${newExpiresAt.toISOString()}`,
      },
    });

    res.json({
      ok: true,
      message: `Subscription renewed successfully for ${months} month(s).`,
      expiresAt: newExpiresAt.toISOString(),
      isSuspended: false,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to renew mailbox subscription');
    res.status(500).json({ error: err.message || 'Failed to renew subscription' });
  }
});

/**
 * GET /api/email/mailboxes/:id/access
 * Dev-only endpoint to inspect current ACL grants and list available Admin/Support staff.
 */
emailRouter.get('/email/mailboxes/:id/access', async (req: AuthedRequest, res) => {
  try {
    const isDev = req.user!.role === 'dev';
    const account: any = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    if (!isDev && !isOwner) {
      return res.status(403).json({ error: 'Only dev administrators or mailbox owners can view access lists.' });
    }

    const staffUsers = await prisma.user.findMany({
      where: { role: { in: ['admin', 'support'] } },
      select: { id: true, email: true, displayName: true, role: true, avatarUrl: true },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    res.json({
      ok: true,
      mailboxAcl: normalizeMailboxAcl(account.mailboxAcl),
      allowedAdminIds: account.allowedAdminIds || [],
      staffUsers,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get mailbox access list');
    res.status(500).json({ error: err.message || 'Failed to get mailbox access list' });
  }
});

/**
 * POST /api/email/mailboxes/:id/access
 * Dev-only endpoint to grant or update granular permissions ('read', 'write', 'manage')
 * to an admin or support staff member for a system mailbox (or any mailbox).
 */
const grantAccessSchema = z.object({
  userId: z.string().min(1),
  permissions: z.array(z.enum(['read', 'write', 'manage'])).min(1),
});

emailRouter.post('/email/mailboxes/:id/access', async (req: AuthedRequest, res) => {
  try {
    const isDev = req.user!.role === 'dev';
    if (!isDev) {
      return res.status(403).json({ error: 'Forbidden: Only dev administrators can configure staff access permissions.' });
    }

    const account: any = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const parse = grantAccessSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid permission payload', details: parse.error.format() });
    }

    const { userId: targetUserId, permissions } = parse.data;
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || (targetUser.role !== 'admin' && targetUser.role !== 'support')) {
      return res.status(400).json({ error: 'Target user must be an active admin or support staff member.' });
    }

    const syncResult = updateMailboxAcl(account.mailboxAcl, {
      userId: targetUser.id,
      userEmail: targetUser.email,
      userName: targetUser.displayName || undefined,
      role: targetUser.role as 'admin' | 'support',
      permissions,
      grantedBy: req.user!.email || req.user!.id,
    });

    await (prisma.smtpAccount as any).update({
      where: { id: account.id },
      data: {
        mailboxAcl: syncResult.mailboxAcl as any,
        allowedAdminIds: syncResult.allowedAdminIds,
      },
    });

    logger.info(
      { mailboxId: account.id, devUser: req.user!.email, targetUser: targetUser.email, permissions },
      'Dev granted staff access to mailbox'
    );

    res.json({
      ok: true,
      message: `Permissions updated for ${targetUser.email} on ${account.smtpUsername}`,
      mailboxAcl: syncResult.mailboxAcl,
      allowedAdminIds: syncResult.allowedAdminIds,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to grant mailbox access');
    res.status(500).json({ error: err.message || 'Failed to grant access' });
  }
});

/**
 * DELETE /api/email/mailboxes/:id/access/:userId
 * Dev-only endpoint to revoke a staff member's access to a mailbox.
 */
emailRouter.delete('/email/mailboxes/:id/access/:userId', async (req: AuthedRequest, res) => {
  try {
    const isDev = req.user!.role === 'dev';
    if (!isDev) {
      return res.status(403).json({ error: 'Forbidden: Only dev administrators can revoke staff access permissions.' });
    }

    const account: any = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const syncResult = revokeMailboxAcl(account.mailboxAcl, req.params.userId);

    await (prisma.smtpAccount as any).update({
      where: { id: account.id },
      data: {
        mailboxAcl: syncResult.mailboxAcl as any,
        allowedAdminIds: syncResult.allowedAdminIds,
      },
    });

    logger.info(
      { mailboxId: account.id, devUser: req.user!.email, revokedUserId: req.params.userId },
      'Dev revoked staff access from mailbox'
    );

    res.json({
      ok: true,
      message: 'Access revoked successfully',
      mailboxAcl: syncResult.mailboxAcl,
      allowedAdminIds: syncResult.allowedAdminIds,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to revoke mailbox access');
    res.status(500).json({ error: err.message || 'Failed to revoke access' });
  }
});

/**
 * PATCH /api/email/mailboxes/:id/access
 * Backward-compatible endpoint to grant or modify admin delegation access (allowedAdminIds).
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
 * GET /api/email/mailboxes/:id/profile
 * Get custom profile picture and info for a mailbox.
 */
emailRouter.get('/email/mailboxes/:id/profile', async (req: AuthedRequest, res) => {
  try {
    const account: any = await prisma.smtpAccount.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { displayName: true, email: true } } },
    });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const check = canAccessMailbox(account, req.user!.id, req.user!.role, 'read');
    if (!check.allowed) return res.status(403).json({ error: check.reason });

    const profile = normalizeMailboxProfile(account.profileJson, account.user?.displayName, account.smtpUsername);
    res.json({ ok: true, profile });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get mailbox profile');
    res.status(500).json({ error: err.message || 'Failed to get mailbox profile' });
  }
});

/**
 * PUT /api/email/mailboxes/:id/profile
 * Update profile picture (avatarUrl), display name, and contact details for a mailbox.
 * Allowed for mailbox owner, dev superuser, or staff with 'manage' permission.
 */
const updateProfileSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  displayName: z.string().max(100).nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  company: z.string().max(100).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
});

emailRouter.put('/email/mailboxes/:id/profile', async (req: AuthedRequest, res) => {
  try {
    const account: any = await prisma.smtpAccount.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { displayName: true, email: true } } },
    });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const check = canAccessMailbox(account, req.user!.id, req.user!.role, 'manage');
    if (!check.allowed) return res.status(403).json({ error: check.reason });

    const parse = updateProfileSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'Invalid profile data', details: parse.error.format() });

    const currentProfile = normalizeMailboxProfile(account.profileJson, account.user?.displayName, account.smtpUsername);
    const updatedProfileData = {
      avatarUrl: parse.data.avatarUrl !== undefined ? parse.data.avatarUrl : currentProfile.avatarUrl,
      displayName: parse.data.displayName !== undefined ? parse.data.displayName : currentProfile.displayName,
      jobTitle: parse.data.jobTitle !== undefined ? parse.data.jobTitle : currentProfile.jobTitle,
      company: parse.data.company !== undefined ? parse.data.company : currentProfile.company,
      phone: parse.data.phone !== undefined ? parse.data.phone : currentProfile.phone,
      bio: parse.data.bio !== undefined ? parse.data.bio : currentProfile.bio,
      website: parse.data.website !== undefined ? parse.data.website : currentProfile.website,
    };

    const updated: any = await (prisma.smtpAccount as any).update({
      where: { id: account.id },
      data: { profileJson: updatedProfileData },
    });

    res.json({
      ok: true,
      message: 'Mailbox profile updated successfully',
      profile: normalizeMailboxProfile(updated.profileJson, account.user?.displayName, account.smtpUsername),
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update mailbox profile');
    res.status(500).json({ error: err.message || 'Failed to update mailbox profile' });
  }
});

/**
 * POST /api/email/mailboxes/:id/avatar
 * Upload and securely inspect a mailbox profile picture avatar.
 * Enforces:
 * 1. Authorization: Only mailbox owner, dev user, or staff with 'manage' permission
 * 2. MIME type whitelist: image/jpeg, image/png, image/webp, image/gif
 * 3. Binary magic bytes header inspection
 * 4. Max file size: 5MB
 * 5. Cryptographic filename randomization & safe path storage
 * 6. Deletes previous uploaded avatar if any
 */
emailRouter.post('/email/mailboxes/:id/avatar', avatarUploadMiddleware, async (req: AuthedRequest, res) => {
  try {
    const account: any = await prisma.smtpAccount.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { displayName: true, email: true } } },
    });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const check = canAccessMailbox(account, req.user!.id, req.user!.role, 'manage');
    if (!check.allowed) return res.status(403).json({ error: check.reason });

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No avatar image file provided in upload' });
    }

    // Security Check: Magic Bytes Verification
    const validation = validateImageMagicBytes(req.file.buffer);
    if (!validation.valid || !validation.format) {
      return res.status(400).json({
        error: validation.error || 'Security verification failed: Corrupt or invalid image file.',
      });
    }

    // Delete old local avatar if previously set
    const currentProfile = normalizeMailboxProfile(account.profileJson, account.user?.displayName, account.smtpUsername);
    if (currentProfile.avatarUrl) {
      await deleteLocalAvatarIfExists(currentProfile.avatarUrl);
    }

    // Persist to disk with cryptographically randomized filename
    const { avatarUrl } = await saveMailboxAvatar(account.id, req.file.buffer);

    const updatedProfile = {
      ...currentProfile,
      avatarUrl,
    };

    const updated: any = await (prisma.smtpAccount as any).update({
      where: { id: account.id },
      data: { profileJson: updatedProfile },
    });

    logger.info(
      { mailboxId: account.id, user: req.user!.email, avatarUrl },
      'Secure mailbox profile picture uploaded successfully'
    );

    res.json({
      ok: true,
      message: 'Profile picture uploaded and verified successfully',
      avatarUrl,
      profile: normalizeMailboxProfile(updated.profileJson, account.user?.displayName, account.smtpUsername),
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to upload mailbox avatar');
    res.status(500).json({ error: err.message || 'Failed to upload profile picture' });
  }
});

/**
 * DELETE /api/email/mailboxes/:id/avatar
 * Remove profile picture avatar for a mailbox.
 */
emailRouter.delete('/email/mailboxes/:id/avatar', async (req: AuthedRequest, res) => {
  try {
    const account: any = await prisma.smtpAccount.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { displayName: true, email: true } } },
    });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const check = canAccessMailbox(account, req.user!.id, req.user!.role, 'manage');
    if (!check.allowed) return res.status(403).json({ error: check.reason });

    const currentProfile = normalizeMailboxProfile(account.profileJson, account.user?.displayName, account.smtpUsername);
    if (currentProfile.avatarUrl) {
      await deleteLocalAvatarIfExists(currentProfile.avatarUrl);
    }

    const updatedProfile = {
      ...currentProfile,
      avatarUrl: null,
    };

    const updated: any = await (prisma.smtpAccount as any).update({
      where: { id: account.id },
      data: { profileJson: updatedProfile },
    });

    res.json({
      ok: true,
      message: 'Profile picture removed successfully',
      profile: normalizeMailboxProfile(updated.profileJson, account.user?.displayName, account.smtpUsername),
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to remove mailbox avatar');
    res.status(500).json({ error: err.message || 'Failed to remove profile picture' });
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

    const account = await prisma.smtpAccount.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { displayName: true } } },
    });
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

    // Provision alias address on WildDuck mail server so it receives and sends mail
    if (account.wildduckUserId) {
      try {
        await wildduckClient.createAddress(
          account.wildduckUserId,
          newAlias,
          account.user?.displayName || undefined,
          account.mailHostId
        );
      } catch (wdErr: any) {
        logger.warn({ wdErr: wdErr.message, newAlias }, 'Failed to sync alias to WildDuck address');
      }
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

    // Remove alias address from WildDuck mail server
    if (account.wildduckUserId) {
      try {
        const addresses = await wildduckClient.listAddresses(account.wildduckUserId, account.mailHostId);
        const targetAddr = addresses.find((a) => a.address.toLowerCase().startsWith(`${prefix.toLowerCase()}@`));
        if (targetAddr) {
          await wildduckClient.deleteAddress(account.wildduckUserId, targetAddr.id, account.mailHostId);
        }
      } catch (wdErr: any) {
        logger.warn({ wdErr: wdErr.message, prefix }, 'Failed to remove alias from WildDuck address');
      }
    }

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
 * PATCH /api/email/mailboxes/:id/password
 * Customer self-service (or staff) password update for a specific mailbox.
 */
const mailboxPasswordChangeSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

emailRouter.patch('/email/mailboxes/:id/password', async (req: AuthedRequest, res) => {
  const parse = mailboxPasswordChangeSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0]?.message || 'Invalid password format' });
  }

  const { newPassword } = parse.data;

  try {
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    const isOwner = account.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

    const newCredentialRef = encryptSecret(newPassword, env.secretsEncryptionKey);
    await prisma.smtpAccount.update({
      where: { id: account.id },
      data: { credentialRef: newCredentialRef },
    });

    if (account.wildduckUserId) {
      await wildduckClient.updateUser(account.wildduckUserId, { password: newPassword }, account.mailHostId).catch((err: any) => {
        logger.warn({ err: err.message }, 'Failed to sync new password to WildDuck');
      });
    }

    res.json({ ok: true, message: 'Mailbox password updated successfully.' });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update mailbox password');
    res.status(500).json({ error: err.message || 'Failed to update mailbox password' });
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
      select: { id: true, userId: true, smtpHost: true, customDomain: true, createdAt: true },
    });

    const domainSet = new Set<string>();
    const domainList: any[] = [];

    for (const acc of accounts) {
      const domain = acc.customDomain || acc.smtpHost.replace(/^mail\./, '');
      if (!domainSet.has(domain)) {
        domainSet.add(domain);
        let dkimRecord = `v=DKIM1; k=rsa; p=<managed by mail server>`;
        if (env.wildduckApiKey) {
          try {
            const dkim = await wildduckClient.getOrCreateDkim(domain, 'wildduck');
            if (dkim?.publicKey) dkimRecord = dkim.txtRecord;
          } catch (_) {}
        }
        domainList.push({
          id: `smtp-${acc.id}`,
          domain,
          status: 'verified',
          mxRecord: `10 ${mailHost}`,
          spfRecord: buildSpfRecord(env.rootDomain),
          dkimRecord,
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
          let dkimRecord = `v=DKIM1; k=rsa; p=<managed by mail server>`;
          if (env.wildduckApiKey) {
            try {
              const dkim = await wildduckClient.getOrCreateDkim(record.domain, 'wildduck');
              if (dkim?.publicKey) dkimRecord = dkim.txtRecord;
            } catch (_) {}
          }
          domainList.push({
            id: record.id,
            domain: record.domain,
            status: record.status,
            mxRecord: `10 ${mailHost}`,
            spfRecord: buildSpfRecord(env.rootDomain),
            dkimRecord,
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

  if (env.wildduckApiKey) {
    try {
      await wildduckClient.createDomain(domainStr);
      await wildduckClient.getOrCreateDkim(domainStr, 'wildduck');
    } catch (err: any) {
      logger.warn({ domain: domainStr, err: err.message }, 'WildDuck domain/DKIM registration during domain add warning');
    }
  }

  let dkimRecord = `v=DKIM1; k=rsa; p=<managed by mail server>`;
  if (env.wildduckApiKey) {
    try {
      const dkim = await wildduckClient.getOrCreateDkim(domainStr, 'wildduck');
      if (dkim?.publicKey) dkimRecord = dkim.txtRecord;
    } catch (_) {}
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
      dkimRecord,
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
    let dkimVerified = false;

    try {
      const mx = await dns.promises.resolveMx(domainStr!);
      mxVerified = mx.some((r) => r.exchange.toLowerCase().includes(env.rootDomain) || r.exchange.toLowerCase().includes(domainStr!.toLowerCase()));
    } catch {}

    try {
      const txt = await dns.promises.resolveTxt(domainStr!);
      spfVerified = txt.some((t) => t.join('').includes('v=spf1'));
    } catch {}

    try {
      const dkimTxt = await dns.promises.resolveTxt(`wildduck._domainkey.${domainStr!}`);
      dkimVerified = dkimTxt.some((t) => t.join('').includes('v=DKIM1') || t.join('').includes('p='));
    } catch {
      try {
        const dkimTxt2 = await dns.promises.resolveTxt(`default._domainkey.${domainStr!}`);
        dkimVerified = dkimTxt2.some((t) => t.join('').includes('v=DKIM1') || t.join('').includes('p='));
      } catch {
        try {
          const dkimTxt3 = await dns.promises.resolveTxt(`shanutechx._domainkey.${domainStr!}`);
          dkimVerified = dkimTxt3.some((t) => t.join('').includes('v=DKIM1') || t.join('').includes('p='));
        } catch {}
      }
    }

    let dmarcVerified = false;
    try {
      const dmarcTxt = await dns.promises.resolveTxt(`_dmarc.${domainStr!}`);
      dmarcVerified = dmarcTxt.some((t) => t.join('').includes('v=DMARC1'));
    } catch {}

    const isVerified = mxVerified && (spfVerified || dkimVerified);

    if (isVerified) {
      await prisma.emailDomain.update({ where: { id: req.params.id }, data: { status: 'verified' } });
    }

    res.json({
      domain: domainStr,
      verified: isVerified,
      mxVerified,
      spfVerified,
      dkimVerified,
      dmarcVerified,
      message: isVerified
        ? 'Domain DNS records verified successfully!'
        : `DNS verification pending. MX: ${mxVerified ? '✓' : '✗'}, SPF: ${spfVerified ? '✓' : '✗'}, DKIM: ${dkimVerified ? '✓' : '✗'}, DMARC: ${dmarcVerified ? '✓' : '✗'}`,
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
  smtpAccountId: z.string().optional(),
});

emailRouter.post('/email/send', async (req: AuthedRequest, res) => {
  const parse = sendEmailSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid email data', details: parse.error.format() });

  const { from, to, subject, body, smtpAccountId } = parse.data;
  const isDev = req.user!.role === 'dev';

  let smtpAccount: any = null;
  if (smtpAccountId) {
    smtpAccount = await prisma.smtpAccount.findUnique({ where: { id: smtpAccountId } });
  } else {
    const fromUsername = from.split('@')[0];
    smtpAccount = await prisma.smtpAccount.findFirst({
      where: {
        OR: [
          { smtpUsername: fromUsername },
          { smtpUsername: from },
          { userId: req.user!.id },
          { allowedAdminIds: { has: req.user!.id } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (smtpAccount) {
    // Enforce write permissions (dev, owner, or staff granted write)
    const accessCheck = canAccessMailbox(smtpAccount, req.user!.id, req.user!.role, 'write');
    if (!accessCheck.allowed) {
      return res.status(403).json({ error: accessCheck.reason });
    }

    if (!isDev && !smtpAccount.isInternal) {
      const isExpired = smtpAccount.expiresAt ? new Date(smtpAccount.expiresAt) < new Date() : false;
      if (isExpired || smtpAccount.isSuspended) {
        return res.status(403).json({
          error: 'Your Business Email subscription has expired or is suspended. Please renew your subscription to continue sending emails.',
          renewRequired: true,
        });
      }
    }
  } else if (!isDev && req.user!.role !== 'admin') {
    return res.status(403).json({
      error: 'You need an active SMTP Hosting subscription or delegated mailbox access to send emails.',
      purchaseRequired: true,
    });
  }

  // Real SMTP Dispatch
  try {
    if (smtpAccount) {
      const password = decryptSecret(smtpAccount.credentialRef, env.secretsEncryptionKey);
      const profile = normalizeMailboxProfile(smtpAccount.profileJson, undefined, smtpAccount.smtpUsername);
      const senderDisplayName = profile.displayName || from.split('@')[0];
      await sendSmtpEmail(
        { host: smtpAccount.smtpHost, port: smtpAccount.smtpPort, user: smtpAccount.smtpUsername, pass: password },
        { from: `"${senderDisplayName}" <${smtpAccount.smtpUsername}>`, to, subject, html: body }
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
 * Fetch user's to-do checklist items dynamically.
 */
emailRouter.get('/email/todos', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const todos = await prisma.webmailTodo.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ todos });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch todos' });
  }
});

/**
 * POST /api/email/todos
 * Create a new to-do task item.
 */
emailRouter.post('/email/todos', async (req: AuthedRequest, res) => {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Valid title string is required' });
    }

    const userId = req.user!.id;
    const newTodo = await prisma.webmailTodo.create({
      data: {
        userId,
        title: title.trim(),
        completed: false,
      },
    });

    res.status(201).json({ todo: newTodo });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create todo' });
  }
});

/**
 * PATCH /api/email/todos/:id
 * Toggle or update a to-do item.
 */
emailRouter.patch('/email/todos/:id', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { completed, title } = req.body || {};

    const existing = await prisma.webmailTodo.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Todo item not found' });
    }

    const updated = await prisma.webmailTodo.update({
      where: { id: req.params.id },
      data: {
        completed: completed !== undefined ? !!completed : existing.completed,
        title: typeof title === 'string' && title.trim() ? title.trim() : existing.title,
      },
    });

    res.json({ todo: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update todo' });
  }
});

/**
 * DELETE /api/email/todos/:id
 * Delete a to-do item.
 */
emailRouter.delete('/email/todos/:id', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const existing = await prisma.webmailTodo.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Todo item not found' });
    }

    await prisma.webmailTodo.delete({
      where: { id: req.params.id },
    });

    res.json({ ok: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete todo' });
  }
});

/**
 * GET /api/email/events
 * Fetch user's upcoming calendar events dynamically.
 */
emailRouter.get('/email/events', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const events = await prisma.webmailEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch events' });
  }
});

/**
 * POST /api/email/events
 * Create a new calendar event.
 */
emailRouter.post('/email/events', async (req: AuthedRequest, res) => {
  try {
    const { title, dateStr, timeStr, participants } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Event title is required' });

    const userId = req.user!.id;
    const newEvent = await prisma.webmailEvent.create({
      data: {
        userId,
        title: String(title).trim(),
        dateStr: dateStr || new Date().toLocaleDateString(),
        timeStr: timeStr || '10:00 AM',
        participants: Array.isArray(participants) ? participants.map(String) : [],
      },
    });

    res.status(201).json({ event: newEvent });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create event' });
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
    // Owner or admin/dev only (same rule as POST /email/domains/:id/verify). Other customers get a
    // 404 so a record id doesn't reveal another tenant's domain name or verification status.
    const isOwner = domainRecord?.userId === req.user!.id;
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
    if (!domainRecord || (!isOwner && !isStaff)) {
      return res.status(404).json({ error: 'Domain record not found' });
    }

    const domain = domainRecord.domain;
    const serverIp = getServerIp();
    const rootHost = `mail.${env.rootDomain}`;

    let dkimValue = `v=DKIM1; k=rsa; p=<managed by mail server>`;
    let dkimSelector = 'wildduck';
    if (env.wildduckApiKey) {
      try {
        const dkim = await wildduckClient.getOrCreateDkim(domain, 'wildduck');
        if (dkim?.publicKey) {
          dkimValue = dkim.txtRecord;
          dkimSelector = dkim.selector || 'wildduck';
        }
      } catch (_) {}
    }

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
          name: `${dkimSelector}._domainkey`,
          value: dkimValue,
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

/**
 * GET /api/admin/mail/config
 * Dev/Admin endpoint to view active Webmail VPS node assignment and S3 storage config.
 */
emailRouter.get('/admin/mail/config', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const config = getWebmailClusterConfig();
  let node = null;
  if (config.mailNodeId) {
    node = await prisma.node.findUnique({
      where: { id: config.mailNodeId },
      select: { id: true, label: true, ip: true, isActive: true },
    });
  }
  res.json({
    config: {
      mailNodeId: config.mailNodeId || null,
      s3Endpoint: config.s3Endpoint || '',
      s3BucketName: config.s3BucketName || '',
      s3Region: config.s3Region || 'auto',
      s3AccessKeyId: config.s3AccessKeyId || '',
      hasSecretAccessKey: Boolean(config.s3SecretAccessKeyEncrypted),
      autoSyncAttachments: config.autoSyncAttachments ?? true,
    },
    node,
  });
});

/**
 * POST /api/admin/mail/config
 * Dev/Admin endpoint to save Webmail VPS node assignment & S3/R2 storage settings.
 */
const mailConfigSchema = z.object({
  mailNodeId: z.string().optional(),
  s3Endpoint: z.string().optional(),
  s3BucketName: z.string().optional(),
  s3Region: z.string().optional(),
  s3AccessKeyId: z.string().optional(),
  s3SecretAccessKey: z.string().optional(),
  autoSyncAttachments: z.boolean().optional(),
});

emailRouter.post('/admin/mail/config', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parse = mailConfigSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid mail config data', details: parse.error.format() });

  const updated = updateWebmailClusterConfig(parse.data);
  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'email.update_cluster_config',
      target: `Updated Webmail VPS Node & S3 Storage Config (Node: ${updated.mailNodeId || 'Default'}, Bucket: ${updated.s3BucketName || 'None'})`,
    },
  });

  res.json({ ok: true, message: 'Webmail VPS node & S3 storage configuration saved successfully.' });
});

/**
 * POST /api/admin/mail/s3/verify
 * Dev/Admin endpoint to verify S3/R2 object storage connectivity.
 */
emailRouter.post('/admin/mail/s3/verify', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const { s3Endpoint, s3Region, s3BucketName, s3AccessKeyId, s3SecretAccessKey } = req.body || {};
  if (s3Endpoint) {
    try {
      const u = new URL(s3Endpoint);
      if (await isSsrfTargetAsync(u.hostname)) {
        return res.status(400).json({ ok: false, error: 'S3 endpoint cannot point to private or internal addresses' });
      }
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid S3 endpoint URL' });
    }
  }
  const result = await verifyS3StorageConnection({ s3Endpoint, s3Region, s3BucketName, s3AccessKeyId, s3SecretAccessKey });
  res.json(result);
});

/**
 * GET /api/admin/mail/telemetry
 * Dev/Admin telemetry endpoint returning aggregated webmail stats & S3 status.
 */
emailRouter.get('/admin/mail/telemetry', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const [totalMailboxes, accountsAgg, domainsCount] = await Promise.all([
    prisma.smtpAccount.count(),
    prisma.smtpAccount.aggregate({
      _sum: { storageQuotaMb: true, storageUsedMb: true, dailySendCount: true },
    }),
    prisma.emailDomain.count(),
  ]);

  const config = getWebmailClusterConfig();
  let assignedNode = null;
  if (config.mailNodeId) {
    assignedNode = await prisma.node.findUnique({
      where: { id: config.mailNodeId },
      select: { id: true, label: true, ip: true, isActive: true },
    });
  }

  res.json({
    totalMailboxes,
    totalStorageMb: accountsAgg._sum.storageQuotaMb || 0,
    totalUsedStorageMb: accountsAgg._sum.storageUsedMb || 0,
    totalSentToday: accountsAgg._sum.dailySendCount || 0,
    totalDomains: domainsCount,
    s3Configured: Boolean(config.s3Endpoint && config.s3BucketName && config.s3AccessKeyId),
    s3BucketName: config.s3BucketName || null,
    assignedNode,
  });
});

// =====================================================================
// MAIL HOSTS (NODES) ARCHITECTURE & BULK MANAGEMENT API
// =====================================================================

/**
 * GET /api/admin/email/hosts
 * List all registered WildDuck mail server nodes (hosts).
 */
emailRouter.get('/admin/email/hosts', requireAdminOrDev, async (_req: AuthedRequest, res) => {
  try {
    const hosts = await prisma.mailHost.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { smtpAccounts: true, emailDomains: true } },
      },
    });

    const formatted = hosts.map((h) => ({
      id: h.id,
      label: h.label,
      hostname: h.hostname,
      apiUrl: h.apiUrl,
      status: h.status,
      isDefault: h.isDefault,
      storageUsedBytes: Number(h.storageUsedBytes),
      storageTotalBytes: Number(h.storageTotalBytes),
      activeConnections: h.activeConnections,
      mailboxCount: h._count.smtpAccounts,
      domainCount: h._count.emailDomains,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    }));

    res.json({ hosts: formatted, total: formatted.length });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list mail hosts');
    res.status(500).json({ error: err.message || 'Failed to list mail hosts' });
  }
});

const addHostSchema = z.object({
  label: z.string().min(1),
  hostname: z.string().min(1),
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
});

/**
 * POST /api/admin/email/hosts
 * Add a new WildDuck mail server node (host).
 */
emailRouter.post('/admin/email/hosts', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parse = addHostSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid host data', details: parse.error.format() });

  const { label, hostname, apiUrl, apiKey, isDefault } = parse.data;

  try {
    const existing = await prisma.mailHost.findUnique({ where: { hostname: hostname.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ error: 'A mail host with this hostname is already registered.' });
    }

    // Verify connectivity to the mail host node
    const testResult = await wildduckClient.testHostConnection(apiUrl, apiKey);
    const initialStatus = testResult.success ? (testResult.status || 'healthy') : 'offline';

    if (isDefault) {
      await prisma.mailHost.updateMany({ data: { isDefault: false } });
    }

    const apiKeyEnc = encryptSecret(apiKey, env.secretsEncryptionKey);
    const newHost = await prisma.mailHost.create({
      data: {
        label,
        hostname: hostname.toLowerCase().trim(),
        apiUrl: apiUrl.replace(/\/$/, ''),
        apiKeyEnc,
        isDefault: !!isDefault,
        status: initialStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'email.add_host',
        target: `Added Mail Host Node ${label} (${hostname}) - Status: ${initialStatus}`,
      },
    });

    res.status(201).json({
      host: {
        id: newHost.id,
        label: newHost.label,
        hostname: newHost.hostname,
        apiUrl: newHost.apiUrl,
        status: newHost.status,
        isDefault: newHost.isDefault,
        createdAt: newHost.createdAt.toISOString(),
      },
      connectionTest: testResult,
      message: `Mail host ${label} added successfully (${initialStatus}).`,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to add mail host');
    res.status(500).json({ error: err.message || 'Failed to add mail host' });
  }
});

/**
 * POST /api/admin/email/hosts/:id/test
 * Test connection to a specific mail host node and update status.
 */
emailRouter.post('/admin/email/hosts/:id/test', requireAdminOrDev, async (req: AuthedRequest, res) => {
  try {
    const host = await prisma.mailHost.findUnique({ where: { id: req.params.id } });
    if (!host) return res.status(404).json({ error: 'Mail host not found' });

    const apiKey = decryptSecret(host.apiKeyEnc, env.secretsEncryptionKey);
    const testResult = await wildduckClient.testHostConnection(host.apiUrl, apiKey);
    const newStatus = testResult.success ? (testResult.status || 'healthy') : 'offline';

    await prisma.mailHost.update({
      where: { id: host.id },
      data: { status: newStatus },
    });

    res.json({
      ok: true,
      hostId: host.id,
      status: newStatus,
      testResult,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to test mail host');
    res.status(500).json({ error: err.message || 'Failed to test mail host' });
  }
});

/**
 * DELETE /api/admin/email/hosts/:id
 * Delete a mail host node.
 */
emailRouter.delete('/admin/email/hosts/:id', requireAdminOrDev, async (req: AuthedRequest, res) => {
  try {
    const host = await prisma.mailHost.findUnique({ where: { id: req.params.id } });
    if (!host) return res.status(404).json({ error: 'Mail host not found' });

    await prisma.mailHost.delete({ where: { id: host.id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'email.delete_host',
        target: `Removed Mail Host Node ${host.label} (${host.hostname})`,
      },
    });

    res.json({ ok: true, id: req.params.id });
  } catch (err: any) {
    logger.error({ err }, 'Failed to delete mail host');
    res.status(500).json({ error: err.message || 'Failed to delete mail host' });
  }
});

/**
 * POST /api/admin/email/mailboxes/bulk
 * Bulk provision mailboxes (CSV list or naming pattern, e.g. user{n}@domain.com).
 */
const bulkProvisionSchema = z.object({
  targetUserId: z.string().min(1),
  domain: z.string().min(1),
  password: z.string().min(8),
  mailHostId: z.string().optional(),
  storageQuotaMb: z.number().int().positive().default(1024),
  dailySendLimit: z.number().int().positive().default(1000),
  // Pattern creation: e.g. prefixPattern "employee{n}", count: 10, startNum: 1
  pattern: z.string().optional(),
  count: z.number().int().positive().max(100).optional(),
  startNum: z.number().int().nonnegative().default(1),
  // Explicit CSV list
  usernames: z.array(z.string()).optional(),
});

emailRouter.post('/admin/email/mailboxes/bulk', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parse = bulkProvisionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid bulk provisioning payload', details: parse.error.format() });

  const { targetUserId, domain, password, mailHostId, storageQuotaMb, dailySendLimit, pattern, count, startNum, usernames } = parse.data;

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

  const domainStr = domain.toLowerCase().trim();
  const smtpHost = `mail.${domainStr}`;
  const webmailUrl = process.env.NODE_ENV === 'production' ? `https://mail.${domainStr}` : 'http://localhost:3001/email';
  const credentialRef = encryptSecret(password, env.secretsEncryptionKey);

  const listToCreate: string[] = [];
  if (usernames && usernames.length > 0) {
    usernames.forEach((u) => {
      const clean = u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (clean && !listToCreate.includes(clean)) listToCreate.push(clean);
    });
  } else if (pattern && count) {
    for (let i = 0; i < count; i++) {
      const num = startNum + i;
      const u = pattern.replace('{n}', String(num)).toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (u && !listToCreate.includes(u)) listToCreate.push(u);
    }
  }

  if (listToCreate.length === 0) {
    return res.status(400).json({ error: 'No valid usernames provided or generated by pattern.' });
  }

  const created: any[] = [];
  const errors: { username: string; error: string }[] = [];

  for (const username of listToCreate) {
    try {
      const fullEmail = `${username}@${domainStr}`;
      const mailboxPassword = password
        ? `${password}.${crypto.randomBytes(4).toString('hex')}`
        : crypto.randomBytes(12).toString('base64');
      const mailboxCredRef = encryptSecret(mailboxPassword, env.secretsEncryptionKey);

      let wildduckUserId: string | undefined;
      let wildduckAddressId: string | undefined;

      try {
        const wdUser = await wildduckClient.createUser(
          {
            username: fullEmail,
            password: mailboxPassword,
            name: targetUser.displayName || targetUser.email,
            quotaGb: Math.max(1, Math.ceil(storageQuotaMb / 1024)),
          },
          mailHostId
        );
        if (wdUser) {
          wildduckUserId = wdUser.id;
          const addr = await wildduckClient.createAddress(wdUser.id, fullEmail, targetUser.displayName || undefined, mailHostId).catch(() => null);
          if (addr) wildduckAddressId = addr.id;
        }
      } catch (wdErr: any) {
        logger.warn({ username, err: wdErr.message }, 'WildDuck API user provision failed during bulk create');
      }

      const acc = await prisma.smtpAccount.create({
        data: {
          userId: targetUserId,
          postalOrgId: 'shanutechx',
          wildduckUserId,
          wildduckAddressId,
          mailHostId: mailHostId || null,
          smtpHost,
          smtpPort: 587,
          smtpUsername: username,
          credentialRef: mailboxCredRef,
          webmailUrl,
          storageQuotaMb,
          dailySendLimit,
          maxAliases: 10,
          customDomain: domainStr,
          isSuspended: false,
          billingModel: 'permanent_free',
        },
      });

      created.push({
        id: acc.id,
        email: fullEmail,
        username,
        domain: domainStr,
      });
    } catch (err: any) {
      errors.push({ username, error: err.message || 'Failed to create mailbox' });
    }
  }

  await prisma.auditLog.create({
    data: {
      adminId: req.user!.id,
      action: 'email.bulk_provision',
      target: `Bulk provisioned ${created.length} mailboxes under domain ${domainStr} for ${targetUser.email}`,
    },
  });

  res.status(201).json({
    ok: true,
    created,
    createdCount: created.length,
    failedCount: errors.length,
    errors,
    message: `Successfully provisioned ${created.length} mailboxes.`,
  });
});

/**
 * PATCH /api/admin/email/mailboxes/:id/status
 * Suspend, unsuspend, or reset password of any mailbox.
 */
const statusPatchSchema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'reset_password']),
  newPassword: z.string().min(8).optional(),
});

emailRouter.patch('/admin/email/mailboxes/:id/status', requireAdminOrDev, async (req: AuthedRequest, res) => {
  const parse = statusPatchSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid status patch body', details: parse.error.format() });

  const { action, newPassword } = parse.data;

  try {
    const account = await prisma.smtpAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: 'Mailbox not found' });

    if (action === 'suspend') {
      await prisma.smtpAccount.update({
        where: { id: account.id },
        data: { isSuspended: true },
      });

      if (account.wildduckUserId) {
        // Suspend user in WildDuck by setting a random unguessable password
        const lockPass = `Suspended_${crypto.randomBytes(16).toString('hex')}`;
        await wildduckClient.updateUser(account.wildduckUserId, { password: lockPass }, account.mailHostId).catch(() => {});
      }

      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'email.suspend_mailbox',
          target: `Suspended mailbox ${account.smtpUsername}@${account.customDomain || env.rootDomain}`,
        },
      });

      return res.json({ ok: true, isSuspended: true, message: 'Mailbox suspended successfully.' });
    }

    if (action === 'unsuspend') {
      await prisma.smtpAccount.update({
        where: { id: account.id },
        data: { isSuspended: false },
      });

      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'email.unsuspend_mailbox',
          target: `Unsuspended mailbox ${account.smtpUsername}@${account.customDomain || env.rootDomain}`,
        },
      });

      return res.json({ ok: true, isSuspended: false, message: 'Mailbox unsuspended successfully.' });
    }

    if (action === 'reset_password') {
      if (!newPassword) return res.status(400).json({ error: 'newPassword is required for reset_password action' });

      const newCredentialRef = encryptSecret(newPassword, env.secretsEncryptionKey);
      await prisma.smtpAccount.update({
        where: { id: account.id },
        data: { credentialRef: newCredentialRef },
      });

      if (account.wildduckUserId) {
        await wildduckClient.updateUser(account.wildduckUserId, { password: newPassword }, account.mailHostId).catch(() => {});
      }

      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'email.reset_password',
          target: `Reset password for mailbox ${account.smtpUsername}@${account.customDomain || env.rootDomain}`,
        },
      });

      return res.json({ ok: true, message: 'Password reset successfully.' });
    }

    res.status(400).json({ error: 'Unsupported action' });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update mailbox status');
    res.status(500).json({ error: err.message || 'Failed to update mailbox status' });
  }
});

/**
 * GET /api/admin/email/system-health
 * Complete system health across mail hosts, tasks, queues, and storage.
 */
emailRouter.get('/admin/email/system-health', requireAdminOrDev, async (_req: AuthedRequest, res) => {
  try {
    const hosts = await prisma.mailHost.findMany();
    const tasks = await wildduckClient.listTasks().catch(() => []);
    const health = await wildduckClient.getHealth().catch(() => ({ status: 'yellow' }));

    const accountsAgg = await prisma.smtpAccount.aggregate({
      _count: { id: true },
      _sum: { storageQuotaMb: true, storageUsedMb: true, dailySendCount: true },
    });

    const healthyHostsCount = hosts.filter((h) => h.status === 'healthy').length;

    res.json({
      overallStatus: health.status || 'green',
      totalHosts: hosts.length,
      healthyHosts: healthyHostsCount,
      hosts: hosts.map((h) => ({
        id: h.id,
        label: h.label,
        hostname: h.hostname,
        apiUrl: h.apiUrl,
        status: h.status,
        isDefault: h.isDefault,
      })),
      tasksCount: tasks.length,
      activeTasks: tasks.slice(0, 10),
      totalMailboxes: accountsAgg._count.id || 0,
      totalStorageMb: accountsAgg._sum.storageQuotaMb || 0,
      totalUsedStorageMb: accountsAgg._sum.storageUsedMb || 0,
      dailySendCountTotal: accountsAgg._sum.dailySendCount || 0,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch system health');
    res.status(500).json({ error: err.message || 'Failed to fetch system health' });
  }
});


