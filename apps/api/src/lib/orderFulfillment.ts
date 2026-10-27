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
import { formatCurrency } from './currency';
import { wildduckClient } from './wildduckClient';
import { splitOrderItemsIntoUnits } from './deploymentSlots';
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
  // Ensure every purchased unit across all line items has its own dedicated OrderItem record
  await splitOrderItemsIntoUnits(orderId);

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
    const isSmtp =
      productCategory === 'smtp' ||
      productCategory === 'email' ||
      productCategory === 'mail' ||
      productCategory === 'smtp_hosting' ||
      productCategory === 'email_hosting' ||
      productName.includes('smtp') ||
      productName.includes('email') ||
      (productName.includes('mail') && !productName.includes('gmail'));
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
          Amount: formatCurrency(order.totalLkr, 'LKR'),
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
      const configObj = item.configJson as Record<string, any> | null;

      // Handle mailbox subscription renewal if specified in configJson
      if (configObj?.type === 'mailbox_renewal' || configObj?.mailboxId) {
        const renewalMailboxId = String(configObj.mailboxId);
        const existingAcc = await prisma.smtpAccount.findUnique({ where: { id: renewalMailboxId } });
        if (existingAcc) {
          const months = Number(configObj.months) || 1;
          const baseDate = existingAcc.expiresAt && existingAcc.expiresAt.getTime() > Date.now() ? existingAcc.expiresAt : new Date();
          const newExpiresAt = new Date(baseDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);
          await prisma.smtpAccount.update({
            where: { id: existingAcc.id },
            data: { expiresAt: newExpiresAt, isSuspended: false },
          });
          fulfilledItems.push(`SMTP Mailbox Renewal (${existingAcc.smtpUsername})`);
          logger.info({ orderId: order.id, mailboxId: existingAcc.id, newExpiresAt }, 'Auto-renewed SMTP account on payment approval');
          continue;
        }
      }

      const existingAccount = await prisma.smtpAccount.findFirst({
        where: { orderItemId: item.id },
      });

      if (!existingAccount) {
        try {
          const tier = getTierFromPlanName(item.plan?.name || 'Starter Mail');
          const autoPassword = `Smtp_${crypto.randomBytes(12).toString('base64url')}`;
          const smtpHost = `mail.${env.rootDomain}`;
          const webmailUrl = process.env.WEBMAIL_URL || (process.env.NODE_ENV === 'production' ? `https://mail.${env.rootDomain}` : 'http://localhost:3001/webmail');
          const credentialRef = encryptSecret(autoPassword, env.secretsEncryptionKey);

          // Custom domain detection from checkout configJson
          const rawDomain = (configObj?.customDomain || configObj?.domain || '').trim().toLowerCase();
          const customDomain = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(rawDomain) && rawDomain !== env.rootDomain
            ? rawDomain
            : undefined;
          const mailDomain = customDomain || env.rootDomain;

          // Username / mailbox prefix
          const rawPrefix = (configObj?.username || configObj?.prefix || '').trim().toLowerCase();
          const usernamePrefix = /^[a-z0-9._-]+$/.test(rawPrefix)
            ? rawPrefix
            : `mail_${order.user.id.slice(0, 8)}`;
          const fullEmail = `${usernamePrefix}@${mailDomain}`;
          const aliases = generateDefaultAliases(mailDomain, tier.maxAliases);

          const specs: any = item.plan?.specsJson || {};
          const storageQuotaMb = specs.storageQuotaMb !== undefined ? specs.storageQuotaMb : (specs.storageLimitGb ? (specs.storageLimitGb === -1 ? -1 : specs.storageLimitGb * 1024) : 1024);
          const maxAliases = specs.maxAliases !== undefined ? specs.maxAliases : (specs.emailAliases !== undefined ? specs.emailAliases : 2);
          const dailySendLimit = specs.dailyQuota !== undefined ? specs.dailyQuota : (specs.dailySendLimit !== undefined ? specs.dailySendLimit : 1000);

          // Default commitment expiration from payment approval date
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (specs.minCommitmentMonths ? specs.minCommitmentMonths * 30 : 90));

          // Register custom domain in WildDuck & DB if customer provided one
          if (customDomain) {
            if (env.wildduckApiKey) {
              await wildduckClient.createDomain(customDomain).catch((err: any) =>
                logger.warn({ domain: customDomain, err: err.message }, 'WildDuck createDomain error during order fulfillment (non-fatal)')
              );
              await wildduckClient.getOrCreateDkim(customDomain, 'wildduck').catch((err: any) =>
                logger.warn({ domain: customDomain, err: err.message }, 'WildDuck getOrCreateDkim error during order fulfillment (non-fatal)')
              );
            }
            await prisma.emailDomain.upsert({
              where: { domain: customDomain },
              update: { userId: order.userId },
              create: {
                domain: customDomain,
                userId: order.userId,
                status: 'pending_dns',
              },
            }).catch((err) => logger.warn({ err: err.message }, 'EmailDomain upsert error during fulfillment'));
          }

          let wildduckUserId: string | undefined;
          let wildduckAddressId: string | undefined;

          if (env.wildduckApiKey) {
            try {
              const quotaGb = storageQuotaMb === -1 ? 100 : Math.max(1, Math.ceil(storageQuotaMb / 1024));
              const wdUser = await wildduckClient.createUser({
                username: fullEmail,
                password: autoPassword,
                name: order.user.displayName || order.user.email,
                quotaGb,
              });
              wildduckUserId = wdUser.id;
              const addr = await wildduckClient.createAddress(wdUser.id, fullEmail, order.user.displayName || undefined).catch(() => null);
              if (addr) wildduckAddressId = addr.id;
            } catch (wdErr: any) {
              logger.warn({ orderId: order.id, err: wdErr.message }, 'WildDuck API user creation failed during order fulfillment (non-fatal)');
            }
          }

          const createdAccount = await prisma.smtpAccount.create({
            data: {
              userId: order.userId,
              orderItemId: item.id,
              postalOrgId: 'shanutechx',
              wildduckUserId,
              wildduckAddressId,
              smtpHost,
              smtpPort: 587,
              smtpUsername: fullEmail,
              customDomain: customDomain || null,
              credentialRef,
              webmailUrl,
              storageQuotaMb,
              maxAliases,
              dailySendLimit,
              expiresAt,
              planTier: item.plan?.name || tier.name,
            },
          });

          // Retrieve authentic DKIM record for customer connection instructions
          let dkimRecordStr = `v=DKIM1; k=rsa; p=<managed by mail server>`;
          let dkimSelector = 'wildduck';
          if (env.wildduckApiKey) {
            try {
              const dkimInfo = await wildduckClient.getOrCreateDkim(mailDomain, 'wildduck');
              if (dkimInfo?.publicKey) {
                dkimRecordStr = dkimInfo.txtRecord;
                dkimSelector = dkimInfo.selector || 'wildduck';
              }
            } catch (_) {}
          }

          // Deliver immediate welcome email into the customer's Webmail inbox
          const welcomeHtml = `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 0 auto; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 12px; padding: 24px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #38bdf8; font-size: 20px; font-weight: 700;">Welcome to ShanuTechX Enterprise Webmail</h2>
                <span style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.2); padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600;">ACTIVE</span>
              </div>
              <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                Your enterprise email account hosted on <strong>ShanuTechX Mail Engine</strong> has been successfully provisioned and activated.
              </p>
              
              <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #334155;">
                <h3 style="margin-top: 0; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Mailbox Configuration</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e2e8f0;">
                  <tr><td style="padding: 6px 0; color: #94a3b8; width: 150px;">Primary Email:</td><td style="padding: 6px 0; font-family: monospace; color: #38bdf8;">${fullEmail}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">SMTP / IMAP Login:</td><td style="padding: 6px 0; font-family: monospace;">${fullEmail}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">Plan Tier:</td><td style="padding: 6px 0;">${item.plan?.name || tier.name}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">Storage Limit:</td><td style="padding: 6px 0;">${storageQuotaMb === -1 ? 'Unlimited' : `${storageQuotaMb} MB`}</td></tr>
                </table>
              </div>

              <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #334155;">
                <h3 style="margin-top: 0; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Server & DNS Connection Settings</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e2e8f0;">
                  <tr><td style="padding: 6px 0; color: #94a3b8; width: 150px;">SMTP Host:</td><td style="padding: 6px 0; font-family: monospace;">${smtpHost} (Port 587 STARTTLS / 465 SSL)</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">IMAP Host:</td><td style="padding: 6px 0; font-family: monospace;">${smtpHost} (Port 993 SSL)</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">MX Record:</td><td style="padding: 6px 0; font-family: monospace;">10 ${smtpHost}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">SPF Record:</td><td style="padding: 6px 0; font-family: monospace;">v=spf1 include:${env.rootDomain} ~all</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">DKIM Selector:</td><td style="padding: 6px 0; font-family: monospace;">${dkimSelector}._domainkey.${mailDomain}</td></tr>
                  <tr><td style="padding: 6px 0; color: #94a3b8;">DKIM Record:</td><td style="padding: 6px 0; font-family: monospace; word-break: break-all;">${dkimRecordStr}</td></tr>
                </table>
              </div>

              <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
                You can access your inbox directly with single sign-on from your dashboard, manage custom aliases, configure signatures, and attach domain names.
              </p>
            </div>
          `;

          await prisma.webmailMessage.create({
            data: {
              userId: order.userId,
              smtpAccountId: createdAccount.id,
              folder: 'inbox',
              threadId: `welcome_${order.id}`,
              senderName: 'ShanuTechX Mail System',
              senderEmail: `noreply@${env.rootDomain}`,
              recipientEmail: order.user.email,
              subject: `Welcome to ShanuTechX Webmail (${fullEmail})`,
              snippet: `Your enterprise mailbox ${fullEmail} is ready. View server connection settings and credentials.`,
              htmlBody: welcomeHtml,
              category: 'primary',
              priority: 'high',
              isRead: false,
              isStarred: true,
            },
          });

          void sendSmtpReleaseEmail({
            clientEmail: order.user.email,
            clientName: order.user.displayName || order.user.email,
            planName: item.plan?.name || tier.name,
            tier,
            smtpHost,
            smtpPort: 587,
            smtpUsername: fullEmail,
            smtpPassword: autoPassword,
            webmailUrl,
            domain: mailDomain,
            aliases,
            orderId: order.id,
            paymentId: 'AUTO_PROVISION',
            amountPaid: formatCurrency(order.totalLkr, 'LKR'),
          });

          fulfilledItems.push(`SMTP Mailbox (${fullEmail})`);
          logger.info({ orderId: order.id, fullEmail }, 'Auto-provisioned SMTP Account and delivered Welcome Message');
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
                status: 'building',
                internalPort: 3000,
                cpuLimit: specs.cpuCores ?? undefined,
                memoryLimit: specs.memoryMB ?? specs.ramMB ?? undefined,
                storageLimit: specs.storageGB ?? undefined,
                exposureMode: isBotHosting ? 'no_ssl' : 'ssl_with_proxy',
              },
            });

            // Asynchronously trigger container build & run on target node
            const { buildAndRun } = await import('./nodeAgentClient');
            void buildAndRun(
              node,
              {
                deploymentId: dep.id,
                repoUrl: 'starter://empty',
                subdomain: dep.subdomain ?? undefined,
                internalPort: 3000,
                cpuLimit: specs.cpuCores ?? undefined,
                memoryLimit: specs.memoryMB ?? specs.ramMB ?? undefined,
                storageLimit: specs.storageGB ?? undefined,
                exposureMode: dep.exposureMode ?? 'ssl_with_proxy',
              },
              () => {}
            ).then(async (result) => {
              if (result.phase === 'done' || result.containerId) {
                await prisma.deployment.update({
                  where: { id: dep.id },
                  data: { status: 'running', containerId: result.containerId, lastDeployAt: new Date() },
                });
              }
            }).catch((err) => {
              logger.warn({ deploymentId: dep.id, err: err.message }, 'Container build step failed during order auto-fulfillment (non-fatal)');
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
