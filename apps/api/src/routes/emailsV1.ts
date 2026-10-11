import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { env } from '../env';
import { logger } from '../lib/logger';
import { wildduckClient } from '../lib/wildduckClient';
import { sendSmtpEmail } from '../lib/smtpDispatcher';
import { decryptSecret } from '../lib/secretsVault';
import { canAccessMailbox } from '../lib/mailboxAcl';

export const emailsV1Router = Router();

// Middleware: allow Bearer / API-Key authentication OR HTTP Basic Auth using mailbox credentials
async function authenticateTransactionalApi(req: AuthedRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  // 1. Basic Auth check (user:pass from provisioned mailbox)
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const b64 = authHeader.slice(6).trim();
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      const [rawUser, rawPass] = decoded.split(':');
      if (rawUser && rawPass) {
        const cleanUser = rawUser.trim().toLowerCase();
        const usernamePrefix = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;
        const domain = cleanUser.includes('@') ? cleanUser.split('@')[1] : undefined;

        const candidateAccounts = await prisma.smtpAccount.findMany({
          where: {
            OR: [
              { smtpUsername: usernamePrefix },
              { smtpUsername: cleanUser },
              ...(domain ? [{ customDomain: domain }] : []),
            ],
          },
          include: { user: true },
        });

        for (const acc of candidateAccounts) {
          try {
            const decryptedPass = decryptSecret(acc.credentialRef, env.secretsEncryptionKey);
            if (decryptedPass === rawPass) {
              req.user = {
                id: acc.user.id,
                firebaseUid: acc.user.firebaseUid,
                email: acc.user.email,
                role: acc.user.role,
              };
              (req as any).authenticatedMailbox = acc;
              return next();
            }
          } catch (_) {}
        }
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Failed basic auth parse in transactional email API');
    }
  }

  // 2. Standard Bearer / API Key auth
  return requireAuth(req, res, next);
}

emailsV1Router.use(authenticateTransactionalApi);

const emailRecipientSchema = z.union([
  z.string().email(),
  z.array(z.string().email()).min(1),
]);

const sendEmailSchema = z.object({
  from: z.string().min(3),
  to: emailRecipientSchema,
  subject: z.string().min(1).max(500),
  html: z.string().optional(),
  text: z.string().optional(),
  reply_to: z.union([z.string(), z.array(z.string())]).optional(),
  replyTo: z.union([z.string(), z.array(z.string())]).optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(),
        contentType: z.string().optional(),
      })
    )
    .optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  headers: z.record(z.string()).optional(),
});

function parseEmailSender(fromStr: string): { displayName: string; emailAddress: string } {
  const match = fromStr.match(/^(?:["']?([^"']*)["']?\s*)?<([^>]+)>$/);
  if (match) {
    return {
      displayName: (match[1] || '').trim(),
      emailAddress: match[2].trim().toLowerCase(),
    };
  }
  return {
    displayName: '',
    emailAddress: fromStr.trim().toLowerCase(),
  };
}

/**
 * POST /api/v1/emails (and POST /api/webmail/emails/send)
 * Resend-compatible transactional email dispatch endpoint.
 */
