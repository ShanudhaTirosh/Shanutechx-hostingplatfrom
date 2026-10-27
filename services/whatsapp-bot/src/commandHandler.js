const { RateLimiter } = require('./utils');

const API_BASE = process.env.API_INTERNAL_URL || 'http://localhost:4000';
const INTERNAL_SECRET = process.env.WHATSAPP_INTERNAL_SECRET;

const rateLimiter = new RateLimiter(6, 60000); // 6 commands per minute per phone

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(10000), // never let a hung API stall the bot
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { _error: true, status: res.status, error: errBody.error || 'Request failed' };
    }
    return res.json().catch(() => ({}));
  } catch (err) {
    return { _error: true, status: 500, error: err.message };
  }
}

// In-memory state machine for interactive ticket creation menus per phone number.
// Entries expire so a forgotten menu can't capture a user's messages days later.
const userPendingMenu = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000;

function setPending(phone, state) {
  if (userPendingMenu.size > 1000) {
    const now = Date.now();
    for (const [k, v] of userPendingMenu) if (now - v.at > PENDING_TTL_MS) userPendingMenu.delete(k);
  }
  userPendingMenu.set(phone, { ...state, at: Date.now() });
}

// Send the anti-spam notice at most once per window, otherwise a flooder
// makes the bot reply to every message and clogs the outbound queue.
const spamWarnedAt = new Map();

async function isStaffUser(phone) {
  const data = await apiFetch(`/api/internal/customer-summary?phone=${encodeURIComponent(phone)}`);
  return Boolean(data && data.user && ['admin', 'dev', 'support'].includes(data.user.role));
}

const FAQ_RESPONSES = {
  deploy: `*Deploying Apps on ShanuTechX*\n\n1. Log into https://${process.env.ROOT_DOMAIN || 'shanutechx.com'}/dashboard\n2. Click *New Deployment* and select your Git repository or Docker image.\n3. Configure your environment variables and port exposure.\n4. Click *Deploy*! Autonomous container provisioning takes under 30 seconds.`,
  database: `*Managed Databases*\n\nShanuTechX supports one-click provisioning for PostgreSQL 16, MySQL 8, Redis, and MongoDB.\nVisit Dashboard -> Databases Hub to launch a managed database or self-hosted Supabase stack instantly.`,
  ssh: `*Interactive Web SSH*\n\nAccess your host node terminal directly in browser via Dashboard -> Compute Nodes -> Terminal. WebSockets SSH with xterm.js encryption is active by default.`,
  domain: `*Custom Domains & Port Exposure*\n\nEvery project automatically gets a Cloudflare DNS sub-domain (\`node-label.rootDomain\`). You can attach custom domains and map custom ports under Dashboard -> Port Exposures.`,
  pricing: `*ShanuTechX Pricing*\n\n• Micro Node: \$5/mo (1 vCPU, 1GB RAM, 20GB SSD)\n• Standard Node: \$15/mo (2 vCPU, 4GB RAM, 80GB SSD)\n• High-Performance Node: \$35/mo (4 vCPU, 8GB RAM, 160GB SSD)\nVisit https://${process.env.ROOT_DOMAIN || 'shanutechx.com'}/pricing for details.`,
};

