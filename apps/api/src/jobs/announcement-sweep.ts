import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { sweepScheduledAnnouncements } from '../lib/announcements';
import { announcementOptions, announcementSenders } from '../lib/announcementSenders';

export async function executeAnnouncementSweepJob() {
  const result = await sweepScheduledAnnouncements(prisma, announcementSenders, announcementOptions());
  if (result.processed + result.failed > 0) logger.info({ result }, 'Announcement sweep dispatched scheduled announcements');
  return result;
}
