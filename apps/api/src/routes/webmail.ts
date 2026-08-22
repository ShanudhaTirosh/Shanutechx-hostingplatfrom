import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { decryptSecret } from '../lib/secretsVault';
import { sendSmtpEmail } from '../lib/smtpDispatcher';
import { logger } from '../lib/logger';
import { env } from '../env';

/**
 * Self-hosted webmail inbox. Rewritten (audit finding C3) from a single,
 * unscoped, in-memory store shared by every user on the platform (a
 * cross-tenant IDOR: any authenticated user could read/modify/delete any
 * other user's messages) into a real Prisma-backed table where every
 * route filters by the authenticated user's own ID.
 *
 * Also fixes M4/M5 in the same pass: outbound sends now go through the
 * user's actual provisioned SmtpAccount credentials (the same
 * encryptSecret/decryptSecret pattern already used correctly elsewhere
 * in routes/smtp.ts and routes/email.ts) instead of falling back to
 * undocumented, unconfigured SMTP_HOST/SMTP_USER/SMTP_PASS env vars with
 * a hardcoded literal password fallback.
 */

export const webmailRouter = Router();

webmailRouter.use(requireAuth);

const FOLDERS = ['inbox', 'sent', 'drafts', 'trash'] as const;

// 1. Get list of messages (own mailbox only)
webmailRouter.get('/webmail/messages', async (req: AuthedRequest, res: Response) => {
  const folder = (req.query.folder as string) || 'inbox';
  const search = (req.query.search as string) || '';
  const userId = req.user!.id;

  const where: any = { userId, folder };
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { senderName: { contains: search, mode: 'insensitive' } },
      { senderEmail: { contains: search, mode: 'insensitive' } },
      { snippet: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [messages, unreadCount] = await Promise.all([
    prisma.webmailMessage.findMany({ where, orderBy: { createdAt: 'desc' } }),
    prisma.webmailMessage.count({ where: { userId, folder: 'inbox', isRead: false } }),
  ]);

  res.json({ messages, unreadCount, total: messages.length });
});

// 2. Get single message details (own mailbox only)
webmailRouter.get('/webmail/messages/:id', async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Scoped lookup: a message belonging to another user simply doesn't
  // match this query, so it 404s rather than leaking its existence or
  // content (audit finding C3).
  const msg = await prisma.webmailMessage.findFirst({ where: { id, userId } });
  if (!msg) return res.status(404).json({ error: 'Message not found' });

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
  // Which of the user's mailboxes to send from, if they have more than
  // one. Defaults to their first/only provisioned mailbox.
  smtpAccountId: z.string().optional(),
});

// 3. Send outbound email (Gmail-style compose)
webmailRouter.post('/webmail/send', async (req: AuthedRequest, res: Response) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { recipientEmail, subject, htmlBody, smtpAccountId } = parsed.data;
  const userId = req.user!.id;

  const account = smtpAccountId
    ? await prisma.smtpAccount.findFirst({ where: { id: smtpAccountId, userId } })
    : await prisma.smtpAccount.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });

  if (!account) {
    return res.status(400).json({
      error: 'No mailbox is provisioned for your account yet. Order an email hosting plan first.',
    });
  }

  const senderEmail = account.smtpUsername;
  const senderName = (req.user as any)?.displayName || req.user?.email || senderEmail;

  const message = await prisma.webmailMessage.create({
    data: {
      userId,
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

  // Actually attempt delivery through the user's own real mailbox
  // credentials -- previously this used undocumented global env vars
  // with a hardcoded fallback password, which meant delivery silently
  // failed in most deployments while still reporting success to the UI.
  try {
    const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
    const sendResult = await sendSmtpEmail(
      { host: account.smtpHost, port: account.smtpPort, user: account.smtpUsername, pass: password },
      { from: `"${senderName}" <${senderEmail}>`, to: recipientEmail, subject, html: htmlBody }
    );
    logger.info({ recipientEmail, messageId: sendResult.messageId }, 'Webmail message delivered');
  } catch (err: any) {
    // Delivery failure no longer silently disappears into a background
    // promise -- the send is awaited and a failure is surfaced to the
    // caller, while the drafted/composed message is still saved so the
    // user doesn't lose their work.
    logger.error({ err: err.message, recipientEmail }, 'Webmail SMTP delivery failed');
    return res.status(502).json({
      error: 'Message was saved, but delivery failed: ' + (err.message || 'SMTP error'),
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

// 4. Mark read / unread / starred / move folder (own mailbox only)
webmailRouter.patch('/webmail/messages/:id', async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.webmailMessage.findFirst({ where: { id, userId } });
  if (!existing) return res.status(404).json({ error: 'Message not found' });

  const message = await prisma.webmailMessage.update({ where: { id }, data: parsed.data });
  res.json({ message });
});

// 5. Delete message (move to trash, or permanently delete from trash) — own mailbox only
webmailRouter.delete('/webmail/messages/:id', async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const existing = await prisma.webmailMessage.findFirst({ where: { id, userId } });
  if (!existing) return res.status(404).json({ error: 'Message not found' });

  if (existing.folder === 'trash') {
    await prisma.webmailMessage.delete({ where: { id } });
  } else {
    await prisma.webmailMessage.update({ where: { id }, data: { folder: 'trash' } });
  }

  res.json({ ok: true, deletedId: id });
});
