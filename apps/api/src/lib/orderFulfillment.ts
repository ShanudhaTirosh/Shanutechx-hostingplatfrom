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

    // Canonical product category discriminators
    const isVps = productCategory === 'vps';
    const isSmtp = productCategory === 'smtp';
    const isManagedDb = productCategory === 'database';
    const isAppCatalog = productCategory === 'app_catalog';
    const isBotHosting = productCategory === 'bot_hosting';
    const isWebHosting = productCategory === 'web_hosting';
    const isLiveKit = isAppCatalog && (productName.includes('livekit') || productName.includes('webrtc'));

    // 1. VPS Servers — Manual Setup Flow by Admins/Devs upon Payment Approval
    if (isVps) {
      try {
        let vps = await prisma.vpsProvision.findFirst({
          where: { orderItemId: item.id },
        });

        if (!vps) {
          const configObj = item.configJson as Record<string, any> | null;
          const provider = configObj?.provider || 'leaseweb';

          vps = await prisma.vpsProvision.create({
            data: {
              userId: order.userId,
              orderItemId: item.id,
              provider,
              status: 'pending',
              sshPort: 22,
            },
          });

          logger.info({ orderId: order.id, vpsId: vps.id }, 'VPS item registered for manual admin provisioning');

          void notifyCustomer(
            order.user,
            `Payment approved for order ${order.id}. Your VPS server setup request is queued for manual provisioning by our admin team. You will be notified once server credentials and IP are configured.`
          );
        }

        manualVpsItems.push(item.plan?.name || item.service?.name || 'VPS Server');

        void notifyAdmins(`VPS Order Approved - Manual Provisioning Required for order ${order.id}`);
        void notifyDiscordChannel('vps_assigned', {
          Alert: 'VPS ORDER APPROVED - MANUAL SETUP REQUIRED',
          Order: order.id,
          Customer: order.user.email,
          Plan: item.plan?.name || item.service?.name || 'VPS Server',
          Amount: `LKR ${order.totalLkr}`,
          Status: 'Pending Admin Manual Setup',
        });
      } catch (err) {
        logger.error({ orderId: order.id, err }, 'Failed to initialize VPS manual provision record');
        manualVpsItems.push(item.plan?.name || item.service?.name || 'VPS Server');
      }
      continue;
    }

    // 1. Business Email & Mailbox Hosting (using canonical category — BUG-H01 FIX above)

    if (isSmtp) {
      const existingAccount = await prisma.smtpAccount.findFirst({
        where: { orderItemId: item.id },
      });

      if (!existingAccount) {
        try {
          const tier = getTierFromPlanName(item.plan?.name || 'Starter Mail');
          const autoPassword = `Smtp_${crypto.randomBytes(12).toString('base64url')}`;
          const username = `mail_${order.user.id.slice(0, 8)}`;
          const smtpHost = `mail.${env.rootDomain}`;
          const webmailUrl = process.env.WEBMAIL_URL || (process.env.NODE_ENV === 'production' ? `https://mail.${env.rootDomain}` : 'http://localhost:3001/email');
          const aliases = generateDefaultAliases(env.rootDomain, tier.maxAliases);
          const credentialRef = encryptSecret(autoPassword, env.secretsEncryptionKey);

          const specs: any = item.plan?.specsJson || {};
          const storageQuotaMb = specs.storageQuotaMb !== undefined ? specs.storageQuotaMb : (specs.storageLimitGb ? (specs.storageLimitGb === -1 ? -1 : specs.storageLimitGb * 1024) : 1024);
          const maxAliases = specs.maxAliases !== undefined ? specs.maxAliases : (specs.emailAliases !== undefined ? specs.emailAliases : 2);
          const dailySendLimit = specs.dailyQuota !== undefined ? specs.dailyQuota : (specs.dailySendLimit !== undefined ? specs.dailySendLimit : 1000);

          // Default 3-month (90 days) commitment expiration from payment approval date
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (specs.minCommitmentMonths ? specs.minCommitmentMonths * 30 : 90));

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
              storageQuotaMb,
              maxAliases,
              dailySendLimit,
              expiresAt,
              planTier: item.plan?.name || tier.name,
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

    // 2. LiveKit WebRTC (using canonical category — BUG-H01 FIX above)
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

    // 3. Managed Database (using canonical category — BUG-H01 FIX above)
    if (isManagedDb) {
      try {
        let dbType: 'postgres' | 'mysql' | 'redis' | 'mongodb' = 'postgres';
        if (productName.includes('mysql')) dbType = 'mysql';
        else if (productName.includes('redis')) dbType = 'redis';
        else if (productName.includes('mongo')) dbType = 'mongodb';

        const existingDb = await prisma.managedDatabase.findFirst({
          where: { userId: order.userId, type: dbType, createdAt: { gte: order.createdAt } },
        });

        if (!existingDb) {
          const node = await selectNodeForDeployment({ requiredTag: 'node-hosting', isAdminDeployment: true }).catch(() => prisma.node.findFirst({ where: { isActive: true } }));
          if (node) {
            const rawPassword = crypto.randomBytes(16).toString('hex');
            const credentialRef = encryptSecret(rawPassword, env.secretsEncryptionKey);

            const db = await prisma.managedDatabase.create({
              data: { userId: order.userId, nodeId: node.id, type: dbType, status: 'pending', credentialRef },
            });

            try {
              const result = await provisionDatabaseContainer(node, { databaseId: db.id, type: dbType, password: rawPassword });
              await prisma.managedDatabase.update({
                where: { id: db.id },
                data: {
                  status: 'running',
                  containerId: result.containerId,
                  internalHost: result.containerName,
                  internalPort: result.internalPort,
                },
              });
              fulfilledItems.push(`Managed ${dbType.toUpperCase()} Database`);
            } catch (provErr: any) {
              logger.error({ dbId: db.id, err: provErr }, 'Database container provisioning failed');
              await prisma.managedDatabase.update({ where: { id: db.id }, data: { status: 'failed' } });
              throw provErr;
            }
          }
        }
      } catch (err) {
        logger.error({ orderId: order.id, err }, 'Failed to auto-provision Managed Database');
      }
    }

    // 4. Application, Bot Hosting & Container Catalog
    if ((isWebHosting || isBotHosting || isAppCatalog) && !isSmtp && !isVps && !isManagedDb) {
      const existingDep = await prisma.deployment.findFirst({
        where: { orderItemId: item.id },
      });

      if (!existingDep) {
        try {
          const node = await selectNodeForDeployment({
            requiredTag: 'node-hosting',
            isAdminDeployment: false,
          }).catch(() => prisma.node.findFirst({ where: { isActive: true } }));

          if (node) {
            const subPrefix = (item.plan?.name || 'app').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15);
            const subdomain = `${subPrefix}-${crypto.randomBytes(3).toString('hex')}`;
            const specs: any = item.plan?.specsJson || {};

            const dep = await prisma.deployment.create({
              data: {
                userId: order.userId,
                orderItemId: item.id,
                nodeId: node.id,
                subdomain,
                status: 'pending',
                internalPort: 3000,
                cpuLimit: specs.cpuCores ?? undefined,
                memoryLimit: specs.memoryMB ?? specs.ramMB ?? undefined,
                storageLimit: specs.storageGB ?? undefined,
                exposureMode: isBotHosting ? 'no_ssl' : 'ssl_with_proxy',
              },
            });

            fulfilledItems.push(`Hosting Instance (${subdomain}.${env.deploymentsRootDomain})`);
            logger.info({ orderId: order.id, deploymentId: dep.id, subdomain }, 'Auto-provisioned Deployment Slot');
          }
        } catch (err) {
          logger.error({ orderId: order.id, err }, 'Failed to auto-provision Deployment slot');
        }
      }
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
