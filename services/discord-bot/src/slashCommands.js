const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const fetch = globalThis.fetch;

const API_BASE = process.env.API_INTERNAL_URL || 'http://localhost:4000';
const INTERNAL_SECRET = process.env.DISCORD_INTERNAL_SECRET;

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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err.message || 'Network request failed' };
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check ShanuTechX cluster health & system status'),

  new SlashCommandBuilder()
    .setName('deployments')
    .setDescription('List active application deployments across cluster nodes'),

  new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('List open customer support tickets requiring attention'),

  new SlashCommandBuilder()
    .setName('open-ticket')
    .setDescription('Create a new customer support ticket in ShanuTechX Platform')
    .addStringOption((opt) => opt.setName('subject').setDescription('Ticket Subject').setRequired(true))
    .addStringOption((opt) => opt.setName('message').setDescription('Detailed issue description').setRequired(true))
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
    .setName('reply-ticket')
    .setDescription('Reply to a customer support ticket from Discord')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
    .addStringOption((opt) => opt.setName('message').setDescription('Reply message text').setRequired(true)),

  new SlashCommandBuilder()
    .setName('claim-ticket')
    .setDescription('Claim an unassigned support ticket')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('Mark a support ticket as resolved/closed')
    .addStringOption((opt) => opt.setName('ticket_id').setDescription('Ticket ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('review-payment')
    .setDescription('Review and approve or decline a customer manual payment proof')
    .addStringOption((opt) => opt.setName('order_id').setDescription('Order ID to review').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('action')
        .setDescription('Approve or decline the payment')
        .setRequired(true)
        .addChoices({ name: 'Approve', value: 'approve' }, { name: 'Decline', value: 'decline' })
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Decline reason (required if declining)').setRequired(false)),
];

const ALLOWED_DISCORD_ROLES = process.env.ALLOWED_DISCORD_ROLES ? process.env.ALLOWED_DISCORD_ROLES.split(',').map((s) => s.trim()) : [];
const ALLOWED_DISCORD_USERS = process.env.ALLOWED_DISCORD_USERS ? process.env.ALLOWED_DISCORD_USERS.split(',').map((s) => s.trim()) : [];

function isStaffAuthorized(member, user) {
  if (!member && !user) return false;
  const hasUserList = ALLOWED_DISCORD_USERS.length > 0;
  const hasRoleList = ALLOWED_DISCORD_ROLES.length > 0;

  if (hasUserList && ALLOWED_DISCORD_USERS.includes(user.id)) return true;
  if (hasRoleList && member?.roles?.cache) {
    return member.roles.cache.some((role) => ALLOWED_DISCORD_ROLES.includes(role.id) || ALLOWED_DISCORD_ROLES.includes(role.name));
  }
  return true; // Default fallback to allow staff commands if unconfigured in dev
}

async function handleInteraction(interaction) {
  // Handle Button Clicks
  if (interaction.isButton()) {
    const [action, ticketId] = interaction.customId.split(':');
    const userLabel = interaction.user.username || interaction.user.tag;

    if (action === 'claim_ticket') {
      await interaction.deferReply({ ephemeral: true });
      const res = await apiFetch('/api/internal/claim-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`✅ You claimed ticket #${ticketId.slice(0, 8).toUpperCase()}`);
      } else {
        await interaction.editReply(`❌ Failed to claim ticket: ${res.error}`);
      }
    } else if (action === 'reply_ticket') {
      // Pop open Modal for reply text
      const modal = new ModalBuilder()
        .setCustomId(`modal_reply_ticket:${ticketId}`)
        .setTitle(`Reply to Ticket #${ticketId.slice(0, 8).toUpperCase()}`);

      const input = new TextInputBuilder()
        .setCustomId('reply_text')
        .setLabel('Your Reply Message')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type your response to the customer...')
        .setRequired(true);

      const firstRow = new ActionRowBuilder().addComponents(input);
      modal.addComponents(firstRow);
      await interaction.showModal(modal);
    } else if (action === 'close_ticket') {
      await interaction.deferReply({ ephemeral: true });
      const res = await apiFetch('/api/internal/close-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`🔒 Ticket #${ticketId.slice(0, 8).toUpperCase()} closed successfully.`);
      } else {
        await interaction.editReply(`❌ Failed to close ticket: ${res.error}`);
      }
    }
    return;
  }

  // Handle Modal Submits
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('modal_reply_ticket:')) {
      const ticketId = interaction.customId.split(':')[1];
      const replyText = interaction.fields.getTextInputValue('reply_text');
      const userLabel = interaction.user.username || interaction.user.tag;

      await interaction.deferReply({ ephemeral: true });
      const res = await apiFetch('/api/internal/reply-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, body: replyText, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`💬 Reply sent for ticket #${ticketId.slice(0, 8).toUpperCase()}!`);
      } else {
        await interaction.editReply(`❌ Failed to send reply: ${res.error}`);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName } = interaction;
    const userLabel = interaction.user.username || interaction.user.tag;

    if (commandName === 'status') {
      await interaction.deferReply();
      const health = await apiFetch('/api/health');

      const embed = new EmbedBuilder()
        .setTitle('⚡ ShanuTechX Cluster Status')
        .setColor(health?.ok ? 0x22c55e : 0xef4444)
        .addFields(
          { name: 'Cluster Health', value: health?.ok ? 'ONLINE' : 'DEGRADED', inline: true },
          { name: 'Environment', value: process.env.NODE_ENV || 'production', inline: true },
          { name: 'Checked At', value: new Date().toLocaleString(), inline: false }
        )
        .setFooter({ text: 'ShanuTechX Operations Console' });

      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'deployments') {
      await interaction.deferReply();
      const data = await apiFetch('/api/internal/all-deployments');

      if (!data || !data.deployments || data.deployments.length === 0) {
        await interaction.editReply('No active deployments found in cluster.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🚀 Active Cluster Deployments')
        .setColor(0x7c3aed)
        .setDescription(
          data.deployments
            .slice(0, 15)
            .map((d) => `• **${d.name}** [${d.status.toUpperCase()}] — ${d.node?.label || 'Node unassigned'}`)
            .join('\n')
        )
        .setFooter({ text: `Showing top 15 of ${data.deployments.length} deployments` });

      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'tickets') {
      await interaction.deferReply();
      const data = await apiFetch('/api/internal/open-tickets');

      if (!data || !data.tickets || data.tickets.length === 0) {
        await interaction.editReply('No open support tickets right now.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎫 Open Support Tickets')
        .setColor(0x06b6d4)
        .setDescription(
          data.tickets
            .map((t) => `• **#${t.id.slice(0, 8).toUpperCase()}**: ${t.subject} (${t.user?.email || 'Customer'})`)
            .join('\n')
        );

      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'open-ticket') {
      await interaction.deferReply();
      const subject = interaction.options.getString('subject');
      const message = interaction.options.getString('message');
      const priority = interaction.options.getString('priority') || 'medium';

      const res = await apiFetch('/api/internal/open-ticket', {
        method: 'POST',
        body: JSON.stringify({
          discordUserId: interaction.user.id,
          subject,
          message,
          priority,
        }),
      });

      if (!res.ok) {
        await interaction.editReply(`❌ Could not create ticket: ${res.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`✅ Ticket #${res.ticket.id.slice(0, 8).toUpperCase()} Opened`)
        .setColor(0x22c55e)
        .addFields(
          { name: 'Subject', value: subject, inline: true },
          { name: 'Priority', value: priority.toUpperCase(), inline: true },
          { name: 'Message', value: message, inline: false }
        )
        .setFooter({ text: 'Support staff has been alerted in Discord' });

      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'reply-ticket') {
      await interaction.deferReply();
      const ticketId = interaction.options.getString('ticket_id');
      const message = interaction.options.getString('message');

      const res = await apiFetch('/api/internal/reply-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, body: message, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`💬 Reply sent for ticket #${ticketId.slice(0, 8).toUpperCase()}!`);
      } else {
        await interaction.editReply(`❌ Failed to send reply: ${res.error}`);
      }
    } else if (commandName === 'claim-ticket') {
      await interaction.deferReply();
      const ticketId = interaction.options.getString('ticket_id');

      const res = await apiFetch('/api/internal/claim-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`🙋‍♂️ Ticket #${ticketId.slice(0, 8).toUpperCase()} claimed by @${userLabel}!`);
      } else {
        await interaction.editReply(`❌ Failed to claim ticket: ${res.error}`);
      }
    } else if (commandName === 'close-ticket') {
      await interaction.deferReply();
      const ticketId = interaction.options.getString('ticket_id');

      const res = await apiFetch('/api/internal/close-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId, staffUserLabel: userLabel }),
      });

      if (res.ok) {
        await interaction.editReply(`🔒 Ticket #${ticketId.slice(0, 8).toUpperCase()} closed.`);
      } else {
        await interaction.editReply(`❌ Failed to close ticket: ${res.error}`);
      }
    } else if (commandName === 'review-payment') {
      await interaction.deferReply({ ephemeral: true });
      const orderId = interaction.options.getString('order_id');
      const action = interaction.options.getString('action');
      const reason = interaction.options.getString('reason');

      const reviewRes = await apiFetch(`/api/internal/review-payment`, {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          approve: action === 'approve',
          reason,
          reviewedBy: userLabel,
        }),
      });

      if (!reviewRes || !reviewRes.ok) {
        await interaction.editReply(`❌ Payment review failed: ${reviewRes?.error || 'Order not found'}`);
        return;
      }

      await interaction.editReply(`✅ Payment review updated for Order #${orderId.slice(0, 8).toUpperCase()}`);
    }
  } catch (err) {
    console.error('Failed to handle Discord interaction:', err);
  }
}

module.exports = { commands, handleInteraction };
