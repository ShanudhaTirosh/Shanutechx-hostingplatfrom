const { Client, GatewayIntentBits } = require('discord.js');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } } }
    : {}),
});

let client = null;
let ready = false;

/**
 * Logs the bot in. Only needs the Guilds intent — sending channel alerts and
 * DMing a known user ID don't require privileged intents (GuildMembers,
 * MessageContent, etc.), so there's no Discord Developer Portal approval
 * step needed to run this.
 */
function connect() {
  client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once('ready', () => {
    ready = true;
    logger.info({ tag: client.user.tag }, 'Discord bot connected');
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
