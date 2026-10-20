/**
 * Background processing for two webmail features that used to do nothing after the request returned:
 *
 *  - Snooze: nothing ever moved a snoozed message back, so it stayed in "snoozed" forever.
 *  - Scheduled send: POST /webmail/send with a future `scheduledAt` (message saved in "drafts") and
 *    POST /webmail/messages/schedule (WebmailScheduledSend rows) never sent anything.
 *
 * Kept free of prisma/SMTP imports: the database and the mail delivery function are injected, so every
 * rule below is unit-tested without a database or a mail server (see tests/unit/webmailSweep.test.ts).
 *
 * Sending e-mail cannot be undone, so the rule is AT MOST ONCE: a row is claimed with a compare-and-set
 * update BEFORE delivery, and a failed delivery is recorded as failed - never retried automatically.
 * A crash between claim and delivery can therefore lose a send, but can never send it twice.
 */
export type WebmailDb = any; // PrismaClient-shaped; structural so tests can pass an in-memory fake

export type OutgoingMail = {
  senderName: string;
  senderEmail: string;
  to: string;
  subject: string;
  html: string;
  attachments?: unknown;
};
export type Deliver = (account: any, mail: OutgoingMail) => Promise<void>;

export const SWEEP_BATCH = 50;
const RETURN_FOLDERS = ['inbox', 'sent', 'drafts', 'spam', 'trash', 'archive'];

export type SendStats = { sent: number; failed: number; skipped: number };
export type WebmailSweepResult = { snoozed: number; drafts: SendStats; scheduled: SendStats };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Scheduled-send bodies are stored as typed: wrap plain text, pass real HTML through. */
export function bodyToHtml(body: string): string {
  return /<\/?[a-z][\s\S]*>/i.test(body) ? body : escapeHtml(body).replace(/\r?\n/g, '<br>');
}

