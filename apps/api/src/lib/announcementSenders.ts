import { env } from '../env';
import { logger } from './logger';
import { resolveBroadcastLimit, type AnnouncementSenders, type DispatchOptions } from './announcements';

/** Production senders: the Discord and WhatsApp bots' internal HTTP endpoints. */
export const announcementSenders: AnnouncementSenders = {
  async discord(channelId, message) {
    try {
      const res = await fetch(`${env.discordBotUrl}/internal/send-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': env.discordInternalSecret },
        body: JSON.stringify({ channelId, message }),
      });
      return res.ok;
    } catch (err) {
      logger.warn({ err }, 'Announcement: Discord send failed');
      return false;
    }
  },
  whatsapp(phoneNumber, message) {
    void fetch(`${env.whatsappBotUrl}/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': env.whatsappInternalSecret },
      body: JSON.stringify({ phoneNumber, message }),
    }).catch(() => {});
  },
};

export function announcementOptions(): DispatchOptions {
  return {
    whatsappLimit: resolveBroadcastLimit(process.env.WHATSAPP_BROADCAST_LIMIT),
    defaultChannelId: process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID || process.env.ADMIN_ALERT_CHANNEL_ID,
  };
}
