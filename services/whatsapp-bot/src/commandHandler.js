const fetch = require('node-fetch');

const API_BASE = process.env.API_INTERNAL_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.WHATSAPP_INTERNAL_SECRET;

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  } catch (err) {
    return null;
  }
}

async function handleCommand(senderPhone, messageText) {
  const text = messageText.trim();

  if (text.startsWith('!status') || text.startsWith('/status')) {
    const health = await apiFetch('/api/health');
    if (!health) return '[WARNING] *ShanuTechX Platform*: Health check endpoint offline.';
    return `*ShanuTechX System Status*\n\n• *Status*: ${health.ok ? '[ONLINE]' : '[DEGRADED]'}\n• *Timestamp*: ${new Date().toLocaleString()}\n• *API Base*: ${API_BASE}`;
  }

  if (text.startsWith('!deployments') || text.startsWith('/deployments')) {
    const cleanPhone = senderPhone.replace(/[^0-9]/g, '');
    const data = await apiFetch(`/api/internal/customer-summary?phone=${encodeURIComponent(cleanPhone)}`);

    if (!data || !data.deployments || data.deployments.length === 0) {
      return `*ShanuTechX Deployments*\n\nNo active deployments found linked to phone number (+${cleanPhone}).`;
    }

    const list = data.deployments
      .map((d) => `• *${d.name}*: ${d.status.toUpperCase()} (${d.publicUrl || 'internal'})`)
      .join('\n');
    return `*Your Active Deployments*\n\n${list}`;
  }

  if (text.startsWith('!tickets') || text.startsWith('/tickets')) {
    const cleanPhone = senderPhone.replace(/[^0-9]/g, '');
    const data = await apiFetch(`/api/internal/customer-summary?phone=${encodeURIComponent(cleanPhone)}`);

    if (!data || !data.tickets || data.tickets.length === 0) {
      return `*ShanuTechX Support Tickets*\n\nNo open support tickets linked to (+${cleanPhone}).`;
    }

    const list = data.tickets
      .map((t) => `• *#${t.id.slice(0, 8).toUpperCase()}*: ${t.subject} [${t.status.toUpperCase()}]`)
      .join('\n');
    return `*Your Open Support Tickets*\n\n${list}`;
  }

  if (text.startsWith('!help') || text.startsWith('/help') || text === 'help' || text === 'hi' || text === 'hello') {
    return `*ShanuTechX Bot Commands*\n\n• *!status* - System cluster health\n• *!deployments* - List your application deployments\n• *!tickets* - Check your support tickets\n• *!help* - Show command list\n\nNeed technical assistance? Open a ticket at https://${process.env.ROOT_DOMAIN || 'shanutechx.com'}/tickets`;
  }

  return null; // Not a recognized command
}

module.exports = { handleCommand };
