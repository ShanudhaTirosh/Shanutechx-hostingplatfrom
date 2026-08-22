import { prisma } from './prisma';
import { logger } from './logger';

export async function ensureDefaultProductsSeeded(): Promise<void> {
  try {
    const existingCount = await prisma.product.count().catch(() => 0);
    if (existingCount > 0) {
      // Products already exist in DB
      return;
    }

    logger.info('No products found in catalog. Seeding default platform products and plans...');

    // 1. SMTP Mail Hosting Product & Plans
    const smtpProduct = await prisma.product.create({
      data: {
        category: 'smtp_hosting',
        name: 'Enterprise Outbound SMTP & Mail Hosting',
        slug: 'smtp-mail-hosting',
        description: 'Self-hosted high-reputation SMTP mailer with webmail, custom domain support, DKIM/SPF signatures, and auto-aliases.',
        isActive: true,
        plans: {
          create: [
            {
              name: 'Starter Mail Hosting',
              price: 150000, // LKR 1,500.00
              currency: 'LKR',
              billingType: 'monthly',
              specsJson: {
                storageGB: 5,
                dailyQuota: 500,
                maxAliases: 3,
                customDomain: true,
                webmail: true,
                ssl: true,
              },
              isActive: true,
            },
            {
              name: 'Professional Mail Hosting',
              price: 350000, // LKR 3,500.00
              currency: 'LKR',
              billingType: 'monthly',
              specsJson: {
                storageGB: 25,
                dailyQuota: 2500,
                maxAliases: 5,
                customDomain: true,
                webmail: true,
                ssl: true,
              },
              isActive: true,
            },
            {
              name: 'Enterprise Mail Hosting',
              price: 750000, // LKR 7,500.00
              currency: 'LKR',
              billingType: 'monthly',
              specsJson: {
                storageGB: 100,
                dailyQuota: 10000,
                maxAliases: 10,
                customDomain: true,
                webmail: true,
                ssl: true,
              },
              isActive: true,
            },
          ],
        },
      },
    });

    // 2. High-Performance VPS Hosting
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

    // 3. Node.js & Web Application Hosting
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

    // 4. Ensure Primary Compute Node exists with all tags for local & deployment hosting
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
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to auto-seed default products');
  }
}
