/**
 * One-off data migration: Service -> Product + Plan.
 *
 * Run once after applying migration 20260725120000_phase1_manual_payments_catalog_webhooks,
 * and BEFORE flipping any route over to read from Product/Plan.
 *
 * What it does:
 *   - For every Service row, creates one Product (one Plan per Service — if you
 *     want several tiers under one Product, e.g. "Node Hosting" with
 *     Starter/Pro/Business plans, do that by hand afterwards in the admin UI;
 *     this script's job is just "nothing is lost", not "design your new catalog").
 *   - Backfills OrderItem.planId for every historical OrderItem that referenced
 *     the old serviceId, so old orders keep resolving through the new model too.
 *   - Is idempotent: safe to re-run — it skips Services that already have a
 *     matching Product (matched by slug).
 *
 * Usage:
 *   cd packages/db
 *   npm run migrate:services-to-products
 *
 * This does NOT delete the Service table or ServiceType enum. Do that in a
 * separate, later migration once every route/UI reads exclusively from
 * Product/Plan and you've confirmed nothing regressed.
 */
import { PrismaClient, ServiceType, ProductCategory, BillingPeriod, PlanBillingType } from '@prisma/client';

const prisma = new PrismaClient();

/** Legacy ServiceType -> new ProductCategory. Adjust before running if your
 *  business has since introduced a clearer split (e.g. you may want
 *  `docker_hosting` split across node_app_hosting/python_app_hosting instead
 *  of lumping it into app_catalog — this script picks the closest safe
 *  default, not a business decision). */
const CATEGORY_MAP: Record<ServiceType, ProductCategory> = {
  web_hosting: 'web_hosting',
  node_hosting: 'node_app_hosting',
  python_hosting: 'python_app_hosting',
  discordbot_python: 'discordbot_python',
  discordbot_node: 'discordbot_node',
  vps: 'vps',
  smtp: 'smtp_hosting',
  livekit: 'app_catalog',
  docker_hosting: 'app_catalog',
  mongodb_hosting: 'database_hosting',
};

/** Legacy BillingPeriod -> new PlanBillingType (same set, renamed). */
const BILLING_MAP: Record<BillingPeriod, PlanBillingType> = {
  one_time: 'one_time',
  monthly: 'monthly',
  yearly: 'yearly',
};

function slugify(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  // Suffix with a short id fragment so two Services with the same name never collide.
  return `${base}-${id.slice(0, 6)}`;
}

async function main() {
  const services = await prisma.service.findMany();
  console.log(`Found ${services.length} legacy Service rows.`);

  let created = 0;
  let skipped = 0;
  let backfilled = 0;

  for (const service of services) {
    const slug = slugify(service.name, service.id);

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      skipped++;
      continue;
    }

    const category = CATEGORY_MAP[service.type];
    const billingType = BILLING_MAP[service.billingPeriod];

    const product = await prisma.product.create({
      data: {
        category,
        name: service.name,
        slug,
        description: `Migrated from legacy Service ${service.id} (${service.type}).`,
        isActive: true,
        plans: {
          create: [
            {
              name: 'Default',
              price: service.price,
              currency: service.currency,
              billingType,
              specsJson: service.nodeId ? { legacyNodeId: service.nodeId } : undefined,
              isActive: true,
            },
          ],
        },
      },
      include: { plans: true },
    });

    created++;
    const plan = product.plans[0];

    // Backfill planId on every historical OrderItem that pointed at this Service.
    const { count } = await prisma.orderItem.updateMany({
      where: { serviceId: service.id, planId: null },
      data: { planId: plan.id },
    });
    backfilled += count;

    console.log(`  + Product "${product.name}" (${product.slug}) <- Service ${service.id}, backfilled ${count} order item(s).`);
  }

  console.log(`\nDone. Created ${created} products, skipped ${skipped} (already migrated), backfilled ${backfilled} order items.`);
  console.log('Next: review the new Products & Plans in /admin/products, then re-point checkout/catalog routes at Plan instead of Service.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
