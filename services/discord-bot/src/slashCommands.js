const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const API_BASE = process.env.API_INTERNAL_URL || 'http://localhost:3000';
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

const ALLOWED_DISCORD_ROLES = process.env.ALLOWED_DISCORD_ROLES ? process.env.ALLOWED_DISCORD_ROLES.split(',').map(s => s.trim()) : [];
const ALLOWED_DISCORD_USERS = process.env.ALLOWED_DISCORD_USERS ? process.env.ALLOWED_DISCORD_USERS.split(',').map(s => s.trim()) : [];

function isStaffAuthorized(member, user) {
  if (ALLOWED_DISCORD_USERS.length > 0 && ALLOWED_DISCORD_USERS.includes(user.id)) {
    return true;
  }
  if (ALLOWED_DISCORD_ROLES.length > 0 && member?.roles?.cache) {
    return member.roles.cache.some((role) => ALLOWED_DISCORD_ROLES.includes(role.id) || ALLOWED_DISCORD_ROLES.includes(role.name));
  }
  if (member?.permissions?.has && (member.permissions.has('Administrator') || member.permissions.has('ManageGuild'))) {
    return true;
  }
  return false;
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName } = interaction;

    if (commandName === 'status') {
      await interaction.deferReply();
      const health = await apiFetch('/api/health');

      const embed = new EmbedBuilder()
        .setTitle('[STATUS] ShanuTechX System Status')
        .setColor(health?.ok ? 0x22c55e : 0xef4444)
        .addFields(
          { name: 'Cluster Health', value: health?.ok ? '[ONLINE]' : '[DEGRADED]', inline: true },
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
        .setTitle('[DEPLOYMENTS] Active Cluster Deployments')
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
        .setTitle('[TICKETS] Open Support Tickets')
        .setColor(0x06b6d4)
        .setDescription(
          data.tickets
            .map((t) => `• **#${t.id.slice(0, 8).toUpperCase()}**: ${t.subject} (${t.user?.email || 'Unknown'})`)
            .join('\n')
        );

      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'review-payment') {
      if (!isStaffAuthorized(interaction.member, interaction.user)) {
        await interaction.reply({ content: '[UNAUTHORIZED] You do not have staff permissions to review payments.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const orderId = interaction.options.getString('order_id');
      const action = interaction.options.getString('action');
      const reason = interaction.options.getString('reason');

      if (action === 'decline' && !reason) {
        await interaction.editReply('[WARNING] A decline reason is required when declining a payment proof.');
        return;
      }

      const userLabel = interaction.user.username || interaction.user.tag;

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
        await interaction.editReply(`[FAILED] Payment review failed: ${reviewRes?.error || 'Order or payment not found'}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(action === 'approve' ? '[APPROVED] Payment Approved via Discord' : '[DECLINED] Payment Declined via Discord')
        .setColor(action === 'approve' ? 0x22c55e : 0xef4444)
        .addFields(
          { name: 'Order ID', value: `#${orderId.slice(0, 8).toUpperCase()}`, inline: true },
          { name: 'Action', value: action.toUpperCase(), inline: true },
          { name: 'Staff Reviewer', value: userLabel, inline: true }
        );

      if (reason) embed.addFields({ name: 'Reason', value: reason, inline: false });

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Failed to handle Discord interaction:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '[ERROR] An error occurred processing this command.' }).catch(() => {});
    } else {
      await interaction.reply({ content: '[ERROR] An error occurred processing this command.', ephemeral: true }).catch(() => {});
    }
  }
}

module.exports = { commands, handleInteraction };
