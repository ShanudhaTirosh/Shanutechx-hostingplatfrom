const fs = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');

const AUTH_DIR = path.join(__dirname, '..', 'auth');

let sock = null;
let currentQr = null;
let currentQrDataUrl = null;
let currentPairingCode = null;
let connectionState = 'disconnected';

const baileysLogger = pino({ level: 'warn' });

const appLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } } }
    : {}),
});

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

  for (const listener of messageListeners) {
    sock.ev.on('messages.upsert', listener);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQr = qr;
      connectionState = 'qr_ready';
      try {
        currentQrDataUrl = await QRCode.toDataURL(qr);
      } catch (e) {
        currentQrDataUrl = null;
      }
      appLogger.info('Scan this QR code with the SHANUTECHX WhatsApp number:');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      connectionState = loggedOut ? 'logged_out' : 'reconnecting';
      currentQr = null;
      currentQrDataUrl = null;

      if (loggedOut) {
        appLogger.error('WhatsApp session logged out. Resetting auth folder.');
        await resetSession();
      } else {
        appLogger.warn({ statusCode }, 'WhatsApp connection closed, reconnecting in 5s...');
        setTimeout(connect, 5000);
      }
    }

    if (connection === 'open') {
      connectionState = 'connected';
      currentQr = null;
      currentQrDataUrl = null;
      currentPairingCode = null;
      appLogger.info('WhatsApp connected.');
    }
  });

  return sock;
}

async function requestPairingCode(phoneNumber) {
  if (!sock) {
    await connect();
  }
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (!cleanPhone) throw new Error('Valid phone number with country code is required');

  if (sock.authState?.creds?.me?.id) {
    throw new Error('WhatsApp is already authenticated and connected');
  }

  const code = await sock.requestPairingCode(cleanPhone);
  currentPairingCode = code;
  connectionState = 'pairing_ready';
  return code;
}

async function resetSession() {
  if (sock) {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.end(new Error('Resetting session'));
    } catch (_) {}
    sock = null;
  }

  currentQr = null;
  currentQrDataUrl = null;
  currentPairingCode = null;
  connectionState = 'disconnected';

  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    appLogger.info('Cleared WhatsApp session auth directory');
  }

  await connect();
}

let messageListeners = [];

function onMessageUpsert(listener) {
  messageListeners.push(listener);
  if (sock) {
    sock.ev.on('messages.upsert', listener);
  }
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
    qrDataUrl: currentQrDataUrl,
    pairingCode: currentPairingCode,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  connect,
  requestPairingCode,
  resetSession,
  getSocket,
  getTelemetryState,
  onMessageUpsert,
  logger: appLogger,
};
