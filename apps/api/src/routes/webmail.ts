import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { decryptSecret } from '../lib/secretsVault';
import { sendSmtpEmail } from '../lib/smtpDispatcher';
import { wildduckClient } from '../lib/wildduckClient';
import { logger } from '../lib/logger';
import { env } from '../env';

export const webmailRouter = Router();

webmailRouter.use(requireAuth);

const FOLDERS = ['inbox', 'sent', 'drafts', 'trash'] as const;

/**
 * Helper to check if the authenticated user has access to a given SmtpAccount.
 * Access is granted if:
 *  1. User is a 'dev'
 *  2. User is the account owner (userId === req.user.id)
 *  3. User is an admin listed in account.allowedAdminIds (dev-delegated access)
 */
async function canAccessMailbox(account: any, userId: string, userRole?: string): Promise<boolean> {
  if (!account) return false;
  if (userRole === 'dev') return true;
  if (account.userId === userId) return true;
  if (Array.isArray(account.allowedAdminIds) && account.allowedAdminIds.includes(userId)) return true;
  return false;
}

// 1. Get list of messages (own or dev-delegated mailboxes)
webmailRouter.get('/webmail/messages', async (req: AuthedRequest, res: Response) => {
  const folder = (req.query.folder as string) || 'inbox';
  const search = (req.query.search as string) || '';
  const smtpAccountId = req.query.smtpAccountId as string | undefined;
  const userId = req.user!.id;
  const role = req.user!.role;

  // Find all mailboxes accessible to this user
  let accessibleAccounts: any[] = [];
  if (role === 'dev') {
    accessibleAccounts = await prisma.smtpAccount.findMany({ select: { id: true, userId: true, wildduckUserId: true, smtpUsername: true, customDomain: true, smtpHost: true } });
  } else {
    accessibleAccounts = await prisma.smtpAccount.findMany({
      where: {
        OR: [{ userId }, { allowedAdminIds: { has: userId } }],
      },
      select: { id: true, userId: true, wildduckUserId: true, smtpUsername: true, customDomain: true, smtpHost: true },
    });
  }

  const targetAccount = smtpAccountId ? accessibleAccounts.find((a) => a.id === smtpAccountId) : accessibleAccounts[0];

  if (targetAccount && targetAccount.wildduckUserId) {
    try {
      const wdResult = await wildduckClient.listMessages(targetAccount.wildduckUserId, {
        folder: folder.toUpperCase(),
        query: search || undefined,
      });

      const domain = targetAccount.customDomain || targetAccount.smtpHost.replace(/^mail\./, '');
      const defaultEmail = `${targetAccount.smtpUsername}@${domain}`;

      const messages = wdResult.messages.map((m) => ({
        id: m.id,
        userId: targetAccount.userId,
        smtpAccountId: targetAccount.id,
        folder: folder,
        senderName: m.from.name || m.from.address.split('@')[0],
        senderEmail: m.from.address,
        recipientEmail: m.to[0]?.address || defaultEmail,
        subject: m.subject,
        snippet: m.intro || '',
        htmlBody: '',
        isRead: m.seen,
        isStarred: m.flagged,
        hasAttachments: Array.isArray(m.attachments) && m.attachments.length > 0,
        createdAt: m.date,
        updatedAt: m.date,
      }));

      const unreadCount = messages.filter((m) => !m.isRead).length;
      return res.json({ messages, unreadCount, total: wdResult.total });
    } catch (err: any) {
      logger.warn({ err: err.message, userId }, 'WildDuck listMessages failed — falling back to DB');
    }
  }

  const accessibleAccountIds = accessibleAccounts.map((a) => a.id);

  const where: any = {
    folder,
    OR: role === 'dev' ? undefined : [
      { userId },
      { smtpAccountId: { in: accessibleAccountIds } },
    ],
  };
  if (role === 'dev') {
    delete where.OR;
  }

  if (smtpAccountId) {
    where.smtpAccountId = smtpAccountId;
  }

  if (search) {
    where.AND = [
      {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { senderName: { contains: search, mode: 'insensitive' } },
          { senderEmail: { contains: search, mode: 'insensitive' } },
          { snippet: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const [messages, unreadCount] = await Promise.all([
    prisma.webmailMessage.findMany({ where, orderBy: { createdAt: 'desc' } }),
    prisma.webmailMessage.count({ where: { ...where, folder: 'inbox', isRead: false } }),
  ]);

  res.json({ messages, unreadCount, total: messages.length });
});

// 2. Get single message details (own or delegated mailbox)
webmailRouter.get('/webmail/messages/:id', async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;

  const msg = await prisma.webmailMessage.findUnique({ where: { id } });
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  if (msg.smtpAccountId) {
    const account = await prisma.smtpAccount.findUnique({ where: { id: msg.smtpAccountId } });
    if (!(await canAccessMailbox(account, userId, role))) {
      return res.status(404).json({ error: 'Message not found' });
    }
  } else if (msg.userId !== userId && role !== 'dev') {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (!msg.isRead) {
    await prisma.webmailMessage.update({ where: { id }, data: { isRead: true } });
    msg.isRead = true;
  }

  res.json({ message: msg });
});

const sendSchema = z.object({
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  smtpAccountId: z.string().optional(),
});

// 3. Send outbound email (own or delegated mailbox)
webmailRouter.post('/webmail/send', async (req: AuthedRequest, res: Response) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { recipientEmail, subject, htmlBody, smtpAccountId } = parsed.data;
  const userId = req.user!.id;
  const role = req.user!.role;

  let account: any = null;

  if (smtpAccountId) {
    account = await prisma.smtpAccount.findUnique({ where: { id: smtpAccountId } });
  } else {
    account = await prisma.smtpAccount.findFirst({
      where: role === 'dev' ? {} : { OR: [{ userId }, { allowedAdminIds: { has: userId } }] },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!account || !(await canAccessMailbox(account, userId, role))) {
    return res.status(400).json({
      error: 'No accessible mailbox provisioned for sending. Contact dev administrator for mailbox access.',
    });
  }

  const senderEmail = account.smtpUsername;
  const rawSenderName = (req.user as any)?.displayName || req.user?.email || senderEmail;
  const senderName = String(rawSenderName).replace(/[\r\n]/g, '').trim();

  const message = await prisma.webmailMessage.create({
    data: {
      userId: account.userId, // Record under mailbox owner
      smtpAccountId: account.id,
      folder: 'sent',
      senderName,
      senderEmail,
      recipientEmail,
      subject,
      snippet: htmlBody.replace(/<[^>]+>/g, '').slice(0, 100) + '...',
      htmlBody,
      isRead: true,
      isStarred: false,
      hasAttachments: false,
    },
  });

  try {
    if (account.wildduckUserId) {
      await wildduckClient.submitMessage(account.wildduckUserId, {
        from: `"${senderName}" <${senderEmail}>`,
        to: [recipientEmail],
        subject,
        html: htmlBody,
        text: htmlBody.replace(/<[^>]+>/g, ''),
      });
      logger.info({ recipientEmail, senderUserId: userId }, 'WildDuck API webmail message submitted');
    } else {
      const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
      const sendResult = await sendSmtpEmail(
        { host: account.smtpHost, port: account.smtpPort, user: account.smtpUsername, pass: password },
        { from: `"${senderName}" <${senderEmail}>`, to: recipientEmail, subject, html: htmlBody }
      );
      logger.info({ recipientEmail, messageId: sendResult.messageId, senderUserId: userId }, 'Delegated webmail message delivered via SMTP');
    }
  } catch (err: any) {
    logger.error({ err: err.message, recipientEmail }, 'Webmail email delivery failed');
    return res.status(502).json({
      error: 'Message was saved, but delivery failed: ' + (err.message || 'Mail server error'),
      message,
    });
  }

  res.status(201).json({ ok: true, message });
});

const patchSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  folder: z.enum(FOLDERS).optional(),
});

// 4. Mark read / unread / starred / move folder (own or delegated mailbox)
webmailRouter.patch('/webmail/messages/:id', async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = await prisma.smtpAccount.findFirst({
    where: role === 'dev' ? {} : { OR: [{ userId }, { allowedAdminIds: { has: userId } }] },
  });

  if (account && account.wildduckUserId) {
    try {
      await wildduckClient.updateMessageFlags(account.wildduckUserId, id, {
        seen: parsed.data.isRead,
        flagged: parsed.data.isStarred,
      });
      return res.json({ ok: true, message: { id, ...parsed.data } });
    } catch (err: any) {
      logger.warn({ err: err.message, id }, 'WildDuck updateMessageFlags failed — trying DB');
    }
  }

  const existing = await prisma.webmailMessage.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Message not found' });

  if (existing.smtpAccountId) {
    const acc = await prisma.smtpAccount.findUnique({ where: { id: existing.smtpAccountId } });
    if (!(await canAccessMailbox(acc, userId, role))) return res.status(404).json({ error: 'Message not found' });
  } else if (existing.userId !== userId && role !== 'dev') {
    return res.status(404).json({ error: 'Message not found' });
  }

  const message = await prisma.webmailMessage.update({ where: { id }, data: parsed.data });
  res.json({ message });
});

// 5. Delete message — own or delegated mailbox
webmailRouter.delete('/webmail/messages/:id', async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;

  const account = await prisma.smtpAccount.findFirst({
    where: role === 'dev' ? {} : { OR: [{ userId }, { allowedAdminIds: { has: userId } }] },
  });

  if (account && account.wildduckUserId) {
    try {
      await wildduckClient.deleteMessage(account.wildduckUserId, id);
      return res.json({ ok: true, deletedId: id });
    } catch (err: any) {
      logger.warn({ err: err.message, id }, 'WildDuck deleteMessage failed — trying DB');
    }
  }

  const existing = await prisma.webmailMessage.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Message not found' });

  if (existing.smtpAccountId) {
    const account = await prisma.smtpAccount.findUnique({ where: { id: existing.smtpAccountId } });
    if (!(await canAccessMailbox(account, userId, role))) return res.status(404).json({ error: 'Message not found' });
  } else if (existing.userId !== userId && role !== 'dev') {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (existing.folder === 'trash') {
    await prisma.webmailMessage.delete({ where: { id } });
  } else {
    await prisma.webmailMessage.update({ where: { id }, data: { folder: 'trash' } });
  }

  res.json({ ok: true, deletedId: id });
});

// 6. Dev Delegation Management Endpoint: Grant admin access to email account
webmailRouter.post('/webmail/delegations', async (req: AuthedRequest, res: Response) => {
  if (req.user?.role !== 'dev') {
    return res.status(403).json({ error: 'Only dev users can delegate mailbox access to admin staff.' });
  }

  const { smtpAccountId, adminUserId } = req.body || {};
  if (!smtpAccountId || !adminUserId) {
    return res.status(400).json({ error: 'smtpAccountId and adminUserId are required' });
  }

  const account = await prisma.smtpAccount.findUnique({ where: { id: smtpAccountId } });
  if (!account) return res.status(404).json({ error: 'SmtpAccount not found' });

  const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
  if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'support')) {
    return res.status(400).json({ error: 'Target user must be an admin or support staff member.' });
  }

  const currentAllowed = account.allowedAdminIds || [];
  if (!currentAllowed.includes(adminUserId)) {
    const updated = await prisma.smtpAccount.update({
      where: { id: smtpAccountId },
      data: { allowedAdminIds: { push: adminUserId } },
    });
    return res.json({ ok: true, message: `Access granted to admin ${adminUser.email}`, account: updated });
  }

  res.json({ ok: true, message: `Admin ${adminUser.email} already has access`, account });
});

// 7. Get Delegated Mailbox List for Admin & Dev Users
webmailRouter.get('/webmail/delegations', async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const isDev = req.user?.role === 'dev';

  const accounts = isDev
    ? await prisma.smtpAccount.findMany({
        select: { id: true, smtpUsername: true, customDomain: true, allowedAdminIds: true, userId: true, user: { select: { email: true } } },
      })
    : await prisma.smtpAccount.findMany({
        where: { OR: [{ userId }, { allowedAdminIds: { has: userId } }] },
        select: { id: true, smtpUsername: true, customDomain: true, allowedAdminIds: true, userId: true, user: { select: { email: true } } },
      });

  res.json({ accounts });
});
