import { prisma } from './prisma';
import { logger } from './logger';
import { syncProductsToFirebase, syncCmsToFirebase } from './firebaseSync';

// Single standard unified price for:
// - Web Hosting
// - Managed Databases
// - App Catalog
// - Bot Hosting
// - App Deployment
// (1 purchase = 1 slot/instance. Customers buy more if they need more instances)
const STANDARD_SLOT_PRICE = {
  price: 120000, // LKR 1,200.00 / mo
  currency: 'LKR' as const,
  billingType: 'monthly' as const,
};

export async function ensureDefaultProductsSeeded(): Promise<void> {
  try {
    logger.info('Auditing and seeding preconfigured 7 product categories & matching plan pricing...');

    // Clean up any test product
    await prisma.product.deleteMany({
      where: {
        OR: [
          { slug: 'test' },
          { name: { contains: 'test', mode: 'insensitive' } },
        ],
      },
    }).catch(() => null);

    // ─────────────────────────────────────────────────────────────────
    // 1. VPS HOSTING (vps)
    // ─────────────────────────────────────────────────────────────────
    let vpsProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: 'vps-hosting' }, { slug: 'high-performance-vps' }, { category: 'vps' }] },
    });
    if (!vpsProduct) {
      vpsProduct = await prisma.product.create({
        data: {
          category: 'vps',
          name: 'VPS Hosting',
          slug: 'vps-hosting',
          description: 'High-performance NVMe Cloud Virtual Private Servers with dedicated CPU, root SSH access, 1Gbps unmetered bandwidth, and enterprise datacenter isolation.',
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: vpsProduct.id },
        data: { name: 'VPS Hosting', slug: 'vps-hosting', category: 'vps' },
      });
    }

    const vpsPlans = [
      {
        name: 'VPS Micro',
        price: 250000, // LKR 2,500.00 / mo
        currency: 'LKR' as const,
        billingType: 'monthly' as const,
        isPopular: false,
        badge: null,
        specsJson: {
          cpuCores: 1,
          ramGb: 2,
          storageGb: 30,
          bandwidth: 'Unmetered 1Gbps',
          region: 'Frankfurt, Germany',
          provider: 'Leaseweb Enterprise',
          rootSsh: true,
          dedicatedIpv4: false,
          deliveryNotice: 'Delivered within 24 to 72 hours',
          features: ['1 vCPU Core', '2 GB RAM', '30 GB NVMe SSD', '1 Gbps Unmetered Bandwidth', 'Region: Frankfurt, Germany', 'Provider: Leaseweb Enterprise', 'Full Root SSH Access', 'Delivered within 24 to 72 hours'],
        },
        isActive: true,
      },
      {
        name: 'VPS Standard',
        price: 500000, // LKR 5,000.00 / mo
        currency: 'LKR' as const,
        billingType: 'monthly' as const,
        isPopular: true,
        badge: 'Best Value',
        specsJson: {
          cpuCores: 2,
          ramGb: 4,
          storageGb: 80,
          bandwidth: 'Unmetered 1Gbps',
          region: 'Frankfurt, Germany',
          provider: 'Leaseweb Enterprise',
          rootSsh: true,
          dedicatedIpv4: false,
          deliveryNotice: 'Delivered within 24 to 72 hours',
          features: ['2 vCPU Cores', '4 GB RAM', '80 GB NVMe SSD', '1 Gbps Unmetered Bandwidth', 'Region: Frankfurt, Germany', 'Provider: Leaseweb Enterprise', 'Full Root SSH Access', 'Delivered within 24 to 72 hours'],
        },
        isActive: true,
      },
      {
        name: 'VPS Pro',
        price: 950000, // LKR 9,500.00 / mo
        currency: 'LKR' as const,
        billingType: 'monthly' as const,
        isPopular: false,
        badge: null,
        specsJson: {
          cpuCores: 4,
          ramGb: 8,
          storageGb: 160,
          bandwidth: 'Unmetered 1Gbps',
          region: 'Ashburn, USA',
          provider: 'Leaseweb Enterprise',
          rootSsh: true,
          dedicatedIpv4: true,
          deliveryNotice: 'Delivered within 24 to 72 hours',
          features: ['4 vCPU Cores', '8 GB RAM', '160 GB NVMe SSD', '1 Gbps Unmetered Bandwidth', 'Region: Ashburn, USA', 'Provider: Leaseweb Enterprise', 'Dedicated IPv4 Address', 'Full Root SSH Access', 'Delivered within 24 to 72 hours'],
        },
        isActive: true,
      },
      {
        name: 'VPS Enterprise',
        price: 1850000, // LKR 18,500.00 / mo
        currency: 'LKR' as const,
        billingType: 'monthly' as const,
        isPopular: false,
        badge: 'Enterprise',
        specsJson: {
          cpuCores: 8,
          ramGb: 16,
          storageGb: 320,
          bandwidth: 'Unmetered 1Gbps',
          region: 'Frankfurt, Germany',
          provider: 'Leaseweb Enterprise',
          rootSsh: true,
          dedicatedIpv4: true,
          deliveryNotice: 'Delivered within 24 to 72 hours',
          features: ['8 vCPU Cores', '16 GB RAM', '320 GB NVMe SSD', '1 Gbps Unmetered Bandwidth', 'Region: Frankfurt, Germany', 'Provider: Leaseweb Enterprise', 'Dedicated IPv4 Address', 'Full Root SSH Access', 'Delivered within 24 to 72 hours'],
        },
        isActive: true,
      },
    ];

    for (const p of vpsPlans) {
      const existing = await prisma.plan.findFirst({
        where: { productId: vpsProduct.id, name: p.name },
      });
      if (!existing) {
        await prisma.plan.create({ data: { productId: vpsProduct.id, ...p } });
      } else {
        await prisma.plan.update({ where: { id: existing.id }, data: p });
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. SMTP & EMAIL (smtp) — 5 Configured Tiers with exact specs
    // ─────────────────────────────────────────────────────────────────
    let smtpProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: 'smtp-email' }, { slug: 'smtp-mail-hosting' }, { category: 'smtp' }] },
    });
    if (!smtpProduct) {
      smtpProduct = await prisma.product.create({
        data: {
          category: 'smtp',
          name: 'SMTP & Email',
          slug: 'smtp-email',
          description: 'Enterprise Outbound SMTP & Business Email Hosting with webmail client, custom domain support, DKIM/SPF signatures, forwarding rules, and email aliases. Minimum 3-month commitment.',
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: smtpProduct.id },
        data: { name: 'SMTP & Email', slug: 'smtp-email', category: 'smtp' },
      });
    }

    const emailPlans = [
      {
        name: 'Starter Email (1GB)',
        price: 450000, // LKR 4,500.00 quarterly (LKR 1,500/mo)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        isPopular: false,
        badge: null,
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 1,
          storageQuotaMb: 1024,
          forwardingRules: 1,
          emailAliases: 2,
          maxAliases: 2,
          dailyQuota: 500,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '1 GB Storage', '1 Forwarding Rule', '2 Email Aliases', '500 Daily Send Quota', 'Webmail & SMTP/IMAP Access', 'Min 3-Month Commitment'],
        },
        isActive: true,
      },
      {
        name: 'Standard Email (5GB)',
        price: 1050000, // LKR 10,500.00 quarterly (LKR 3,500/mo)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        isPopular: true,
        badge: 'Popular',
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 5,
          storageQuotaMb: 5120,
          forwardingRules: 5,
          emailAliases: 5,
          maxAliases: 5,
          dailyQuota: 2500,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '5 GB Storage', '5 Forwarding Rules', '5 Email Aliases', '2,500 Daily Send Quota', 'Webmail & SMTP/IMAP Access', 'Min 3-Month Commitment'],
        },
        isActive: true,
      },
      {
        name: 'Pro Email (20GB)',
        price: 2250000, // LKR 22,500.00 quarterly (LKR 7,500/mo)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        isPopular: false,
        badge: null,
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 20,
          storageQuotaMb: 20480,
          forwardingRules: 20,
          emailAliases: 10,
          maxAliases: 10,
          dailyQuota: 5000,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '20 GB Storage', '20 Forwarding Rules', '10 Email Aliases', '5,000 Daily Send Quota', 'Webmail & SMTP/IMAP Access', 'Min 3-Month Commitment'],
        },
        isActive: true,
      },
      {
        name: 'Enterprise Email (50GB)',
        price: 4500000, // LKR 45,000.00 quarterly (LKR 15,000/mo)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        isPopular: false,
        badge: 'Enterprise',
        specsJson: {
          mailboxesCount: 1,
          storageLimitGb: 50,
          storageQuotaMb: 51200,
          forwardingRules: 50,
          emailAliases: 30,
          maxAliases: 30,
          dailyQuota: 10000,
          minCommitmentMonths: 3,
          features: ['1 Mailbox Included', '50 GB Storage', '50 Forwarding Rules', '30 Email Aliases', '10,000 Daily Send Quota', 'Webmail & SMTP/IMAP Access', 'Min 3-Month Commitment'],
        },
        isActive: true,
      },
      {
        name: 'Enterprise Ultimate (Custom / Unlimited)',
        price: 9000000, // LKR 90,000.00 quarterly (LKR 30,000/mo)
        currency: 'LKR' as const,
        billingType: 'quarterly' as const,
        isPopular: false,
        badge: 'VIP Ultimate',
        specsJson: {
          mailboxesCount: -1,
          storageLimitGb: -1,
          storageQuotaMb: -1,
          forwardingRules: -1,
          emailAliases: -1,
          maxAliases: -1,
          dailyQuota: 50000,
          minCommitmentMonths: 3,
          features: ['Unlimited Mailboxes', 'Unlimited Storage', 'Unlimited Forwarding Rules', 'Unlimited Email Aliases', '50,000 Daily Send Quota', 'Dedicated IP & VIP Priority Support'],
        },
        isActive: true,
      },
    ];

    for (const p of emailPlans) {
      const existing = await prisma.plan.findFirst({
        where: { productId: smtpProduct.id, name: p.name },
      });
      if (!existing) {
        await prisma.plan.create({ data: { productId: smtpProduct.id, ...p } });
      } else {
        await prisma.plan.update({ where: { id: existing.id }, data: p });
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. WEB HOSTING (web_hosting) — 1 Standard Plan per Slot
    // ─────────────────────────────────────────────────────────────────
    let webHostingProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: 'web-hosting' }, { category: 'web_hosting' }] },
    });
    if (!webHostingProduct) {
      webHostingProduct = await prisma.product.create({
        data: {
          category: 'web_hosting',
          name: 'Web Hosting',
          slug: 'web-hosting',
          description: 'High-speed cloud web hosting with GitHub auto-deployment (Public & Private repos), free SSL certificates, custom domains, and automatic commit detection. 1 Slot per purchase — buy more for multiple sites.',
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: webHostingProduct.id },
        data: { name: 'Web Hosting', slug: 'web-hosting', category: 'web_hosting' },
      });
    }

    // Keep only the single canonical plan for Web Hosting
    const webPlan = {
      name: 'Web Hosting Plan',
      ...STANDARD_SLOT_PRICE,
      isPopular: true,
      badge: '1 Slot / Site',
      specsJson: {
        storageGb: 10,
        bandwidthGb: 500,
        domainsCount: 1,
        gitAutoDeploy: true,
        autoSsl: true,
        slotCount: 1,
        features: ['1 Website Hosting Slot', '10 GB High-Speed NVMe SSD', '500 GB Bandwidth', '1 Custom Domain', 'GitHub Auto-Deploy on Push', 'Free Auto SSL Certificates', 'Buy more to host additional sites'],
      },
      isActive: true,
    };

    const existingWeb = await prisma.plan.findFirst({
      where: { productId: webHostingProduct.id, name: webPlan.name },
    });
    if (!existingWeb) {
      await prisma.plan.create({ data: { productId: webHostingProduct.id, ...webPlan } });
    } else {
      await prisma.plan.update({ where: { id: existingWeb.id }, data: webPlan });
    }

    // Remove obsolete multi-plans for web_hosting
    await prisma.plan.deleteMany({
      where: {
        productId: webHostingProduct.id,
        name: { not: webPlan.name },
        orderItems: { none: {} },
      },
    }).catch(() => null);

    // ─────────────────────────────────────────────────────────────────
    // 4. MANAGED DATABASES (database) — 1 Standard Plan per Slot
    // ─────────────────────────────────────────────────────────────────
    let dbProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: 'managed-databases' }, { category: 'database' }] },
    });
    if (!dbProduct) {
      dbProduct = await prisma.product.create({
        data: {
          category: 'database',
          name: 'Managed Databases',
          slug: 'managed-databases',
          description: 'Fully isolated managed database instances for PostgreSQL 16, MySQL 8, Redis 7 (In-Memory Cache), and MongoDB 6 with automatic backups and connection pooling. 1 Slot per database instance.',
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: dbProduct.id },
        data: { name: 'Managed Databases', slug: 'managed-databases', category: 'database' },
      });
    }

    const dbPlan = {
      name: 'Managed Database Plan',
      ...STANDARD_SLOT_PRICE,
      isPopular: true,
      badge: '1 Database Instance',
      specsJson: {
        ramMb: 1024,
        cpuCores: 1.0,
        storageGb: 10,
        engines: ['PostgreSQL 16', 'MySQL 8', 'Redis 7', 'MongoDB 6'],
        autoBackups: true,
        connectionPooling: true,
        slotCount: 1,
        features: ['1 Managed Database Container', '1024 MB Dedicated RAM', '1.0 vCPU Core', '10 GB NVMe Storage', 'PostgreSQL / MySQL / Redis / MongoDB', 'PgBouncer Connection Pooling', 'Automated Daily Backups', 'Buy more for additional databases'],
      },
      isActive: true,
    };

    const existingDb = await prisma.plan.findFirst({
      where: { productId: dbProduct.id, name: dbPlan.name },
    });
    if (!existingDb) {
      await prisma.plan.create({ data: { productId: dbProduct.id, ...dbPlan } });
    } else {
      await prisma.plan.update({ where: { id: existingDb.id }, data: dbPlan });
    }

    await prisma.plan.deleteMany({
      where: {
        productId: dbProduct.id,
        name: { not: dbPlan.name },
        orderItems: { none: {} },
      },
    }).catch(() => null);

    // ─────────────────────────────────────────────────────────────────
    // 5. APP CATALOG (app_catalog) — 1 Standard Plan per Slot
    // ─────────────────────────────────────────────────────────────────
    let catalogProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: 'app-catalog' }, { category: 'app_catalog' }] },
    });
    if (!catalogProduct) {
      catalogProduct = await prisma.product.create({
        data: {
          category: 'app_catalog',
          name: 'App Catalog',
          slug: 'app-catalog',
          description: 'One-click deployment of 15+ Docker Compose application templates (WordPress, Nextcloud, N8N, Supabase, Uptime Kuma) with automatic SSL routing and direct port exposure. 1 Slot per app stack.',
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: catalogProduct.id },
        data: { name: 'App Catalog', slug: 'app-catalog', category: 'app_catalog' },
      });
    }

    const catalogPlan = {
      name: 'App Catalog Plan',
      ...STANDARD_SLOT_PRICE,
      isPopular: true,
      badge: '1 App Stack',
      specsJson: {
        ramMb: 1024,
        memoryMb: 1024,
        cpuCores: 1.0,
        storageGb: 10,
        oneClickTemplates: true,
        autoSsl: true,
        portExposure: true,
        slotCount: 1,
        features: ['1 One-Click App Stack', '1024 MB RAM', '1.0 vCPU Core', '10 GB NVMe Storage', '15+ Docker Compose Stacks', 'Automatic SSL Routing & Port Exposure', 'Buy more for additional app stacks'],
      },
      isActive: true,
    };

    const existingCat = await prisma.plan.findFirst({
      where: { productId: catalogProduct.id, name: catalogPlan.name },
    });
    if (!existingCat) {
      await prisma.plan.create({ data: { productId: catalogProduct.id, ...catalogPlan } });
    } else {
      await prisma.plan.update({ where: { id: existingCat.id }, data: catalogPlan });
    }

    await prisma.plan.deleteMany({
      where: {
        productId: catalogProduct.id,
        name: { not: catalogPlan.name },
        orderItems: { none: {} },
      },
    }).catch(() => null);

    // ─────────────────────────────────────────────────────────────────
    // 6. BOT HOSTING (bot_hosting) — 1 Standard Plan per Slot
    // ─────────────────────────────────────────────────────────────────
    let botProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: 'bot-hosting' }, { category: 'bot_hosting' }] },
    });
    if (!botProduct) {
      botProduct = await prisma.product.create({
        data: {
          category: 'bot_hosting',
          name: 'Bot Hosting',
          slug: 'bot-hosting',
          description: '24/7 continuous runner for Discord bots (discord.js, discord.py), WhatsApp automation bots (Baileys), and Telegram bots with persistent QR session storage and auto-restart. 1 Slot per bot runner.',
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: botProduct.id },
        data: { name: 'Bot Hosting', slug: 'bot-hosting', category: 'bot_hosting' },
      });
    }

    const botPlan = {
      name: 'Bot Hosting Plan',
      ...STANDARD_SLOT_PRICE,
      isPopular: true,
      badge: '1 Bot Runner',
      specsJson: {
        ramMb: 1024,
        memoryMb: 1024,
        cpuCores: 1.0,
        storageGb: 10,
        continuousRuntime: true,
        autoRestart: true,
        persistentSession: true,
        slotCount: 1,
        platforms: ['Discord (Node/Python)', 'WhatsApp (Baileys QR)', 'Telegram'],
        features: ['1 Dedicated 24/7 Bot Runner Slot', '1024 MB RAM', '1.0 vCPU Dedicated', '10 GB NVMe Storage', 'Persistent WhatsApp Session Storage', 'Automatic Crash Recovery', 'Buy more to run additional bots'],
      },
      isActive: true,
    };

    const existingBot = await prisma.plan.findFirst({
      where: { productId: botProduct.id, name: botPlan.name },
    });
    if (!existingBot) {
      await prisma.plan.create({ data: { productId: botProduct.id, ...botPlan } });
    } else {
      await prisma.plan.update({ where: { id: existingBot.id }, data: botPlan });
    }

    await prisma.plan.deleteMany({
      where: {
        productId: botProduct.id,
        name: { not: botPlan.name },
        orderItems: { none: {} },
      },
    }).catch(() => null);

    // ─────────────────────────────────────────────────────────────────
    // 7. APP DEPLOYMENT (app_deployment) — 1 Standard Plan per Slot
    // ─────────────────────────────────────────────────────────────────
    let appDeployProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: 'app-deployment' }, { category: 'app_deployment' }] },
    });
    if (!appDeployProduct) {
      appDeployProduct = await prisma.product.create({
        data: {
          category: 'app_deployment',
          name: 'App Deployment',
          slug: 'app-deployment',
          description: 'Deploy Node.js, Python, Go, and Docker applications directly from GitHub (Public & Private repos) with automatic push-to-deploy webhooks, custom SSL domains, and environment secrets. 1 Slot per deployment.',
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: appDeployProduct.id },
        data: { name: 'App Deployment', slug: 'app-deployment', category: 'app_deployment' },
      });
    }

    const appDeployPlan = {
      name: 'App Deployment Plan',
      ...STANDARD_SLOT_PRICE,
      isPopular: true,
      badge: '1 App Slot',
      specsJson: {
        ramMb: 1024,
        memoryMb: 1024,
        cpuCores: 1.0,
        storageGb: 10,
        gitAutoDeploy: true,
        autoSsl: true,
        customDomain: true,
        slotCount: 1,
        features: ['1 Container App Deployment Slot', '1024 MB RAM', '1.0 vCPU Dedicated', '10 GB NVMe Storage', 'GitHub Push-to-Deploy Webhooks', 'Automatic SSL Routing & Custom Subdomain', 'Buy more to deploy additional apps'],
      },
      isActive: true,
    };

    const existingAppDeploy = await prisma.plan.findFirst({
      where: { productId: appDeployProduct.id, name: appDeployPlan.name },
    });
    if (!existingAppDeploy) {
      await prisma.plan.create({ data: { productId: appDeployProduct.id, ...appDeployPlan } });
    } else {
      await prisma.plan.update({ where: { id: existingAppDeploy.id }, data: appDeployPlan });
    }

    await prisma.plan.deleteMany({
      where: {
        productId: appDeployProduct.id,
        name: { not: appDeployPlan.name },
        orderItems: { none: {} },
      },
    }).catch(() => null);

    // ─────────────────────────────────────────────────────────────────
    // Primary Compute Node
    // ─────────────────────────────────────────────────────────────────
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
            'app_deployment',
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

    logger.info('Successfully seeded all 7 preconfigured product categories and pricing plans!');
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