emailsV1Router.post('/emails', async (req: AuthedRequest, res: Response) => {
  const parse = sendEmailSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      statusCode: 400,
      name: 'validation_error',
      message: 'Invalid email payload',
      errors: parse.error.format(),
    });
  }

  const { from, to, subject, html, text, reply_to, replyTo, cc, bcc, attachments, tags } = parse.data;

  if (!html && !text) {
    return res.status(400).json({
      statusCode: 400,
      name: 'validation_error',
      message: 'Email must contain either an "html" or "text" body.',
    });
  }

  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { displayName, emailAddress: senderEmail } = parseEmailSender(from);
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : env.rootDomain;
  const senderUsername = senderEmail.includes('@') ? senderEmail.split('@')[0] : senderEmail;

  // Resolve matching mailbox for sender
  let account: any = (req as any).authenticatedMailbox;
  if (!account) {
    const candidateAccounts = await prisma.smtpAccount.findMany({
      where:
        userRole === 'dev'
          ? {}
          : {
              OR: [{ userId }, { allowedAdminIds: { has: userId } }],
            },
    });

    account = candidateAccounts.find((acc) => {
      const accDomain = (acc.customDomain || acc.smtpHost.replace(/^mail\./, '')).toLowerCase();
      const accEmail = `${acc.smtpUsername}@${accDomain}`.toLowerCase();
      if (accEmail === senderEmail) return true;
      if (acc.smtpUsername.toLowerCase() === senderEmail) return true;
      if (Array.isArray(acc.aliases) && acc.aliases.some((al) => al.toLowerCase() === senderEmail)) return true;
      if (accDomain === senderDomain) return true;
      return false;
    });
  }

  if (!account && userRole !== 'dev') {
    return res.status(403).json({
      statusCode: 403,
      name: 'invalid_from_address',
      message: `The sender address "${senderEmail}" is not associated with any active mailbox or verified domain in your account. Please configure a mailbox for "${senderDomain}" first.`,
      from: senderEmail,
    });
  }

  if (account) {
    const accessCheck = canAccessMailbox(account, userId, userRole, 'write');
    if (!accessCheck.allowed) {
      return res.status(403).json({
        statusCode: 403,
        name: 'forbidden',
        message: accessCheck.reason,
      });
    }
  }

  if (account?.isSuspended) {
    return res.status(403).json({
      statusCode: 403,
      name: 'account_suspended',
      message: 'Mailbox account is currently suspended. Transactional email sending is disabled.',
    });
  }

  const recipientList = Array.isArray(to) ? to : [to];
  const count = recipientList.length;

  if (account && account.dailySendLimit > 0 && account.dailySendCount + count > account.dailySendLimit) {
    return res.status(429).json({
      statusCode: 429,
      name: 'rate_limit_exceeded',
      message: `Daily send limit reached for mailbox ${senderEmail} (${account.dailySendCount}/${account.dailySendLimit}). Allows ${Math.max(0, account.dailySendLimit - account.dailySendCount)} more emails today.`,
      limit: account.dailySendLimit,
      remaining: Math.max(0, account.dailySendLimit - account.dailySendCount),
    });
  }

  const htmlBody = html || `<pre style="font-family: sans-serif; white-space: pre-wrap;">${text}</pre>`;
  const plainText = text || html?.replace(/<[^>]+>/g, '') || '';
  const finalReplyTo = replyTo || reply_to;
  const replyToStr = Array.isArray(finalReplyTo) ? finalReplyTo.join(', ') : finalReplyTo;

  const senderFormatted = displayName ? `"${displayName}" <${senderEmail}>` : senderEmail;

  try {
    // 1. Dispatch via WildDuck API or SMTP
    let wildduckMessageId: string | undefined;

    if (account?.wildduckUserId) {
      const submitRes = await wildduckClient.submitMessage(account.wildduckUserId, {
        from: senderFormatted,
        to: recipientList,
        subject,
        html: htmlBody,
        text: plainText,
        attachments,
      });
      wildduckMessageId = submitRes.messageId;
    } else if (account) {
      const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
      await sendSmtpEmail(
        { host: account.smtpHost, port: account.smtpPort, user: account.smtpUsername, pass: password },
        {
          from: senderFormatted,
          to: recipientList.join(', '),
          subject,
          html: htmlBody,
          text: plainText,
          replyTo: replyToStr,
          attachments,
        }
      );
    } else {
      // Dev superuser relay without specific mailbox
      const globalConfig = await prisma.platformSmtpConfig.findUnique({ where: { id: 'global' } });
      if (globalConfig) {
        const pass = decryptSecret(globalConfig.passwordEnc, env.secretsEncryptionKey);
        await sendSmtpEmail(
          { host: globalConfig.host, port: globalConfig.port, user: globalConfig.user, pass, secure: globalConfig.secure },
          { from: senderFormatted, to: recipientList.join(', '), subject, html: htmlBody, text: plainText, replyTo: replyToStr, attachments }
        );
      }
    }

    // 2. Persist in WebmailMessage so it shows in Webmail "Sent" and Sent logs
    const message = await prisma.webmailMessage.create({
      data: {
        userId: account?.userId || userId,
        smtpAccountId: account?.id || null,
        folder: 'sent',
        threadId: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderName: displayName || senderEmail,
        senderEmail,
        recipientEmail: recipientList[0],
        subject,
        snippet: plainText.slice(0, 120),
        htmlBody,
        isRead: true,
        hasAttachments: Array.isArray(attachments) && attachments.length > 0,
        attachmentsJson: attachments ? JSON.parse(JSON.stringify(attachments)) : undefined,
        labels: tags ? tags.map((t) => `${t.name}:${t.value}`) : ['transactional', 'api'],
      },
    });

    // 3. Increment daily count
    if (account) {
      await prisma.smtpAccount
        .update({
          where: { id: account.id },
          data: { dailySendCount: { increment: count } },
        })
        .catch(() => {});
    }

    logger.info({ messageId: message.id, from: senderEmail, to: recipientList }, 'Transactional email sent successfully');

    // 4. Return Resend-compliant response
    return res.status(200).json({
      id: message.id,
      from: senderEmail,
      to: recipientList,
      subject,
      status: 'sent',
      createdAt: message.createdAt.toISOString(),
    });
  } catch (err: any) {
    logger.error({ err: err.message, from: senderEmail, to: recipientList }, 'Transactional email dispatch failed');
    return res.status(502).json({
      statusCode: 502,
      name: 'delivery_failed',
      message: `Failed to deliver email: ${err.message || 'Upstream mail server error'}`,
    });
  }
});

/**
 * GET /api/v1/emails/:id
 * Retrieve details and status of a previously sent transactional email.
 */
emailsV1Router.get('/emails/:id', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const msg = await prisma.webmailMessage.findUnique({
    where: { id: req.params.id },
    include: { smtpAccount: { select: { id: true, customDomain: true, smtpUsername: true } } },
  });

  if (!msg) {
    return res.status(404).json({ statusCode: 404, name: 'not_found', message: 'Email not found' });
  }

  if (userRole !== 'dev' && msg.userId !== userId) {
    return res.status(403).json({ statusCode: 403, name: 'forbidden', message: 'Access denied' });
  }

  return res.json({
    id: msg.id,
    object: 'email',
    from: msg.senderEmail,
    to: [msg.recipientEmail],
    subject: msg.subject,
    status: 'sent',
    html: msg.htmlBody,
    hasAttachments: msg.hasAttachments,
    createdAt: msg.createdAt.toISOString(),
  });
});

/**
 * GET /api/v1/emails
 * List recent transactional emails sent via the API.
 */
emailsV1Router.get('/emails', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const messages = await prisma.webmailMessage.findMany({
    where: userRole === 'dev' ? { folder: 'sent' } : { userId, folder: 'sent' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      senderEmail: true,
      recipientEmail: true,
      subject: true,
      snippet: true,
      hasAttachments: true,
      labels: true,
      createdAt: true,
    },
  });

  return res.json({
    data: messages.map((m) => ({
      id: m.id,
      from: m.senderEmail,
      to: [m.recipientEmail],
      subject: m.subject,
      snippet: m.snippet,
      hasAttachments: m.hasAttachments,
      status: 'sent',
      createdAt: m.createdAt.toISOString(),
    })),
    total: messages.length,
  });
});
