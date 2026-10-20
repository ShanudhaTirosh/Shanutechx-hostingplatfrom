const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { RateLimiter } = require('./utils');

const API_BASE = process.env.API_INTERNAL_URL || 'http://localhost:4000';
const INTERNAL_SECRET = process.env.DISCORD_INTERNAL_SECRET;
const rateLimiter = new RateLimiter(6, 60000); // Max 6 commands per minute per user

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(10000), // never leave an interaction hanging on a stuck API call
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err.message || 'Network request failed' };
  }
}

const STAFF_ROLES = ['Staff', 'Admin', 'Support', 'Developer'];

/**
 * Staff = a role named Staff/Admin/Support/Developer, the DISCORD_STAFF_ROLE_ID role (the same
 * role that is granted access to ticket channels), or the Administrator permission.
 */
function isStaffMember(interaction) {
  const staffRoleId = process.env.DISCORD_STAFF_ROLE_ID;
  return Boolean(
    interaction.member?.roles?.cache?.some((r) => STAFF_ROLES.includes(r.name) || (staffRoleId && r.id === staffRoleId)) ||
      interaction.member?.permissions?.has('Administrator')
  );
}

const NO_PERMISSION = '❌ You do not have permission to execute staff commands.';

const commands = [
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Deploy interactive Support Ticket Panel with category selector')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('open-ticket')
    .setDescription('Create a new customer support ticket in ShanuTechX Platform')
    .addStringOption((opt) => opt.setName('subject').setDescription('Ticket Subject').setRequired(true))
    .addStringOption((opt) => opt.setName('message').setDescription('Detailed issue description').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Category')
        .setRequired(false)
        .addChoices(
          { name: 'Technical Support', value: 'support' },
          { name: 'Billing & Payments', value: 'billing' },
          { name: 'VPS / Hosting Purchase', value: 'purchase' },
          { name: 'Other Query', value: 'other' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('priority')
        .setDescription('Ticket Priority')
        .setRequired(false)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Urgent', value: 'urgent' }
        )
    ),

  new SlashCommandBuilder()
    .setName('claim-ticket')
    .setDescription('Claim an unassigned support ticket')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
    .addBooleanOption((opt) => opt.setName('force').setDescription('Force transfer if claimed').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unclaim-ticket')
    .setDescription('Unclaim a ticket so another staff member can handle it')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('reply-ticket')
    .setDescription('Reply to a customer support ticket from Discord')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
    .addStringOption((opt) => opt.setName('message').setDescription('Reply message text').setRequired(true)),

  new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('Mark a support ticket as resolved/closed with transcript')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Closure reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('tickets-list')
    .setDescription('List open support tickets requiring attention')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Filter by category')
        .setRequired(false)
        .addChoices(
          { name: 'Support', value: 'support' },
          { name: 'Billing', value: 'billing' },
          { name: 'Purchase', value: 'purchase' },
          { name: 'Other', value: 'other' }
        )
    ),

  new SlashCommandBuilder()
    .setName('tickets-search')
    .setDescription('Search support tickets by ID, subject, or customer email')
    .addStringOption((opt) => opt.setName('query').setDescription('Search query').setRequired(true)),

  new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Update ticket priority level')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('level')
        .setDescription('Priority Level')
        .setRequired(true)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Urgent', value: 'urgent' }
        )
    ),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an official announcement embed to a Discord channel')
    .addStringOption((opt) => opt.setName('title').setDescription('Announcement Title').setRequired(true))
    .addStringOption((opt) => opt.setName('message').setDescription('Announcement Message text').setRequired(true))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Target Discord Channel').setRequired(false))
    .addStringOption((opt) => opt.setName('image_url').setDescription('Optional Image URL').setRequired(false))
    .addStringOption((opt) =>
      opt
        .setName('ping')
        .setDescription('Role ping')
        .setRequired(false)
        .addChoices(
          { name: '@everyone', value: '@everyone' },
          { name: '@here', value: '@here' },
          { name: 'None', value: 'none' }
        )
    ),

  new SlashCommandBuilder()
    .setName('send-invoice')
    .setDescription('Generate & dispatch official PDF invoice to a customer')
    .addStringOption((opt) => opt.setName('order_id').setDescription('Order ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('invoices-list')
    .setDescription('List customer invoices and payment status'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check ShanuTechX cluster health & system status'),

  new SlashCommandBuilder()
    .setName('deployments')
    .setDescription('List active application deployments across cluster nodes'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Interactive ShanuTechX Platform Command Guide'),

  new SlashCommandBuilder()
    .setName('review-payment')
    .setDescription('Review and approve or decline a customer manual payment proof')
    .addStringOption((opt) => opt.setName('order_id').setDescription('Order ID to review').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('action')
        .setDescription('Approve or decline')
        .setRequired(true)
        .addChoices({ name: 'Approve', value: 'approve' }, { name: 'Decline', value: 'decline' })
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Decline reason').setRequired(false)),
];

async function handleInteraction(interaction) {
  const userId = interaction.user.id;
  const userLabel = interaction.user.username || interaction.user.tag;

  // Rate Limiter Check
  if (rateLimiter.isRateLimited(userId)) {
    const errorMsg = '[RATE LIMIT] Exceeded. Please wait a minute before running more commands.';
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMsg, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  // 1. Handle Select Menus (Ticket Panel Category Selector)
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_category_select') {
      const selectedCategory = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`modal_open_ticket:${selectedCategory}`)
        .setTitle(`Open ${selectedCategory.toUpperCase()} Ticket`);

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Subject / Short Summary')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. Issue connecting database / Payment query')
        .setRequired(true);

      const messageInput = new TextInputBuilder()
        .setCustomId('ticket_message')
        .setLabel('Detailed Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe your issue in detail...')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(messageInput)
      );

      await interaction.showModal(modal);
      return;
    }
  }

  // 2. Handle Button Clicks
  if (interaction.isButton()) {
    const [action, ticketId] = interaction.customId.split(':');

    // These buttons sit on ticket embeds in channels the *customer* can also see. They were
    // previously unchecked, so a customer could reply "as staff" or close their ticket.
    if (['claim_ticket', 'reply_ticket', 'close_ticket'].includes(action) && !isStaffMember(interaction)) {
      return interaction.reply({ content: NO_PERMISSION, ephemeral: true });
    }

    if (action === 'claim_ticket') {
      await interaction.deferReply({ ephemeral: true });
      const res = await apiFetch('/api/internal/claim-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, staffUserLabel: userLabel, discordUserId: userId }),
      });

      if (res.ok) {
        await interaction.editReply(`[SUCCESS] You claimed ticket #${ticketId.slice(0, 8).toUpperCase()}`);
      } else {
        await interaction.editReply(`[ERROR] Claim failed: ${res.error}`);
      }
    } else if (action === 'reply_ticket') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_reply_ticket:${ticketId}`)
        .setTitle(`Reply to Ticket #${ticketId.slice(0, 8).toUpperCase()}`);

      const input = new TextInputBuilder()
        .setCustomId('reply_text')
        .setLabel('Your Response')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type reply message to customer...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    } else if (action === 'close_ticket') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_close_ticket:${ticketId}`)
        .setTitle(`Close Ticket #${ticketId.slice(0, 8).toUpperCase()}`);

      const input = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Reason for Closing')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. Issue resolved / Customer confirmed')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
    return;
  }

  // 3. Handle Modal Submits
  if (interaction.isModalSubmit()) {
    if (
      (interaction.customId.startsWith('modal_reply_ticket:') || interaction.customId.startsWith('modal_close_ticket:')) &&
      !isStaffMember(interaction)
    ) {
      return interaction.reply({ content: NO_PERMISSION, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_open_ticket:')) {
      const category = interaction.customId.split(':')[1];
      const subject = interaction.fields.getTextInputValue('ticket_subject');
      const message = interaction.fields.getTextInputValue('ticket_message');

      await interaction.deferReply({ ephemeral: true });
      const res = await apiFetch('/api/internal/open-ticket', {
        method: 'POST',
        body: JSON.stringify({
          discordUserId: userId,
          category,
          subject,
          message,
          originPlatform: 'discord',
        }),
      });

      if (res.ok) {
        await interaction.editReply(`[SUCCESS] Support ticket #${res.ticket.id.slice(0, 8).toUpperCase()} created successfully! Staff notified.`);
      } else {
        await interaction.editReply(`[ERROR] Could not open ticket: ${res.error}`);
      }
    } else if (interaction.customId.startsWith('modal_reply_ticket:')) {
      const ticketId = interaction.customId.split(':')[1];
      const replyText = interaction.fields.getTextInputValue('reply_text');

      await interaction.deferReply({ ephemeral: true });
      const res = await apiFetch('/api/internal/reply-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, body: replyText, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`[REPLY] Delivered for ticket #${ticketId.slice(0, 8).toUpperCase()}!`);
      } else {
        await interaction.editReply(`[ERROR] Failed to deliver reply: ${res.error}`);
      }
    } else if (interaction.customId.startsWith('modal_close_ticket:')) {
      const ticketId = interaction.customId.split(':')[1];
      const reason = interaction.fields.getTextInputValue('close_reason');

      await interaction.deferReply({ ephemeral: true });
      const res = await apiFetch('/api/internal/close-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, reason, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`[CLOSED] Ticket #${ticketId.slice(0, 8).toUpperCase()} closed with transcript saved.`);
      } else {
        await interaction.editReply(`[ERROR] Failed to close ticket: ${res.error}`);
      }
    }
    return;
  }

  // 4. Handle Slash Commands
  if (!interaction.isChatInputCommand()) return;

  const isStaff = isStaffMember(interaction);
  const STAFF_COMMANDS = [
    'claim-ticket',
    'unclaim-ticket',
    'close-ticket',
    'reply-ticket',
    'tickets-list', // exposes the whole queue incl. customer emails
    'ticket-panel',
    'announce',
    'send-invoice',
    'review-payment',
  ];
  if (STAFF_COMMANDS.includes(interaction.commandName) && !isStaff) {
    return interaction.reply({
      content: NO_PERMISSION,
      ephemeral: true,
    });
  }

  try {
    const { commandName } = interaction;

    if (commandName === 'ticket-panel') {
      await interaction.deferReply();

      const embed = new EmbedBuilder()
        .setTitle('[SUPPORT PORTAL] ShanuTechX Customer Support')
        .setColor(0x7c3aed)
        .setDescription(
          'Need help with your hosting, VPS, databases, or billing?\nSelect a category below to open a private support ticket with our engineering team.'
        )
        .addFields(
          { name: '[SUPPORT] Technical Support', value: 'Container builds, VPS setup, database connections, SSL', inline: true },
          { name: '[BILLING] Billing & Payments', value: 'Invoice queries, payment proof reviews, subscription renewals', inline: true },
          { name: '[PURCHASE] Purchase / Sales', value: 'Custom spec VPS quotes, enterprise plans, bulk provisioning', inline: true }
        )
        .setFooter({ text: 'ShanuTechX Autonomous Platform Support' });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('Select a Support Category...')
        .addOptions([
          { label: 'Technical Support', value: 'support', description: 'Setup, deployments, VPS, databases' },
          { label: 'Billing & Payments', value: 'billing', description: 'Invoices, payment proofs, subscriptions' },
          { label: 'Purchase / Sales', value: 'purchase', description: 'Custom quotes, server upgrades' },
          { label: 'Other Inquiries', value: 'other', description: 'General questions & feedback' },
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.editReply({ embeds: [embed], components: [row] });
    } else if (commandName === 'open-ticket') {
      await interaction.deferReply({ ephemeral: true });
      const subject = interaction.options.getString('subject');
      const message = interaction.options.getString('message');
      const category = interaction.options.getString('category') || 'support';
      const priority = interaction.options.getString('priority') || 'medium';

      const res = await apiFetch('/api/internal/open-ticket', {
        method: 'POST',
        body: JSON.stringify({
          discordUserId: userId,
          subject,
          category,
          message,
          priority,
          originPlatform: 'discord',
        }),
      });

      if (!res.ok) {
        await interaction.editReply(`[ERROR] Could not open ticket: ${res.error}`);
        return;
      }

      await interaction.editReply(`[SUCCESS] Ticket #${res.ticket.id.slice(0, 8).toUpperCase()} opened! Staff alerted.`);
    } else if (commandName === 'claim-ticket') {
      await interaction.deferReply();
      const ticketId = interaction.options.getString('ticket_id');
      const force = interaction.options.getBoolean('force') || false;

      const res = await apiFetch('/api/internal/claim-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, staffUserLabel: userLabel, force, discordUserId: userId }),
      });

      if (res.ok) {
        await interaction.editReply(`[CLAIMED] Ticket #${ticketId.slice(0, 8).toUpperCase()} claimed by @${userLabel}!`);
      } else {
        await interaction.editReply(`[ERROR] Failed to claim: ${res.error}`);
      }
    } else if (commandName === 'unclaim-ticket') {
      await interaction.deferReply();
      const ticketId = interaction.options.getString('ticket_id');

      const res = await apiFetch('/api/internal/unclaim-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`[UNCLAIMED] Ticket #${ticketId.slice(0, 8).toUpperCase()} returned to open queue.`);
      } else {
        await interaction.editReply(`[ERROR] Unclaim failed: ${res.error}`);
      }
    } else if (commandName === 'reply-ticket') {
      await interaction.deferReply();
      const ticketId = interaction.options.getString('ticket_id');
      const message = interaction.options.getString('message');

      const res = await apiFetch('/api/internal/reply-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, body: message, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`[REPLY] Sent for ticket #${ticketId.slice(0, 8).toUpperCase()}!`);
      } else {
        await interaction.editReply(`[ERROR] Failed to send reply: ${res.error}`);
      }
    } else if (commandName === 'close-ticket') {
      await interaction.deferReply();
      const ticketId = interaction.options.getString('ticket_id');
      const reason = interaction.options.getString('reason') || 'Resolved';

      const res = await apiFetch('/api/internal/close-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, reason, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`[CLOSED] Ticket #${ticketId.slice(0, 8).toUpperCase()} closed.`);
      } else {
        await interaction.editReply(`[ERROR] Failed to close ticket: ${res.error}`);
      }
    } else if (commandName === 'tickets-list') {
      await interaction.deferReply();
      const category = interaction.options.getString('category');
      const res = await apiFetch(`/api/internal/open-tickets${category ? `?category=${category}` : ''}`);

      if (!res.ok || !res.tickets || res.tickets.length === 0) {
        await interaction.editReply('No open support tickets matching criteria.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('[TICKETS] Active Support Queue')
        .setColor(0x06b6d4)
        .setDescription(
          res.tickets
            .map(
              (t) =>
                `• **#${t.id.slice(0, 8).toUpperCase()}** [${t.category.toUpperCase()}] — ${t.subject} (${
                  t.user?.email || 'Customer'
                }) ${t.claimedBy ? `[Claimed: ${t.claimedBy.displayName || t.claimedBy.email}]` : ''}`
            )
            .join('\n')
        );

      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'announce') {
      await interaction.deferReply();
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      const channel = interaction.options.getChannel('channel');
      const imageUrl = interaction.options.getString('image_url');
      const ping = interaction.options.getString('ping');

      const targetChannelId = channel ? channel.id : process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID || process.env.ADMIN_ALERT_CHANNEL_ID;

      const res = await apiFetch('/api/internal/announcements/send', {
        method: 'POST',
        body: JSON.stringify({
          title,
          message,
          targetPlatform: 'both',
          channelId: targetChannelId,
          imageUrl,
          rolePing: ping === 'none' ? null : ping,
        }),
      });

      if (res.ok) {
        await interaction.editReply(`[ANNOUNCEMENT] **"${title}"** dispatched successfully to Discord & WhatsApp!`);
      } else {
        await interaction.editReply(`[ERROR] Announcement dispatch failed: ${res.error}`);
      }
    } else if (commandName === 'send-invoice') {
      await interaction.deferReply();
      const orderId = interaction.options.getString('order_id');

      const res = await apiFetch('/api/internal/invoices/generate-and-send', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });

      if (res.ok) {
        await interaction.editReply(`[INVOICE] Official PDF Invoice generated & dispatched for Order #${orderId.slice(0, 8).toUpperCase()}`);
      } else {
        await interaction.editReply(`[ERROR] Failed to send invoice: ${res.error}`);
      }
    } else if (commandName === 'review-payment') {
      await interaction.deferReply();
      const orderId = interaction.options.getString('order_id');
      const action = interaction.options.getString('action');
      const reason = interaction.options.getString('reason');

      const isApprove = action === 'approve';
      const res = await apiFetch('/api/internal/review-payment', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          approve: isApprove,
          reason,
          reviewedBy: `Discord:@${userLabel}`,
        }),
      });

      if (res.ok) {
        await interaction.editReply(
          `[PAYMENT REVIEW] Order #${orderId.slice(0, 8).toUpperCase()} successfully **${isApprove ? 'APPROVED' : 'DECLINED'}**!`
        );
      } else {
        await interaction.editReply(`[ERROR] Review failed: ${res.error}`);
      }
    } else if (commandName === 'status') {
      await interaction.deferReply();
      const health = await apiFetch('/api/health');

      const embed = new EmbedBuilder()
        .setTitle('[STATUS] ShanuTechX Platform Cluster')
        .setColor(health?.ok ? 0x22c55e : 0xef4444)
        .addFields(
          { name: 'Cluster Status', value: health?.ok ? 'ONLINE' : 'DEGRADED', inline: true },
          { name: 'Environment', value: process.env.NODE_ENV || 'production', inline: true },
          { name: 'Timestamp', value: new Date().toLocaleString(), inline: false }
        )
        .setFooter({ text: 'ShanuTechX Operations Console' });

      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'help') {
      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('[COMMANDS] ShanuTechX Discord Bot Guide')
        .setColor(0x3b82f6)
        .setDescription('Complete guide to available slash commands and features.')
        .addFields(
          {
            name: '[CUSTOMER] Commands',
            value: '• `/open-ticket` - Open new support ticket\n• `/status` - Check platform health',
          },
          {
            name: '[STAFF] Operations',
            value:
              '• `/ticket-panel` - Deploy interactive ticket panel\n• `/claim-ticket` - Claim an unassigned ticket\n• `/unclaim-ticket` - Return ticket to queue\n• `/reply-ticket` - Reply to customer ticket\n• `/close-ticket` - Close ticket with transcript\n• `/tickets-list` - View open ticket queue',
          },
          {
            name: '[BROADCAST] Invoicing & Announcements',
            value: '• `/announce` - Post rich announcement\n• `/send-invoice` - Dispatch PDF invoice to customer\n• `/review-payment` - Approve/Decline manual payment proof',
          }
        );

      await interaction.editReply({ embeds: [embed] });
    } else {
      // e.g. /deployments and /invoices-list are registered but have no handler yet; without a
      // reply Discord shows "The application did not respond".
      await interaction.reply({ content: `\`/${commandName}\` is not available yet.`, ephemeral: true });
    }
  } catch (err) {
    console.error('Failed handling Discord command:', err);
    // After deferReply() a silent failure leaves the user staring at "thinking..." - always answer.
    const failure = '[ERROR] Something went wrong while running that command. Please try again.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(failure);
      else await interaction.reply({ content: failure, ephemeral: true });
    } catch (_) {}
  }
}

module.exports = { commands, handleInteraction };
