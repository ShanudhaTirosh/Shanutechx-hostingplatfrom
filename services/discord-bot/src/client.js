const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const pino = require('pino');
const { commands, handleInteraction } = require('./slashCommands');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } } }
    : {}),
});

let client = null;
let ready = false;

async function registerSlashCommands(clientId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;

  try {
    const rest = new REST({ version: '10' }).setToken(token);
    logger.info('Registering Discord slash commands...');
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands.map((c) => c.toJSON()),
    });
    logger.info('Successfully registered Discord slash commands.');
  } catch (err) {
    logger.error({ err }, 'Failed to register Discord slash commands');
  }
}

function connect() {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once('ready', async () => {
    ready = true;
    logger.info({ tag: client.user.tag }, 'Discord bot connected');
    await registerSlashCommands(client.user.id);
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      await handleInteraction(interaction);
    } catch (err) {
      logger.error({ err }, 'Error executing Discord interaction');
    }
  });

  // Bi-directional message listener for dedicated ticket channels
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channelName = message.channel.name || '';
    const topic = message.channel.topic || '';

    let ticketId = null;
    if (topic.includes('Ticket ID:')) {
      const match = topic.match(/Ticket ID:\s*([a-f0-9\-]+)/i);
      if (match) ticketId = match[1];
    }

    if (!ticketId && channelName.startsWith('ticket-')) {
      ticketId = message.channel.name.replace('ticket-', '');
    }

    if (ticketId && message.content.trim()) {
      try {
        const apiBase = process.env.API_INTERNAL_URL || 'http://localhost:4000';
        const secret = process.env.DISCORD_INTERNAL_SECRET;

        await fetch(`${apiBase}/api/internal/reply-ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': secret,
          },
          body: JSON.stringify({
            ticketId,
            body: message.content,
            staffUserLabel: `${message.author.username} (via Discord Channel)`,
          }),
        });
        logger.info({ ticketId, author: message.author.username }, 'Synced Discord channel message to ticket thread');
      } catch (err) {
        logger.error({ err, ticketId }, 'Failed to relay Discord ticket message to API');
      }
    }
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Discord client error');
  });

  return client.login(process.env.DISCORD_BOT_TOKEN);
}

function getClient() {
  if (!client || !ready) {
    throw new Error('Discord client not connected yet');
  }
  return client;
}

module.exports = { connect, getClient, logger };
