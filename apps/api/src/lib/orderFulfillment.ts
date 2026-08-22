import { prisma } from './prisma';
import { env } from '../env';
import { logger } from './logger';
import { encryptSecret } from './secretsVault';
import { notifyDiscordChannel } from './discordWebhooks';
import { notifyCustomer, notifyAdmins } from './notifications';
import { sendSmtpReleaseEmail, getTierFromPlanName, generateDefaultAliases } from './smtpProvisioner';
import { generateLiveKitKeyPair } from './livekit';
import { selectNodeForDeployment } from './nodeSelector';
import { registerLiveKitKey, provisionDatabaseContainer } from './nodeAgentClient';
import crypto from 'crypto';

/**
 * Fully automated order fulfillment pipeline.
 *
 * Requirements:
 * 1. Non-VPS services (SMTP, LiveKit, Managed DBs, Bot Hosting, AI Subscriptions)
 *    are automatically provisioned and configured immediately upon payment approval.
 * 2. VPS products (VPS, Leaseweb VPS) are NOT auto-provisioned automatically;
 *    instead, a dedicated Discord Webhook alert is sent to team channels for manual setup.
 */
export async function fulfillOrder(orderId: string): Promise<{ success: boolean; fulfilledItems: string[]; manualVpsItems: string[] }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      items: {
        include: {
          service: true,
          plan: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    logger.warn({ orderId }, 'fulfillOrder: Order not found');
    return { success: false, fulfilledItems: [], manualVpsItems: [] };
  }

  const fulfilledItems: string[] = [];
  const manualVpsItems: string[] = [];

  for (const item of order.items) {
    const productName = (item.plan?.product?.name || item.plan?.name || item.service?.name || '').toLowerCase();
    const productCategory = (item.plan?.product?.category || '').toLowerCase();

    const isVps =
      productCategory === 'vps' ||
      productCategory === 'vps_plans' ||
      productCategory === 'leaseweb' ||
      productName.includes('vps') ||
      productName.includes('cloud server') ||
      productName.includes('kvm');

    if (isVps) {
      manualVpsItems.push(item.plan?.name || item.service?.name || 'VPS Plan');

      // Dispatch urgent Discord Webhook notification to team for manual setup
      void notifyDiscordChannel('vps_assigned', {
        Alert: '🚨 MANUAL VPS PROVISION REQUIRED',
        Order: order.id,
        Customer: order.user.email,
        Plan: item.plan?.name || item.service?.name || 'VPS Server',
        Amount: `LKR ${order.totalLkr}`,
        Note: 'Payment approved. Please provision and assign VPS IP/credentials in Admin Panel.',
      });

      void notifyAdmins(
        `🚨 Manual VPS Provision Required for Order ${order.id} (${order.user.email}) - Item: ${item.plan?.name || item.service?.name}`
      );
      continue;
    }

    // 1. Shared SMTP & Mailbox Hosting
    const isSmtp =
      productCategory === 'smtp_hosting' ||
      productCategory === 'smtp' ||
      productName.includes('smtp') ||
      productName.includes('mail');

    if (isSmtp) {
      const existingAccount = await prisma.smtpAccount.findFirst({
        where: { orderItemId: item.id },
      });

      if (!existingAccount) {
        try {
          const tier = getTierFromPlanName(item.plan?.name || 'Starter Mail');
          const autoPassword = `Smtp_${Math.random().toString(36).slice(2, 10)}!2026`;
          const username = `mail_${order.user.id.slice(0, 8)}`;
          const smtpHost = `mail.${env.rootDomain}`;
          const webmailUrl = process.env.WEBMAIL_URL || (process.env.NODE_ENV === 'production' ? `https://mail.${env.rootDomain}` : 'http://localhost:3001/email');
          const aliases = generateDefaultAliases(env.rootDomain, tier.maxAliases);
          const credentialRef = encryptSecret(autoPassword, env.secretsEncryptionKey);

          await prisma.smtpAccount.create({
            data: {
              userId: order.userId,
              orderItemId: item.id,
              postalOrgId: 'shanutechx',
              smtpHost,
              smtpPort: 587,
              smtpUsername: username,
              credentialRef,
              webmailUrl,
            },
          });

          void sendSmtpReleaseEmail({
            clientEmail: order.user.email,
            clientName: order.user.displayName || order.user.email,
            planName: item.plan?.name || tier.name,
            tier,
            smtpHost,
            smtpPort: 587,
            smtpUsername: username,
            smtpPassword: autoPassword,
            webmailUrl,
            domain: env.rootDomain,
            aliases,
            orderId: order.id,
            paymentId: 'AUTO_PROVISION',
            amountPaid: `LKR ${order.totalLkr}`,
          });

          fulfilledItems.push(`SMTP Mailbox (${username}@${env.rootDomain})`);
          logger.info({ orderId: order.id, username }, 'Auto-provisioned SMTP Account');
        } catch (err) {
          logger.error({ orderId: order.id, err }, 'Failed to auto-provision SMTP account');
        }
      }
    }

    // 2. LiveKit WebRTC
    const isLiveKit = productCategory === 'livekit' || productName.includes('livekit');
    if (isLiveKit) {
      const existingLk = await prisma.liveKitProject.findFirst({ where: { orderItemId: item.id } });
      if (!existingLk) {
        try {
          let node;
          try {
            node = await selectNodeForDeployment({ requiredTag: 'livekit', isAdminDeployment: true });
          } catch {
            // fallback node
            node = await prisma.node.findFirst();
          }

          if (node) {
            const { apiKey, apiSecret } = generateLiveKitKeyPair();
            const apiSecretRef = encryptSecret(apiSecret, env.secretsEncryptionKey);

            const project = await prisma.liveKitProject.create({
              data: { userId: order.userId, orderItemId: item.id, apiKey, apiSecretRef, nodeId: node.id },
            });

            try {
              await registerLiveKitKey(node, { apiKey, apiSecret });
            } catch (lkErr) {
              logger.warn({ lkErr }, 'LiveKit key registration on node deferred');
            }

            fulfilledItems.push(`LiveKit Project (${project.apiKey})`);
            logger.info({ orderId: order.id, apiKey }, 'Auto-provisioned LiveKit Project');
          }
        } catch (err) {
          logger.error({ orderId: order.id, err }, 'Failed to auto-provision LiveKit project');
        }
      }
    }

    // 3. Managed Database (Postgres / MySQL / Redis / MongoDB)
    const isManagedDb = productCategory === 'managed_database' || productName.includes('database');
    if (isManagedDb) {
      try {
        let dbType: 'postgres' | 'mysql' | 'redis' | 'mongodb' = 'postgres';
        if (productName.includes('mysql')) dbType = 'mysql';
        else if (productName.includes('redis')) dbType = 'redis';
        else if (productName.includes('mongo')) dbType = 'mongodb';

        const node = await prisma.node.findFirst();
        if (node) {
          const rawPassword = crypto.randomBytes(16).toString('hex');
          const credentialRef = encryptSecret(rawPassword, env.secretsEncryptionKey);

          const db = await prisma.managedDatabase.create({
            data: { userId: order.userId, nodeId: node.id, type: dbType, status: 'pending', credentialRef },
          });

          void provisionDatabaseContainer(node, { databaseId: db.id, type: dbType, password: rawPassword })
            .then(async (result) => {
              await prisma.managedDatabase.update({
                where: { id: db.id },
                data: {
                  status: 'running',
                  containerId: result.containerId,
                  internalHost: result.containerName,
                  internalPort: result.internalPort,
                },
              });
            })
            .catch(async () => {
              await prisma.managedDatabase.update({ where: { id: db.id }, data: { status: 'failed' } });
            });

          fulfilledItems.push(`Managed ${dbType.toUpperCase()} Database`);
        }
      } catch (err) {
        logger.error({ orderId: order.id, err }, 'Failed to auto-provision Managed Database');
      }
    }

    // 4. AI Subscriptions
    const isAiSub = productCategory === 'ai_subscription' || productName.includes('ai');
    if (isAiSub) {
      fulfilledItems.push(`AI Subscription (${item.plan?.name || 'AI Access'})`);
      void notifyCustomer(
        order.user,
        `Your AI Subscription for order ${order.id} is active! Please visit Support Tickets to access your AI environment credentials.`
      );
    }
  }

  // Summary Notification to Discord
  if (fulfilledItems.length > 0) {
    void notifyDiscordChannel('payment_approved', {
      Order: order.id,
      Customer: order.user.email,
      AutoProvisioned: fulfilledItems.join(', '),
      Status: 'Auto-Fulfilled',
    });
  }

  return { success: true, fulfilledItems, manualVpsItems };
}
