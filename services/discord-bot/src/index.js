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

/** Posts a rich ticket embed with action buttons (Claim, Reply, Close) */
app.post('/internal/send-ticket-embed', async (req, res) => {
  const { embed, actionRow, channelId } = req.body || {};
  if (!embed) return res.status(400).json({ error: 'embed object is required' });

  try {
    const client = getClient();
    const targetChannelId = channelId || ADMIN_ALERT_CHANNEL_ID;
    if (!targetChannelId) {
      return res.status(400).json({ error: 'No target channelId or ADMIN_ALERT_CHANNEL_ID configured' });
    }
    const channel = await client.channels.fetch(targetChannelId);
    await channel.send({
      embeds: [embed],
      components: actionRow ? [actionRow] : [],
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Failed to send Discord ticket embed');
    res.status(502).json({ error: 'Failed to send ticket embed' });
  }
});

/** Creates a dedicated Discord ticket channel with role & user permission overwrites */
app.post('/internal/create-ticket-channel', async (req, res) => {
  const { ticketId, subject, customerEmail, customerDiscordUserId, embed, actionRow } = req.body || {};
  if (!ticketId || !subject) {
    return res.status(400).json({ error: 'ticketId and subject are required' });
  }

  try {
    const client = getClient();
    const guildId = process.env.DISCORD_GUILD_ID;
    const guild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();

    if (!guild) {
      return res.status(404).json({ error: 'No Discord guild found for bot' });
    }

    // Find or create Category "SUPPORT TICKETS"
    let category = guild.channels.cache.find((c) => c.type === 4 && c.name.toUpperCase() === 'SUPPORT TICKETS');
    if (!category) {
      category = await guild.channels.create({
        name: 'SUPPORT TICKETS',
        type: 4, // GuildCategory
      }).catch(() => null);
    }

    const shortId = ticketId.slice(0, 8).toUpperCase();
    const channelName = `ticket-${shortId.toLowerCase()}`;

    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: ['ViewChannel'],
      },
    ];

    if (process.env.DISCORD_STAFF_ROLE_ID) {
      overwrites.push({
        id: process.env.DISCORD_STAFF_ROLE_ID,
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'AttachFiles'],
      });
    }

    if (customerDiscordUserId) {
      overwrites.push({
        id: customerDiscordUserId,
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'AttachFiles'],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: 0, // GuildText
      parent: category ? category.id : undefined,
      topic: `Ticket ID: ${ticketId} | Customer: ${customerEmail || 'Customer'} | Subject: ${subject}`,
      permissionOverwrites: overwrites,
    });

    if (embed) {
      await ticketChannel.send({
        embeds: [embed],
        components: actionRow ? [actionRow] : [],
      });
    }

    logger.info({ channelId: ticketChannel.id, ticketId }, 'Created dedicated Discord ticket channel');
    res.json({ ok: true, channelId: ticketChannel.id, channelName: ticketChannel.name });
  } catch (err) {
    logger.error({ err, ticketId }, 'Failed to create dedicated Discord ticket channel');
    res.status(502).json({ error: 'Failed to create ticket channel' });
  }
});

/** Telemetry status endpoint for Admin Dashboard Bot Studio */
app.get('/internal/status', (_req, res) => {
  try {
    const client = getClient();
    const guilds = client.guilds.cache.map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }));
    const activeTicketChannels = client.channels.cache.filter(
      (c) => c.name && c.name.startsWith('ticket-')
    ).size;

    res.json({
      status: 'connected',
      botTag: client.user.tag,
      guildsCount: guilds.length,
      guilds,
      activeTicketChannels,
      staffRoleId: process.env.DISCORD_STAFF_ROLE_ID || null,
      adminAlertChannelId: ADMIN_ALERT_CHANNEL_ID || null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      status: 'disconnected',
      error: err.message,
      updatedAt: new Date().toISOString(),
    });
  }
});


app.listen(PORT, () => {
  logger.info({ port: PORT }, 'discord-bot internal API listening');
});

connect().catch((err) => {
  logger.fatal({ err }, 'Failed to connect Discord client');
  process.exit(1);
});
