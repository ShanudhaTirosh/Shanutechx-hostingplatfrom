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
  client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
