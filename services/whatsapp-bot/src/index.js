const crypto = require('crypto');
const express = require('express');
const { connect, getSocket, getTelemetryState, logger } = require('./connection');
const { sendNotification } = require('./sendNotification');
const { handleCommand } = require('./commandHandler');

const PORT = process.env.WHATSAPP_PORT || 4100;
const INTERNAL_SECRET = process.env.WHATSAPP_INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  logger.fatal('Missing WHATSAPP_INTERNAL_SECRET in env. Refusing to start.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Liveness — Docker HEALTHCHECK target.
app.get('/internal/health', (_req, res) => {
  res.json({ ok: true, service: 'shanutechx-whatsapp-bot', ts: new Date().toISOString() });
});

// Telemetry & QR Code status endpoint for Admin Panel dashboard
app.get('/internal/status', (req, res) => {
  const secret = req.headers['x-internal-secret'];
  const key = 'shanutechx-whatsapp-gate';
  const isValid =
    typeof secret === 'string' &&
    crypto.timingSafeEqual(
      crypto.createHmac('sha256', key).update(secret).digest(),
      crypto.createHmac('sha256', key).update(INTERNAL_SECRET).digest()
    );
  if (!isValid) return res.status(401).json({ error: 'Unauthorized' });

  res.json(getTelemetryState());
});

app.post('/internal/send', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  const key = 'shanutechx-whatsapp-gate';
  const isValid =
    typeof secret === 'string' &&
    crypto.timingSafeEqual(
      crypto.createHmac('sha256', key).update(secret).digest(),
      crypto.createHmac('sha256', key).update(INTERNAL_SECRET).digest()
    );
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { phoneNumber, message } = req.body || {};
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'phoneNumber and message are required' });
  }

  try {
    await sendNotification(phoneNumber, message);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ phoneNumber, err }, 'Failed to send WhatsApp message');
    res.status(502).json({ error: 'Failed to send message' });
  }
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'WhatsApp bot internal API listening');
});

connect()
  .then((sock) => {
    // Register interactive incoming command listener
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (sender && text) {
          try {
            const reply = await handleCommand(sender, text);
            if (reply) {
              await sendNotification(sender.split('@')[0], reply);
            }
          } catch (err) {
            logger.error({ sender, err }, 'Error handling WhatsApp incoming command');
          }
        }
      }
    });
  })
  .catch((err) => {
    logger.fatal({ err }, 'Failed to connect WhatsApp socket');
    process.exit(1);
  });
