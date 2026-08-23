const crypto = require('crypto');
const express = require('express');
const { connect, getClient, logger } = require('./client');

const PORT = process.env.DISCORD_PORT || 4200;
const INTERNAL_SECRET = process.env.DISCORD_INTERNAL_SECRET;
const ADMIN_ALERT_CHANNEL_ID = process.env.ADMIN_ALERT_CHANNEL_ID;

if (!INTERNAL_SECRET) {
  logger.fatal('Missing DISCORD_INTERNAL_SECRET in env. Refusing to start.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Liveness — Docker HEALTHCHECK target. Registered before the auth
// middleware below so Docker's healthcheck doesn't need the shared secret.
app.get('/internal/health', (_req, res) => {
  res.json({ ok: true, service: 'shanutechx-discord-bot', ts: new Date().toISOString() });
});

// Internal-only, same pattern as the WhatsApp bot — never put this behind a
// public Cloudflare/Traefik route.
app.use((req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  const key = 'shanutechx-discord-gate';
  const isValid =
    typeof secret === 'string' &&
    crypto.timingSafeEqual(
      crypto.createHmac('sha256', key).update(secret).digest(),
      crypto.createHmac('sha256', key).update(INTERNAL_SECRET).digest()
    );
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

/**
 * DMs a specific Discord user by ID. Note: Discord only allows a bot to
 * open a DM with a user if they share at least one guild (server) — this
 * isn't a code limitation, it's how Discord's platform works. Customers
 * need to join your support server for DM notifications to reach them;
 * channel alerts (below) have no such restriction.
 */
app.post('/internal/send-dm', async (req, res) => {
  const { discordUserId, message } = req.body || {};
  if (!discordUserId || !message) {
    return res.status(400).json({ error: 'discordUserId and message are required' });
  }

  try {
    const client = getClient();
    const user = await client.users.fetch(discordUserId);
    await user.send(message);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ discordUserId, err }, 'Failed to send Discord DM');
    res.status(502).json({ error: 'Failed to send DM (user may not share a server with the bot)' });
  }
});

/** Posts an alert to the configured admin channel — new orders, payments needing review, node issues, etc. */
app.post('/internal/send-channel', async (req, res) => {
  const { message, channelId } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  const targetChannelId = channelId || ADMIN_ALERT_CHANNEL_ID;
  if (!targetChannelId) {
    return res.status(400).json({ error: 'No channelId provided and no ADMIN_ALERT_CHANNEL_ID configured' });
  }

  try {
    const client = getClient();
    const channel = await client.channels.fetch(targetChannelId);
    await channel.send(message);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ channelId: targetChannelId, err }, 'Failed to send Discord channel message');
    res.status(502).json({ error: 'Failed to send channel message' });
  }
});

// Audit finding H3: see the identical fix + explanation in
// services/whatsapp-bot/src/index.js -- binding to 127.0.0.1 inside a
// container blocks sibling-container access via Docker's network,
// silently breaking Discord notifications from apps/api in the
// docker-compose stack (DISCORD_BOT_URL=http://discord-bot:4200).
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'discord-bot internal API listening');
});

connect().catch((err) => {
  logger.fatal({ err }, 'Failed to connect Discord client');
  process.exit(1);
});
