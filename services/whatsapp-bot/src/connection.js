const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const AUTH_DIR = require('path').join(__dirname, '..', 'auth');

let sock = null;

// Baileys' own internal logger — kept quiet at 'warn' so its verbose
// protocol-level logging doesn't drown out our own connection events.
const baileysLogger = pino({ level: 'warn' });

// App-level logger for connection lifecycle (connect/disconnect/QR).
const appLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } } }
    : {}),
});

/**
 * Connects to WhatsApp using a persisted multi-file auth session.
 * First run: scan the printed QR code with the dedicated business number.
 * Subsequent runs: reconnects silently using the saved session in /auth.
 *
 * Reconnect-with-backoff is intentionally simple here — this is a low-volume
 * notification bot, not a high-availability messaging system.
 */
async function connect() {
  if (sock) {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.end(new Error('Reconnecting'));
    } catch (_) {}
    sock = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    auth: state,
    version,
    logger: baileysLogger,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQr = qr;
      connectionState = 'qr_ready';
      appLogger.info('Scan this QR code with the SHANUTECHX WhatsApp number:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      connectionState = loggedOut ? 'logged_out' : 'reconnecting';
      currentQr = null;

      if (loggedOut) {
        appLogger.error('WhatsApp session logged out. Delete the auth/ folder and re-pair with a QR scan.');
      } else {
        appLogger.warn({ statusCode }, 'WhatsApp connection closed, reconnecting in 5s...');
        setTimeout(connect, 5000);
      }
    }

    if (connection === 'open') {
      connectionState = 'connected';
      currentQr = null;
      appLogger.info('WhatsApp connected.');
    }
  });

  return sock;
}

function getSocket() {
  if (!sock) {
    throw new Error('WhatsApp socket not connected yet');
  }
  return sock;
}

function getTelemetryState() {
  return {
    state: connectionState,
    qr: currentQr,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { connect, getSocket, getTelemetryState, logger: appLogger };