const safeName = (s: string) => String(s || '').replace(/[\r\n"]/g, '').trim();
const dailyLimitReached = (a: any) => a.dailySendLimit > 0 && a.dailySendCount >= a.dailySendLimit;

export async function sweepSnoozes(db: WebmailDb, now: Date = new Date()): Promise<number> {
  const due = await db.webmailSnooze.findMany({
    where: { snoozedUntil: { lte: now } },
    orderBy: { snoozedUntil: 'asc' },
    take: SWEEP_BATCH,
  });
  let returned = 0;
  for (const s of due) {
    try {
      const folder = RETURN_FOLDERS.includes(s.returnFolder) ? s.returnFolder : 'inbox';
      // Only touch it if it is still snoozed: the user may have moved or deleted it meanwhile.
      const res = await db.webmailMessage.updateMany({
        where: { id: s.messageId, userId: s.userId, folder: 'snoozed' },
        data: { folder, snoozedUntil: null, isRead: false },
      });
      await db.webmailSnooze.delete({ where: { id: s.id } });
      if (res.count > 0) returned += 1;
    } catch {
      /* leave the row: it is picked up again on the next sweep */
    }
  }
  return returned;
}

/** Messages saved by POST /webmail/send with a future scheduledAt (folder "drafts"). */
export async function sweepScheduledDrafts(db: WebmailDb, deliver: Deliver, now: Date = new Date()): Promise<SendStats> {
  const stats: SendStats = { sent: 0, failed: 0, skipped: 0 };
  const due = await db.webmailMessage.findMany({
    where: { folder: 'drafts', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: SWEEP_BATCH,
  });
  for (const m of due) {
    try {
      const account = m.smtpAccountId ? await db.smtpAccount.findUnique({ where: { id: m.smtpAccountId } }) : null;
      if (!account || account.isSuspended) {
        // Cannot send: keep it as a plain draft so it is not picked up again.
        await db.webmailMessage.updateMany({ where: { id: m.id }, data: { scheduledAt: null } });
        stats.failed += 1;
        continue;
      }
      if (dailyLimitReached(account)) {
        stats.skipped += 1; // stays scheduled; tried again on a later sweep
        continue;
      }
      const claim = await db.webmailMessage.updateMany({
        where: { id: m.id, folder: 'drafts', scheduledAt: { lte: now } },
        data: { folder: 'sent', scheduledAt: null },
      });
      if (claim.count !== 1) continue; // another sweep took it
      try {
        await deliver(account, {
          senderName: safeName(m.senderName),
          senderEmail: m.senderEmail,
          to: m.recipientEmail,
          subject: m.subject,
          html: m.htmlBody,
          attachments: m.attachmentsJson ?? undefined,
        });
        await db.smtpAccount.update({ where: { id: account.id }, data: { dailySendCount: { increment: 1 } } });
        stats.sent += 1;
      } catch {
        // Back to a plain draft (no schedule): the user can resend it, we never retry automatically.
        await db.webmailMessage.updateMany({ where: { id: m.id }, data: { folder: 'drafts' } });
        stats.failed += 1;
      }
    } catch {
      /* next sweep */
    }
  }
  return stats;
}

/** Rows created by POST /webmail/messages/schedule. */
export async function sweepScheduledSends(db: WebmailDb, deliver: Deliver, now: Date = new Date()): Promise<SendStats> {
  const stats: SendStats = { sent: 0, failed: 0, skipped: 0 };
  const due = await db.webmailScheduledSend.findMany({
    where: { status: 'pending', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
    take: SWEEP_BATCH,
  });
  for (const r of due) {
    try {
      const account = await db.smtpAccount.findFirst({
        where: { OR: [{ userId: r.userId }, { allowedAdminIds: { has: r.userId } }] },
        orderBy: { createdAt: 'asc' },
      });
      if (!account || account.isSuspended) {
        await db.webmailScheduledSend.updateMany({ where: { id: r.id, status: 'pending' }, data: { status: 'failed' } });
        stats.failed += 1;
        continue;
      }
      if (dailyLimitReached(account)) {
        stats.skipped += 1;
        continue;
      }
      const claim = await db.webmailScheduledSend.updateMany({
        where: { id: r.id, status: 'pending' }, // cancelled / already claimed rows no longer match
        data: { status: 'sending' },
      });
      if (claim.count !== 1) continue;

      const html = bodyToHtml(r.body);
      try {
        await deliver(account, {
          senderName: safeName(account.smtpUsername),
          senderEmail: account.smtpUsername,
          to: r.recipientTo,
          subject: r.subject,
          html,
          attachments: r.attachmentsJson ?? undefined,
        });
      } catch {
        await db.webmailScheduledSend.updateMany({ where: { id: r.id }, data: { status: 'failed' } });
        stats.failed += 1;
        continue;
      }
      await db.webmailScheduledSend.updateMany({ where: { id: r.id }, data: { status: 'sent' } });
      await db.smtpAccount.update({ where: { id: account.id }, data: { dailySendCount: { increment: 1 } } });
      stats.sent += 1;
      try {
        // A copy in the user's Sent folder, like a normal send. Best effort: the mail is already out.
        await db.webmailMessage.create({
          data: {
            userId: r.userId,
            smtpAccountId: account.id,
            folder: 'sent',
            threadId: `thread-${Date.now()}`,
            senderName: safeName(account.smtpUsername),
            senderEmail: account.smtpUsername,
            recipientEmail: r.recipientTo,
            subject: r.subject,
            snippet: html.replace(/<[^>]+>/g, '').slice(0, 100) + '...',
            htmlBody: html,
            isRead: true,
            isStarred: false,
            hasAttachments: Array.isArray(r.attachmentsJson) && r.attachmentsJson.length > 0,
            attachmentsJson: r.attachmentsJson ?? undefined,
            labels: [],
          },
        });
      } catch {
        /* ignore */
      }
    } catch {
      /* next sweep */
    }
  }
  return stats;
}

export async function runWebmailSweep(db: WebmailDb, deliver: Deliver, now: Date = new Date()): Promise<WebmailSweepResult> {
  const snoozed = await sweepSnoozes(db, now);
  const drafts = await sweepScheduledDrafts(db, deliver, now);
  const scheduled = await sweepScheduledSends(db, deliver, now);
  return { snoozed, drafts, scheduled };
}
