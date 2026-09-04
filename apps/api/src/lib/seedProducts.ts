import { prisma } from './prisma';
import { logger } from './logger';
import { syncProductsToFirebase, syncCmsToFirebase } from './firebaseSync';

export async function ensureDefaultProductsSeeded(): Promise<void> {
  try {
    logger.info('Checking product catalog and seeding any missing platform products & plans...');

    // 1. SMTP Mail Hosting Product & Plans (5 Configurable Tiers)
    let smtpProduct = await prisma.product.findFirst({ where: { category: 'smtp_hosting' } });
    if (!smtpProduct) {
      smtpProduct = await prisma.product.create({
        data: {
          category: 'smtp_hosting',
          name: 'Enterprise Outbound SMTP & Business Email Hosting',
          slug: 'smtp-mail-hosting',
          description: 'High-reputation SMTP mailer with webmail client, custom domain support, DKIM/SPF signatures, forwarding rules, and email aliases. Minimum 3-month commitment.',
          isActive: true,
        },
      });
    }

    // Seed/Update 5 Standard Email Hosting Plans
    const defaultEmailPlans = [
      {
        name: 'Starter Email (1GB)',
        price: 450000, // LKR 4,500 (LKR 1,500/mo x 3 months)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 1,
          storageQuotaMb: 1024,
          forwardingRules: 1,
          emailAliases: 2,
          maxAliases: 2,
          dailyQuota: 500,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '1 GB Storage', '1 Forwarding Rule', '2 Email Aliases', 'Webmail & SMTP/IMAP Access'],
        },
        isActive: true,
      },
      {
        name: 'Standard Email (5GB)',
        price: 1050000, // LKR 10,500 (LKR 3,500/mo x 3 months)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 5,
          storageQuotaMb: 5120,
          forwardingRules: 5,
          emailAliases: 5,
          maxAliases: 5,
          dailyQuota: 2500,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '5 GB Storage', '5 Forwarding Rules', '5 Email Aliases', 'Webmail & SMTP/IMAP Access'],
        },
        isActive: true,
      },
      {
        name: 'Pro Email (20GB)',
        price: 2250000, // LKR 22,500 (LKR 7,500/mo x 3 months)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 20,
          storageQuotaMb: 20480,
          forwardingRules: 20,
          emailAliases: 10,
          maxAliases: 10,
          dailyQuota: 5000,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '20 GB Storage', '20 Forwarding Rules', '10 Email Aliases', 'Webmail & SMTP/IMAP Access'],
        },
        isActive: true,
      },
      {
        name: 'Enterprise Email (50GB)',
        price: 4500000, // LKR 45,000 (LKR 15,000/mo x 3 months)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 50,
          storageQuotaMb: 51200,
          forwardingRules: 50,
          emailAliases: 30,
          maxAliases: 30,
          dailyQuota: 10000,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '50 GB Storage', '50 Forwarding Rules', '30 Email Aliases', 'Webmail & SMTP/IMAP Access'],
        },
        isActive: true,
      },
      {
        name: 'Enterprise Ultimate (Custom / Unlimited)',
        price: 9000000, // LKR 90,000 (LKR 30,000/mo x 3 months)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        specsJson: {
          mailboxesCount: -1,
          storageLimitGb: -1,
          storageQuotaMb: -1,
          forwardingRules: -1,
          emailAliases: -1,
          maxAliases: -1,
          dailyQuota: 50000,
          minCommitmentMonths: 3,
          features: ['Unlimited Mailboxes', 'Unlimited Storage', 'Unlimited Forwarding Rules', 'Unlimited Email Aliases', 'Dedicated IP & VIP Support'],
        },
        isActive: true,
      },
    ];

    for (const p of defaultEmailPlans) {
      const existing = await prisma.plan.findFirst({
        where: { productId: smtpProduct.id, name: p.name },
      });
      if (!existing) {
        await prisma.plan.create({
          data: {
            productId: smtpProduct.id,
            ...p,
          },
        });
      }
    }

    // 2. High-Performance VPS Hosting
    let vpsProduct = await prisma.product.findFirst({ where: { category: 'vps' } });
    if (!vpsProduct) {
      await prisma.product.create({
        data: {
          category: 'vps',
          name: 'High-Performance Cloud VPS',
          slug: 'high-performance-vps',
          description: 'Dedicated virtual private servers with NVMe SSDs, 1Gbps unmetered bandwidth, and root SSH control.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'VPS Micro',
                price: 250000, // LKR 2,500.00
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { cpuCores: 1, ramGB: 2, storageGB: 30, bandwidth: 'Unmetered 1Gbps' },
                isActive: true,
              },
              {
                name: 'VPS Standard',
                price: 500000, // LKR 5,000.00
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { cpuCores: 2, ramGB: 4, storageGB: 80, bandwidth: 'Unmetered 1Gbps' },
                isActive: true,
              },
              {
                name: 'VPS Pro',
                price: 950000, // LKR 9,500.00
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { cpuCores: 4, ramGB: 8, storageGB: 160, bandwidth: 'Unmetered 1Gbps' },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // 3. Node.js & Web Application Hosting
    let nodeProduct = await prisma.product.findFirst({ where: { category: 'node_app_hosting' } });
    if (!nodeProduct) {
      await prisma.product.create({
        data: {
          category: 'node_app_hosting',
          name: 'Node.js & Next.js App Hosting',
          slug: 'nodejs-app-hosting',
          description: 'Nixpacks-powered container hosting with automatic SSL, custom domain routing, and environment secrets.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'Developer Node Plan',
                price: 120000, // LKR 1,200.00
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 512, cpuCores: 0.5, customDomain: true },
                isActive: true,
              },
              {
                name: 'Business Node Plan',
                price: 280000, // LKR 2,800.00
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 2048, cpuCores: 1.5, customDomain: true },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // 4. Static & Dynamic Web Hosting (GitHub Auto-Deploy & Free Auto-SSL)
    let webHostingProduct = await prisma.product.findFirst({ where: { category: 'web_hosting' } });
    if (!webHostingProduct) {
      webHostingProduct = await prisma.product.create({
        data: {
          category: 'web_hosting',
          name: 'Static & Dynamic Web Hosting',
          slug: 'web-hosting',
          description: 'High-speed cloud web hosting with GitHub auto-deployment (Public & Private repos), free SSL certificates, custom domains, and automatic commit detection.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'Starter Web Hosting (1GB)',
                price: 85000, // LKR 850.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: {
                  storageGB: 1,
                  bandwidthGB: 100,
                  customDomain: true,
                  autoSsl: true,
                  gitAutoDeploy: true,
                  features: ['1 GB High-Speed NVMe', '100 GB Bandwidth', 'GitHub Public & Private Deploy', 'Automatic Git Push Deployment', 'Free Auto SSL'],
                },
                isActive: true,
              },
              {
                name: 'Pro Web Hosting (5GB)',
                price: 195000, // LKR 1,950.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: {
                  storageGB: 5,
                  bandwidthGB: 500,
                  customDomain: true,
                  autoSsl: true,
                  gitAutoDeploy: true,
                  features: ['5 GB High-Speed NVMe', '500 GB Bandwidth', 'Multiple Custom Domains', 'GitHub Public & Private Deploy', 'Automatic Git Push Deployment', 'Free Auto SSL'],
                },
                isActive: true,
              },
              {
                name: 'Enterprise Web Hosting (20GB)',
                price: 450000, // LKR 4,500.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: {
                  storageGB: 20,
                  bandwidthGB: 2000,
                  customDomain: true,
                  autoSsl: true,
                  gitAutoDeploy: true,
                  features: ['20 GB High-Speed NVMe', '2 TB Bandwidth', 'Unlimited Custom Domains', 'GitHub Public & Private Deploy', 'Automatic Git Push Deployment', 'Dedicated Priority Node Isolation'],
                },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // 5. Python Application Hosting (FastAPI / Django / Flask)
    let pythonProduct = await prisma.product.findFirst({ where: { category: 'python_app_hosting' } });
    if (!pythonProduct) {
      await prisma.product.create({
        data: {
          category: 'python_app_hosting',
          name: 'Python Application Hosting (FastAPI / Django / Flask)',
          slug: 'python-app-hosting',
          description: 'High-performance Python hosting with Gunicorn/Uvicorn, custom domain SSL routing, and environment secrets.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'Python Dev Plan',
                price: 150000, // LKR 1,500.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 1024, cpuCores: 1, customDomain: true },
                isActive: true,
              },
              {
                name: 'Python Pro Plan',
                price: 350000, // LKR 3,500.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 4096, cpuCores: 2, customDomain: true },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // 6. Discord Bot Hosting (Node.js & Python)
    let discordNodeProduct = await prisma.product.findFirst({ where: { category: 'discordbot_node' } });
    if (!discordNodeProduct) {
      await prisma.product.create({
        data: {
          category: 'discordbot_node',
          name: 'Discord Bot Hosting (Node.js)',
          slug: 'discord-bot-node',
          description: '24/7 continuous process runner for Node.js Discord bots (discord.js / erela.js) with live logs and auto-restart.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'Bot Starter (512MB RAM)',
                price: 80000, // LKR 800.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 512, cpuCores: 0.5, continuousRuntime: true },
                isActive: true,
              },
              {
                name: 'Bot Pro (2GB RAM)',
                price: 180000, // LKR 1,800.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 2048, cpuCores: 1, continuousRuntime: true },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    let discordPyProduct = await prisma.product.findFirst({ where: { category: 'discordbot_python' } });
    if (!discordPyProduct) {
      await prisma.product.create({
        data: {
          category: 'discordbot_python',
          name: 'Discord Bot Hosting (Python)',
          slug: 'discord-bot-python',
          description: '24/7 continuous process runner for Python Discord bots (discord.py / nextcord) with automatic dependency caching.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'Python Bot Plan (1GB RAM)',
                price: 95000, // LKR 950.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 1024, cpuCores: 0.5, continuousRuntime: true },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // 7. WhatsApp Bot Hosting (Baileys / web.js)
    let waProduct = await prisma.product.findFirst({ where: { category: 'whatsappbot_hosting' } });
    if (!waProduct) {
      await prisma.product.create({
        data: {
          category: 'whatsappbot_hosting',
          name: 'WhatsApp Bot Hosting (Baileys / web.js)',
          slug: 'whatsapp-bot-hosting',
          description: 'Dedicated persistent container hosting for WhatsApp automation bots with persistent QR session storage.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'WhatsApp Bot Starter',
                price: 150000, // LKR 1,500.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 1024, storageGB: 5, persistentSession: true },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // 8. Lavalink Audio Node Hosting
    let lavalinkProduct = await prisma.product.findFirst({ where: { category: 'lavalink_hosting' } });
    if (!lavalinkProduct) {
      await prisma.product.create({
        data: {
          category: 'lavalink_hosting',
          name: 'Lavalink Audio Node Hosting (Java)',
          slug: 'lavalink-audio-node',
          description: 'High-performance audio routing node for Discord music bots running Java 17+ and application.yml config.',
          isActive: true,
          plans: {
            create: [
              {
                name: 'Lavalink Node (2GB RAM)',
                price: 220000, // LKR 2,200.00 / mo
                currency: 'LKR',
                billingType: 'monthly',
                specsJson: { memoryMB: 2048, cpuCores: 1.5, directPortExposure: true },
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // 5. Ensure Primary Compute Node exists with all tags for local & deployment hosting
    const nodeCount = await prisma.node.count().catch(() => 0);
    if (nodeCount === 0) {
      await prisma.node.create({
        data: {
          label: 'ShanuTechX Primary Localhost Cluster Node',
          ip: '127.0.0.1',
          sshKeyRef: 'vault:local-node-key',
          cpuCores: 8,
          ramMb: 16384,
          diskGb: 250,
          roleTags: [
            'node-hosting',
            'livekit',
            'vps',
            'deployments',
            'databases',
            'web-hosting',
            'python-hosting',
            'discordbot-node',
            'discordbot-python',
            'database_hosting',
            'app_catalog',
          ],
          isActive: true,
          cpuUsedPct: 15.4,
          ramUsedMb: 4096,
          diskUsedGb: 35,
          lastSeenAt: new Date(),
        },
      });
      logger.info('Successfully seeded primary compute node with full tag suite!');
    }

    logger.info(`Successfully seeded default products and plans! Created SMTP product ID: ${smtpProduct.id}`);
    void syncProductsToFirebase();
    void ensureDefaultCmsSeeded();
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to auto-seed default products');
  }
}

export async function ensureDefaultCmsSeeded(): Promise<void> {
  try {
    const cmsCount = await prisma.contentBlock.count().catch(() => 0);
    if (cmsCount > 0) {
      void syncCmsToFirebase();
      return;
    }

    logger.info('No CMS blocks found. Seeding default site settings and feeding to Firestore...');

    const defaultBlocks = [
      { page: 'contact', key: 'supportEmail', value: 'support@shanutechx.cloud' },
      { page: 'contact', key: 'contactEmail', value: 'sales@shanutechx.cloud' },
      { page: 'contact', key: 'contactPhone', value: '+1 (800) 589-STX1' },
      { page: 'contact', key: 'whatsappPhone', value: '+94 77 123 4567' },
      { page: 'contact', key: 'contactAddress', value: 'ShanuTechX Cloud HQ, Tech City, Sri Lanka' },
      { page: 'contact', key: 'supportHours', value: '24/7/365 Tier-3 Engineer Live Support' },
      { page: 'contact', key: 'discordUrl', value: 'https://discord.gg/shanutechx' },
      { page: 'contact', key: 'whatsappChannelUrl', value: 'https://wa.me/94771234567?text=Hello%20ShanuTechX%20Support' },
      { page: 'contact', key: 'telegramUrl', value: 'https://t.me/shanutechx' },
      { page: 'contact', key: 'githubUrl', value: 'https://github.com/shanutechx' },
      { page: 'contact', key: 'twitterUrl', value: 'https://twitter.com/shanutechx' },
      { page: 'contact', key: 'facebookUrl', value: 'https://facebook.com/shanutechx' },
      { page: 'home', key: 'companyName', value: 'ShanuTechX Cloud' },
      { page: 'home', key: 'heroTitle', value: 'Autonomous High-Performance Cloud Hosting' },
      { page: 'home', key: 'heroSubtitle', value: 'Deploy web apps, Node.js and Python services, and Discord bots in minutes.' },
      { page: 'home', key: 'announcementText', value: 'New VPS High-Performance Nodes Online in Ashburn & Frankfurt!' },
      { page: 'home', key: 'announcementActive', value: true },
      { page: 'home', key: 'copyrightText', value: `© ${new Date().getFullYear()} ShanuTechX Cloud. All rights reserved.` },
    ];

    for (const b of defaultBlocks) {
      await prisma.contentBlock.upsert({
        where: { page_key: { page: b.page, key: b.key } },
        create: { page: b.page, key: b.key, valueJson: b.value as any },
        update: { valueJson: b.value as any },
      });
    }

    logger.info('Successfully seeded default CMS blocks to database!');
    await syncCmsToFirebase();
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to seed default CMS blocks');
  }
}
