const crypto = require('crypto');
const express = require('express');
const { connect, getSocket, logger } = require('./connection');
const { sendNotification } = require('./sendNotification');

const PORT = process.env.WHATSAPP_PORT || 4100;
const INTERNAL_SECRET = process.env.WHATSAPP_INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  logger.fatal('Missing WHATSAPP_INTERNAL_SECRET in env. Refusing to start.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Liveness — Docker HEALTHCHECK target. Deliberately no auth (matches
// /internal/send's own network-isolation model — see that route's comment).
app.get('/internal/health', (_req, res) => {
  res.json({ ok: true, service: 'shanutechx-whatsapp-bot', ts: new Date().toISOString() });
});

// This route is for the main API only. Do NOT put it behind a public
// Cloudflare/Traefik route — bind it to localhost or an internal Docker
// network in infra/docker-compose.yml.
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

// Audit finding H3: binding to 127.0.0.1 *inside a container* only
// accepts connections from within that same container's own network
// namespace -- it does NOT accept connections from sibling containers on
// the same Docker network, even via Compose's service-name DNS. Since
// apps/api reaches this service as a separate container
// (WHATSAPP_BOT_URL=http://whatsapp-bot:4100 in docker-compose), binding
// to loopback here silently broke every WhatsApp notification (the
// caller catches the connection failure and only logs a warning -- see
// lib/notifications.ts). This service is still never exposed to the host
// or the internet: it's simply not published on a host port in
// docker-compose.local.yml, so binding all interfaces here is safe and
// only reachable from other containers on the same internal Docker
// network.
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'WhatsApp bot internal API listening');
});

connect().catch((err) => {
  logger.fatal({ err }, 'Failed to connect WhatsApp socket');
  process.exit(1);
});
