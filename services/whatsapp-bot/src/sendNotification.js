const { getSocket } = require('./connection');

// Simple in-memory FIFO queue with a fixed minimum gap between sends.
// This is the "don't mass-blast" guardrail: even if the API enqueues 100
// notifications at once, WhatsApp only ever sees them trickle out one by one.
const queue = [];
const MIN_GAP_MS = 3000; // at most ~20 messages/minute
let processing = false;

function toJid(phoneNumber) {
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
  return `${digitsOnly}@s.whatsapp.net`;
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const { phoneNumber, message, resolve, reject } = queue.shift();
    try {
      const sock = getSocket();
      await sock.sendMessage(toJid(phoneNumber), { text: message });
      resolve();
    } catch (err) {
      reject(err);
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

module.exports = { sendNotification };
