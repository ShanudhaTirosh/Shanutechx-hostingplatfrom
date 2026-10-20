/**
 * Announcement dispatch and the scheduled-announcement sweep.
 *
 * Before this, POST /internal/announcements/send only dispatched when `scheduledFor` was empty: a scheduled
 * announcement was stored as "scheduled" and nothing ever sent it (the model even documents the
 * "sending"/"failed" statuses a sweeper would use). The WhatsApp recipient list was also silently cut to
 * 100 users in no particular order, with the caller told it had gone out.
 *
 * Pure of prisma/fetch: the database and the senders are injected so the rules are unit-tested.
 * Sending cannot be undone, so scheduled announcements are AT MOST ONCE: claimed with a compare-and-set
 * update (scheduled -> sending) before dispatch, and a failure is recorded, never retried automatically.
 */
export type AnnouncementDb = any; // PrismaClient-shaped; structural so tests can pass an in-memory fake

export type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  targetPlatform: string;
  channelId?: string | null;
  rolePing?: string | null;
  imageUrl?: string | null;
};

export type AnnouncementSenders = {
  /** Post to a Discord channel. Resolves true when the bot accepted it. */
  discord(channelId: string | undefined, message: string): Promise<boolean>;
  /** Queue one WhatsApp message (fire-and-forget: the bot paces its own sending). */
  whatsapp(phoneNumber: string, message: string): void;
};

export type DispatchOptions = { whatsappLimit?: number; defaultChannelId?: string };
export type DispatchResult = { deliveredCount: number; totalRecipients: number; truncated: boolean; discordOk: boolean };

/**
 * WhatsApp throttles bulk senders hard (the bot already spaces messages 2.5 s apart), so a broadcast is
 * capped. The cap is configurable and always REPORTED, never silent.
 */
export const DEFAULT_WHATSAPP_BROADCAST_LIMIT = 100;
export const SCHEDULED_BATCH = 20;

export function resolveBroadcastLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 5000) : DEFAULT_WHATSAPP_BROADCAST_LIMIT;
}

export const whatsappText = (a: AnnouncementRow) => `📢 *${a.title}*\n\n${a.message}`;
export const discordText = (a: AnnouncementRow) =>
  `${a.rolePing ? `${a.rolePing}\n` : ''}📢 **${a.title}**\n${a.message}${a.imageUrl ? `\n${a.imageUrl}` : ''}`;

export async function dispatchAnnouncement(
  db: AnnouncementDb,
  a: AnnouncementRow,
  senders: AnnouncementSenders,
  opts: DispatchOptions = {}
): Promise<DispatchResult> {
  const result: DispatchResult = { deliveredCount: 0, totalRecipients: 0, truncated: false, discordOk: true };
  const platform = a.targetPlatform;

  if (platform === 'discord' || platform === 'both') {
    result.discordOk = await senders.discord(a.channelId || opts.defaultChannelId, discordText(a));
  }

  if (platform === 'whatsapp' || platform === 'both') {
    const limit = opts.whatsappLimit ?? DEFAULT_WHATSAPP_BROADCAST_LIMIT;
    const where = { phoneNumber: { not: null } };
    result.totalRecipients = await db.user.count({ where });
    // Oldest customers first: the order used to be unspecified, so which 100 got a broadcast was random.
    const customers = await db.user.findMany({ where, select: { phoneNumber: true }, orderBy: { createdAt: 'asc' }, take: limit });
    for (const c of customers) {
      if (!c.phoneNumber) continue;
      senders.whatsapp(c.phoneNumber, whatsappText(a));
      result.deliveredCount += 1;
    }
    result.truncated = result.totalRecipients > result.deliveredCount;
  }
  return result;
}

export async function sweepScheduledAnnouncements(
  db: AnnouncementDb,
  senders: AnnouncementSenders,
  opts: DispatchOptions = {},
  now: Date = new Date()
): Promise<{ processed: number; failed: number }> {
  const stats = { processed: 0, failed: 0 };
  const due = await db.announcement.findMany({
    where: { status: 'scheduled', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
    take: SCHEDULED_BATCH,
  });
  for (const a of due) {
    try {
      const claim = await db.announcement.updateMany({ where: { id: a.id, status: 'scheduled' }, data: { status: 'sending' } });
      if (claim.count !== 1) continue; // another sweep took it
      try {
        const r = await dispatchAnnouncement(db, a, senders, opts);
        // A Discord-only announcement that never reached Discord has gone nowhere; anything that
        // queued WhatsApp messages (or targeted them) counts as sent.
        const delivered = !(a.targetPlatform === 'discord' && !r.discordOk);
        await db.announcement.updateMany({ where: { id: a.id }, data: delivered ? { status: 'sent', sentAt: new Date() } : { status: 'failed' } });
        if (delivered) stats.processed += 1;
        else stats.failed += 1;
      } catch {
        await db.announcement.updateMany({ where: { id: a.id }, data: { status: 'failed' } });
        stats.failed += 1;
      }
    } catch {
      /* next sweep */
    }
  }
  return stats;
}
