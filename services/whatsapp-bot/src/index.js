// Load .env before anything reads process.env (the logger reads LOG_LEVEL on require).
require('dotenv').config();

const express = require('express');
const { connect, requestPairingCode, resetSession, getSocket, getTelemetryState, onMessageUpsert, logger } = require('./connection');
const { sendNotification } = require('./sendNotification');
const { handleCommand } = require('./commandHandler');
const { verifyInternalSecret } = require('./utils');

const PORT = process.env.WHATSAPP_PORT || 4100;
const INTERNAL_SECRET = process.env.WHATSAPP_INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  logger.fatal('Missing WHATSAPP_INTERNAL_SECRET in env. Refusing to start.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Middleware for timing-safe internal authorization
function authorizeInternal(req, res, next) {
  const secret = req.headers['x-internal-secret'];
  if (!verifyInternalSecret(secret, INTERNAL_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized internal bot access' });
  }
  next();
}

// Liveness — Docker HEALTHCHECK target.
app.get('/internal/health', (_req, res) => {
  res.json({ ok: true, service: 'shanutechx-whatsapp-bot', ts: new Date().toISOString() });
});

// Telemetry & QR Code status endpoint for Admin Panel dashboard
app.get('/internal/status', authorizeInternal, (_req, res) => {
  res.json(getTelemetryState());
});

// Outbound notification & document invoice delivery endpoint
app.post('/internal/send', authorizeInternal, async (req, res) => {
  const { phoneNumber, message, document } = req.body || {};
  if (!phoneNumber || (!message && !document)) {
    return res.status(400).json({ error: 'phoneNumber and message or document are required' });
  }

  try {
    await sendNotification(phoneNumber, message || '', document || null);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ phoneNumber, err }, 'Failed to send WhatsApp notification');
    res.status(502).json({ error: 'Failed to send message: ' + (err.message || 'Unknown error') });
  }
});

app.post('/internal/pairing-code', authorizeInternal, async (req, res) => {
  const { phoneNumber } = req.body || {};
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

  try {
    const code = await requestPairingCode(phoneNumber);
    res.json({ ok: true, pairingCode: code, state: getTelemetryState() });
  } catch (err) {
    logger.error({ err, phoneNumber }, 'Failed to request WhatsApp pairing code');
    res.status(400).json({ error: err.message || 'Failed to generate pairing code' });
  }
});

app.post('/internal/reset-session', authorizeInternal, async (_req, res) => {
  try {
    await resetSession();
    res.json({ ok: true, message: 'WhatsApp session reset successfully', state: getTelemetryState() });
  } catch (err) {
    logger.error({ err }, 'Failed to reset WhatsApp session');
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

app.post('/internal/reconnect', authorizeInternal, async (_req, res) => {
  try {
    await connect();
    res.json({ ok: true, message: 'WhatsApp reconnect initiated', state: getTelemetryState() });
  } catch (err) {
    logger.error({ err }, 'Failed to reconnect WhatsApp');
    res.status(500).json({ error: 'Failed to reconnect' });
  }
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'WhatsApp bot internal API listening');
});

// Register interactive incoming command listener with reconnect persistence
onMessageUpsert(async ({ messages, type }) => {
  if (type !== 'notify') return;

  for (const msg of messages) {
    if (!msg.message || msg.key.fromMe) continue;
    const chatJid = msg.key.remoteJid || '';
    // This is a 1:1 customer-support bot: ignore groups, broadcast lists, status and channels.
    // (Previously a group message made the bot treat the *group id* as a phone number and
    // reply to a non-existent "<groupid>@s.whatsapp.net".)
    if (chatJid.endsWith('@g.us') || chatJid.endsWith('@broadcast') || chatJid.endsWith('@newsletter')) continue;

    // Newer WhatsApp addressing can deliver a "@lid" chat id; prefer the real phone JID when given
    // so customer/staff lookups by phone work.
    const senderPn = typeof msg.key.senderPn === 'string' && msg.key.senderPn.endsWith('@s.whatsapp.net')
      ? msg.key.senderPn
      : null;
    const sender = senderPn || chatJid;

    // Unwrap disappearing-message / view-once wrappers so those messages aren't silently dropped.
    const inner = msg.message.ephemeralMessage?.message || msg.message.viewOnceMessage?.message || msg.message;
    const text = inner.conversation || inner.extendedTextMessage?.text;

    if (sender && text) {
      try {
        const reply = await handleCommand(sender, text);
        if (reply) {
          // Reply on the exact chat the message arrived on.
          await sendNotification(chatJid, reply);
        }
      } catch (err) {
        logger.error({ sender, err }, 'Error handling WhatsApp incoming command');
      }
    }
  }
});

connect().catch((err) => {
  logger.fatal({ err }, 'Failed to connect WhatsApp socket');
  process.exit(1);
});
