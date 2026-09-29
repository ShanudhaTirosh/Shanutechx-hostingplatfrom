const { getSocket } = require('./connection');

// Simple in-memory FIFO queue with a fixed minimum gap between sends.
// This is the "don't mass-blast" guardrail: even if the API enqueues 100
// notifications at once, WhatsApp only ever sees them trickle out one by one.
const queue = [];
const MIN_GAP_MS = 2500; // at most ~24 messages/minute
let processing = false;

function toJid(phoneNumber) {
  if (typeof phoneNumber !== 'string') return '';
  if (phoneNumber.endsWith('@s.whatsapp.net') || phoneNumber.endsWith('@g.us')) {
    return phoneNumber;
  }
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
  if (!digitsOnly) return '';
  return `${digitsOnly}@s.whatsapp.net`;
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue[0];
    const jid = toJid(item.phoneNumber);

    if (!jid) {
      queue.shift();
      item.reject(new Error(`Invalid WhatsApp phone number: ${item.phoneNumber}`));
      continue;
    }

    try {
      const sock = getSocket();
      await sock.sendMessage(jid, { text: item.message });
      queue.shift();
      item.resolve();
    } catch (err) {
      item.retries = (item.retries || 0) + 1;
      if (err.message && err.message.includes('not connected') && item.retries <= 5) {
        // Socket temporarily reconnecting — pause queue and retry up to 5 times
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      queue.shift();
      item.reject(err);
    }
    await new Promise((r) => setTimeout(r, MIN_GAP_MS));
  }

  processing = false;
}

/** Enqueue a notification. Resolves once it's actually been sent. */
function sendNotification(phoneNumber, message) {
  return new Promise((resolve, reject) => {
    queue.push({ phoneNumber, message, resolve, reject });
    processQueue();
  });
}

module.exports = { sendNotification, toJid };