async function handleCommand(senderPhone, messageText) {
  const trimmed = String(messageText || '').trim();
  // Phone keyboards auto-capitalise ("!Status", "Hi"): make only the command word
  // case-insensitive and leave the arguments untouched.
  const cmd = trimmed.match(/^([!/]\S+)([\s\S]*)$/);
  const text = cmd ? cmd[1].toLowerCase() + cmd[2] : trimmed;
  // "9477...:12@s.whatsapp.net" -> strip the companion-device suffix before taking digits.
  const cleanPhone = String(senderPhone).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;

  if (rateLimiter.isRateLimited(cleanPhone)) {
    const now = Date.now();
    if (spamWarnedAt.size > 1000) {
      for (const [k, t] of spamWarnedAt) if (now - t > 60000) spamWarnedAt.delete(k);
    }
    if (now - (spamWarnedAt.get(cleanPhone) || 0) < 60000) return null;
    spamWarnedAt.set(cleanPhone, now);
    return `[ANTI-SPAM] You are sending commands too fast. Please wait a minute.`;
  }

  // A real command always wins over (and cancels) a half-finished ticket menu,
  // instead of being swallowed as an "invalid category".
  if (userPendingMenu.has(cleanPhone) && /^[!/]/.test(text)) {
    userPendingMenu.delete(cleanPhone);
  }
  const pendingEntry = userPendingMenu.get(cleanPhone);
  if (pendingEntry && Date.now() - pendingEntry.at > PENDING_TTL_MS) {
    userPendingMenu.delete(cleanPhone);
  }

  // Handle pending interactive menu choice for tickets
  if (userPendingMenu.has(cleanPhone)) {
    const pending = userPendingMenu.get(cleanPhone);

    if (pending.step === 'SELECT_CATEGORY') {
      const choice = text.trim();
      const categories = { '1': 'support', '2': 'billing', '3': 'purchase', '4': 'other' };
      if (categories[choice]) {
        const category = categories[choice];
        setPending(cleanPhone, { step: 'ENTER_DETAILS', category });
        return `Selected category: *${category.toUpperCase()}*\n\nPlease reply with your ticket subject and details in this format:\n\`Subject | Detailed message\``;
      } else {
        userPendingMenu.delete(cleanPhone);
        return `Invalid category selection. Ticket creation cancelled. Type \`!ticket\` to try again.`;
      }
    }

    if (pending.step === 'ENTER_DETAILS') {
      const parts = text.split('|');
      const subject = parts[0]?.trim() || `Ticket from WhatsApp (+${cleanPhone})`;
      const message = parts[1]?.trim() || parts[0]?.trim() || 'No description provided';
      userPendingMenu.delete(cleanPhone);

      const res = await apiFetch('/api/internal/open-ticket', {
        method: 'POST',
        body: JSON.stringify({
          phone: cleanPhone,
          category: pending.category,
          subject,
          message,
          originPlatform: 'whatsapp',
        }),
      });

      if (res._error) {
        return `Failed to create ticket: ${res.error}`;
      }
      if (!res.ticket) return `Failed to create ticket: unexpected response from the platform.`;

      return `*Support Ticket Created Successfully!*\n\n• *Ticket ID*: \`#${res.ticket.id.slice(0, 8).toUpperCase()}\`\n• *Category*: ${res.ticket.category.toUpperCase()}\n• *Subject*: ${res.ticket.subject}\n• *Status*: OPEN\n\nA support agent will reply shortly. You can send replies to this ticket using:\n\`!reply ${res.ticket.id.slice(0, 8)} your message\``;
    }
  }

  // 1. Status Command
  if (text.startsWith('!status') || text.startsWith('/status')) {
    const health = await apiFetch('/api/health');
    if (health._error) return '[WARNING] *ShanuTechX Platform*: Health check endpoint offline.';
    return `*ShanuTechX System Status*\n\n• *Status*: ${health.ok ? '[ONLINE]' : '[DEGRADED]'}\n• *Timestamp*: ${new Date().toLocaleString()}\n• *API Base*: ${API_BASE}`;
  }

  // 2. Deployments Command
  if (text.startsWith('!deployments') || text.startsWith('/deployments')) {
    const data = await apiFetch(`/api/internal/customer-summary?phone=${encodeURIComponent(cleanPhone)}`);
    if (data._error || !data.deployments || data.deployments.length === 0) {
      return `*ShanuTechX Deployments*\n\nNo active deployments found linked to (+${cleanPhone}).`;
    }
    const list = data.deployments
      .map((d) => `• *${d.name || d.subdomain || d.id}*: ${String(d.status).toUpperCase()} (${d.publicUrl || d.customDomain || 'internal'})`)
      .join('\n');
    return `*Your Active Deployments*\n\n${list}`;
  }

  // 3. Ticket Interactive Menu & Commands
  if (text === '!ticket' || text === '/ticket' || text.toLowerCase() === '!ticket open') {
    setPending(cleanPhone, { step: 'SELECT_CATEGORY' });
    return `*ShanuTechX Support Ticket System*\n\nPlease select a ticket category by replying with a number:\n\n1. *Support* - Technical issues & container errors\n2. *Billing* - Invoices, payments & subscriptions\n3. *Purchase* - Plan upgrades & new orders\n4. *Other* - General inquiries\n\nOr open directly using:\n\`!ticket open [category] [subject] | [message]\``;
  }

  if (text.startsWith('!ticket open ')) {
    const body = text.slice('!ticket open '.length).trim();
    const parts = body.split(' ');
    const categoryInput = parts[0]?.toLowerCase();
    const validCategories = ['support', 'billing', 'purchase', 'other'];
    let category = 'support';
    let restText = body;

    if (validCategories.includes(categoryInput)) {
      category = categoryInput;
      restText = parts.slice(1).join(' ');
    }

    const detailParts = restText.split('|');
    const subject = detailParts[0]?.trim() || `Ticket from WhatsApp (+${cleanPhone})`;
    const message = detailParts[1]?.trim() || detailParts[0]?.trim() || 'No description provided';

    const res = await apiFetch('/api/internal/open-ticket', {
      method: 'POST',
      body: JSON.stringify({
        phone: cleanPhone,
        category,
        subject,
        message,
        originPlatform: 'whatsapp',
      }),
    });

    if (res._error) {
      return `Failed to create ticket: ${res.error}`;
    }
    if (!res.ticket) return `Failed to create ticket: unexpected response from the platform.`;

    return `*Support Ticket Created Successfully!*\n\n• *Ticket ID*: \`#${res.ticket.id.slice(0, 8).toUpperCase()}\`\n• *Category*: ${res.ticket.category.toUpperCase()}\n• *Subject*: ${res.ticket.subject}\n• *Status*: OPEN\n\nA support agent will reply shortly. You can send replies using:\n\`!reply ${res.ticket.id.slice(0, 8)} your message\``;
  }

  // 4. Ticket List Command
  if (text.startsWith('!tickets') || text.startsWith('/tickets')) {
    const data = await apiFetch(`/api/internal/customer-summary?phone=${encodeURIComponent(cleanPhone)}`);
    if (data._error || !data.tickets || data.tickets.length === 0) {
      return `*ShanuTechX Support Tickets*\n\nNo open support tickets linked to (+${cleanPhone}).`;
    }
    const list = data.tickets
      .map((t) => `• *#${t.id.slice(0, 8).toUpperCase()}*: ${t.subject} [${t.status.toUpperCase()}]`)
      .join('\n');
    return `*Your Open Support Tickets*\n\n${list}`;
  }

  // 5. Reply to Ticket Command
  if (text.startsWith('!reply ')) {
    const body = text.slice('!reply '.length).trim();
    const spaceIdx = body.indexOf(' ');
    if (spaceIdx === -1) {
      return `Usage: \`!reply [ticketId] [your message]\``;
    }
    const ticketId = body.slice(0, spaceIdx).trim();
    const replyMessage = body.slice(spaceIdx + 1).trim();

    const res = await apiFetch('/api/internal/reply-ticket', {
      method: 'POST',
      body: JSON.stringify({
        ticketId,
        senderPhone: cleanPhone,
        body: replyMessage,
        senderRole: 'customer',
        originPlatform: 'whatsapp',
      }),
    });

    if (res._error) {
      return `Failed to post reply: ${res.error}`;
    }

    return `*Reply sent to ticket #${ticketId.slice(0, 8).toUpperCase()}*`;
  }

  // 6. Rate Closed Ticket Command
  if (text.startsWith('!rate ')) {
    const body = text.slice('!rate '.length).trim();
    const parts = body.split(' ');
    const ticketId = parts[0]?.trim();
    const ratingStr = parts[1]?.trim();
    const feedback = parts.slice(2).join(' ').trim();

    const rating = parseInt(ratingStr, 10);
    if (!ticketId || isNaN(rating) || rating < 1 || rating > 5) {
      return `Usage: \`!rate [ticketId] [1-5] [optional feedback]\` (e.g., \`!rate abc12345 5 Great support!\`)`;
    }

    const res = await apiFetch('/api/internal/rate-ticket', {
      method: 'POST',
      body: JSON.stringify({
        ticketId,
        rating,
        feedback,
        senderPhone: cleanPhone,
      }),
    });

    if (res._error) {
      return `Failed to record feedback: ${res.error}`;
    }

    return `Thank you! Your ${rating}-star rating has been recorded for ticket #${ticketId.slice(0, 8).toUpperCase()}.`;
  }

  // 7. Staff Commands (Claim, Unclaim, Close, Broadcast, Invoice)
  const isStaffCommand =
    text.startsWith('!claim ') ||
    text.startsWith('!unclaim ') ||
    text.startsWith('!close ') ||
    text.startsWith('!broadcast ') ||
    text.startsWith('!invoice ');

  if (isStaffCommand) {
    const isStaff = await isStaffUser(cleanPhone);
    if (!isStaff) {
      return `[Access Denied] This command is restricted to ShanuTechX staff members.`;
    }
  }

  if (text.startsWith('!claim ')) {
    const [ticketId, ...claimFlags] = text.slice('!claim '.length).trim().split(/\s+/);
    const res = await apiFetch('/api/internal/claim-ticket', {
      method: 'POST',
      body: JSON.stringify({ ticketId, staffPhone: cleanPhone, force: claimFlags.includes('--force') }),
    });
    if (res._error) return `Failed to claim ticket: ${res.error}`;
    return `*Ticket #${ticketId.slice(0, 8).toUpperCase()} Claimed Successfully*`;
  }

  if (text.startsWith('!unclaim ')) {
    const ticketId = text.slice('!unclaim '.length).trim();
    const res = await apiFetch('/api/internal/unclaim-ticket', {
      method: 'POST',
      body: JSON.stringify({ ticketId, staffPhone: cleanPhone }),
    });
    if (res._error) return `Failed to unclaim ticket: ${res.error}`;
    return `*Ticket #${ticketId.slice(0, 8).toUpperCase()} Unclaimed*`;
  }

  if (text.startsWith('!close ')) {
    const body = text.slice('!close '.length).trim();
    const parts = body.split(' ');
    const ticketId = parts[0]?.trim();
    const reason = parts.slice(1).join(' ').trim() || 'Resolved by staff via WhatsApp';

    const res = await apiFetch('/api/internal/close-ticket', {
      method: 'POST',
      body: JSON.stringify({ ticketId, reason, closedBy: `whatsapp:${cleanPhone}` }),
    });
    if (res._error) return `Failed to close ticket: ${res.error}`;
    return `*Ticket #${ticketId.slice(0, 8).toUpperCase()} Closed*`;
  }

  if (text.startsWith('!broadcast ')) {
    const message = text.slice('!broadcast '.length).trim();
    const res = await apiFetch('/api/internal/announcements/send', {
      method: 'POST',
      body: JSON.stringify({
        targetPlatform: 'whatsapp',
        title: 'Platform Announcement',
        message,
        authorName: `Staff (+${cleanPhone})`,
      }),
    });
    if (res._error) return `Broadcast failed: ${res.error}`;
    const queued = res.deliveredCount || 0;
    if (res.truncated) {
      // Broadcasts are capped (WhatsApp throttles bulk senders): never let staff think everyone got it.
      return `*WhatsApp Broadcast Queued* - only ${queued} of ${res.totalRecipients} customers (per-broadcast limit reached). The rest did NOT receive it.`;
    }
    return `*WhatsApp Broadcast Queued Successfully* (${queued} recipients)`;
  }

  if (text.startsWith('!invoice ')) {
    const body = text.slice('!invoice '.length).trim();
    const parts = body.split(' ');
    const userEmail = parts[0];
    const amount = parseFloat(parts[1]);
    const description = parts.slice(2).join(' ') || 'Platform Hosting Service';

    if (!userEmail || !Number.isFinite(amount) || amount <= 0) {
      return `Usage: \`!invoice [userEmail] [amount] [description]\``;
    }

    const res = await apiFetch('/api/internal/invoices/generate-and-send', {
      method: 'POST',
      body: JSON.stringify({
        userEmail,
        items: [{ name: description, amount, quantity: 1 }],
        createdBy: `whatsapp:${cleanPhone}`,
      }),
    });

    if (res._error) return `Invoice delivery failed: ${res.error}`;
    return `*Invoice #${(res.invoiceId || res.orderId || '').slice(0, 8).toUpperCase()} Generated & Sent to ${userEmail}*`;
  }

  // 8. FAQ Auto-replies & Knowledge Base
  const lowerText = text.toLowerCase();
  for (const [kw, resp] of Object.entries(FAQ_RESPONSES)) {
    if (lowerText.includes(kw)) {
      return resp;
    }
  }

  // 9. Help Command
  if (text.startsWith('!help') || text.startsWith('/help') || lowerText === 'help' || lowerText === 'hi' || lowerText === 'hello') {
    return `*ShanuTechX WhatsApp Virtual Assistant*\n\n` +
      `*Customer Commands:*\n` +
      `• *!status* - Check cloud cluster system health\n` +
      `• *!deployments* - List your container deployments\n` +
      `• *!ticket* - Interactive menu to open a support ticket\n` +
      `• *!ticket open [category] [subject] | [message]* - Quick open ticket\n` +
      `• *!tickets* - List your open tickets\n` +
      `• *!reply [ticketId] [message]* - Send reply to ticket\n` +
      `• *!rate [ticketId] [1-5] [feedback]* - Rate resolved ticket\n` +
      `• *!help* - Show this command list\n\n` +
      `*Staff Commands:*\n` +
      `• *!claim [ticketId]* - Claim a support ticket\n` +
      `• *!unclaim [ticketId]* - Release ticket claim\n` +
      `• *!close [ticketId] [reason]* - Close ticket\n` +
      `• *!broadcast [message]* - Send WhatsApp broadcast\n` +
      `• *!invoice [email] [amount] [desc]* - Generate PDF invoice\n\n` +
      `Need more help? Visit https://${process.env.ROOT_DOMAIN || 'shanutechx.com'}`;
  }

  return null; // Not a recognized command or keyword
}

module.exports = { handleCommand };
