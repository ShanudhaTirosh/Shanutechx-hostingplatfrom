// Load .env before anything reads process.env (the logger reads LOG_LEVEL on require).
require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { buildDmPayload } = require('./dmPayload');
const { connect, getClient, logger } = require('./client');

const PORT = process.env.DISCORD_PORT || 4200;
const INTERNAL_SECRET = process.env.DISCORD_INTERNAL_SECRET;
const ADMIN_ALERT_CHANNEL_ID = process.env.ADMIN_ALERT_CHANNEL_ID;

if (!INTERNAL_SECRET) {
  logger.fatal('Missing DISCORD_INTERNAL_SECRET in env. Refusing to start.');
  process.exit(1);
}

const app = express();
// Documents (e.g. invoice PDFs) arrive base64-encoded: the 100 KB default would reject them.
app.use(express.json({ limit: '12mb' }));

// Liveness — Docker HEALTHCHECK target. Registered before the auth
// middleware below so Docker's healthcheck doesn't need the shared secret.
app.get('/internal/health', (_req, res) => {
  res.json({ ok: true, service: 'shanutechx-discord-bot', ts: new Date().toISOString() });
});

// Internal-only, same pattern as the WhatsApp bot — never put this behind a
// public Cloudflare/Traefik route.
app.use((req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  const key = 'shanutechx-bot-internal';
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
  const { discordUserId, message, document } = req.body || {};
  if (!discordUserId) {
    return res.status(400).json({ error: 'discordUserId and a message or document are required' });
  }
  const built = buildDmPayload(message, document);
  if (!built.ok) {
    return res.status(400).json({ error: built.error });
  }

  try {
    const client = getClient();
    const user = await client.users.fetch(discordUserId);
    await user.send(built.payload);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ discordUserId, err }, 'Failed to send Discord DM');
    res.status(502).json({ error: 'Failed to send DM (user may not share a server with the bot)' });
  }
});

const DISCORD_SNOWFLAKE_REGEX = /^\d{17,20}$/;

/** Posts an alert to the configured admin channel — new orders, payments needing review, node issues, etc. */
app.post('/internal/send-channel', async (req, res) => {
  const { message, channelId } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  const targetChannelId = channelId || ADMIN_ALERT_CHANNEL_ID;
  if (!targetChannelId || !DISCORD_SNOWFLAKE_REGEX.test(targetChannelId)) {
    return res.status(400).json({ error: 'Invalid or missing target channel ID format (must be a valid Discord snowflake)' });
  }

  try {
    const client = getClient();
    const channel = await client.channels.fetch(targetChannelId);
    if (!channel) {
      return res.status(404).json({ error: 'Target Discord channel not found' });
    }

    if (process.env.DISCORD_GUILD_ID && channel.guildId && channel.guildId !== process.env.DISCORD_GUILD_ID) {
      return res.status(403).json({ error: 'Target channel is outside authorized guild' });
    }

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

  const targetChannelId = channelId || ADMIN_ALERT_CHANNEL_ID;
  if (!targetChannelId || !DISCORD_SNOWFLAKE_REGEX.test(targetChannelId)) {
    return res.status(400).json({ error: 'Invalid or missing target channel ID format (must be a valid Discord snowflake)' });
  }

  try {
    const client = getClient();
    const channel = await client.channels.fetch(targetChannelId);
    if (!channel) {
      return res.status(404).json({ error: 'Target Discord channel not found' });
    }

    if (process.env.DISCORD_GUILD_ID && channel.guildId && channel.guildId !== process.env.DISCORD_GUILD_ID) {
      return res.status(403).json({ error: 'Target channel is outside authorized guild' });
    }

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

  if (customerDiscordUserId && !DISCORD_SNOWFLAKE_REGEX.test(String(customerDiscordUserId))) {
    return res.status(400).json({ error: 'Invalid customerDiscordUserId format (must be a Discord snowflake)' });
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

    // Idempotency: don't create a second channel if this ticket already has one.
    const existingChannel = guild.channels.cache.find((c) => c.name === channelName && c.type === 0);
    if (existingChannel) {
      return res.json({ ok: true, channelId: existingChannel.id, channelName: existingChannel.name, existing: true });
    }

    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: ['ViewChannel'],
      },
      // Channel-level @everyone deny overrides the bot's guild-level role permissions, so without
      // this the bot (unless Administrator) could not post its embed or read replies here.
      {
        id: client.user.id,
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'AttachFiles'],
      },
    ];

    if (process.env.DISCORD_STAFF_ROLE_ID && DISCORD_SNOWFLAKE_REGEX.test(process.env.DISCORD_STAFF_ROLE_ID)) {
      overwrites.push({
        id: process.env.DISCORD_STAFF_ROLE_ID,
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'AttachFiles'],
      });
    }

    if (customerDiscordUserId) {
      overwrites.push({
        id: String(customerDiscordUserId),
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
