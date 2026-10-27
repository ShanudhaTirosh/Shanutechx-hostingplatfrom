import { prisma } from '../index';

async function main() {
  const count = await prisma.node.count();
  if (count === 0) {
    const node = await prisma.node.create({
      data: {
        label: 'ShanuTechX Primary Cluster Node',
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
        cpuUsedPct: 12.5,
        ramUsedMb: 3500,
        diskUsedGb: 28,
        lastSeenAt: new Date(),
      },
    });
    console.log('[OK] Created primary compute node:', node);
  } else {
    // Update existing nodes to make sure they have node-hosting tag
    await prisma.node.updateMany({
      data: {
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
      },
    });
    console.log('[OK] Updated existing nodes with full role tags suite!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
