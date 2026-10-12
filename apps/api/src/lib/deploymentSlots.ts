import { prisma } from './prisma';
import { logger } from './logger';

export class DeploymentSlotError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'DeploymentSlotError';
    this.statusCode = statusCode;
  }
}

/**
 * Checks whether an OrderItem is for a hosting service/plan that grants a deployment slot.
 * Excludes VPS, SMTP/Email, and Managed Databases which have their own dedicated resources.
 */
export function isHostingOrderItem(item: {
  plan?: { product?: { category?: string | null; name?: string | null } | null; name?: string | null } | null;
  service?: { name?: string | null; serviceType?: string | null } | null;
}): boolean {
  const productCategory = (item.plan?.product?.category || '').toLowerCase();
  const productName = (item.plan?.product?.name || item.plan?.name || item.service?.name || '').toLowerCase();
  const serviceType = (item.service?.serviceType || '').toLowerCase();

  // Exclude non-deployment services
  if (productCategory === 'vps' || productName.includes('vps') || serviceType === 'vps') {
    return false;
  }
  if (
    productCategory === 'smtp' ||
    productCategory === 'email' ||
    productCategory === 'mail' ||
    productCategory === 'smtp_hosting' ||
    productCategory === 'email_hosting' ||
    productName.includes('smtp') ||
    productName.includes('email') ||
    (productName.includes('mail') && !productName.includes('gmail')) ||
    serviceType === 'smtp'
  ) {
    return false;
  }
  if (
    productCategory === 'database' ||
    productName.includes('mysql') ||
    productName.includes('postgres') ||
    productName.includes('redis') ||
    productName.includes('mongodb')
  ) {
    return false;
  }

  // Include known hosting categories
  if (
    productCategory === 'web_hosting' ||
    productCategory === 'bot_hosting' ||
    productCategory === 'docker_hosting' ||
    productCategory === 'app_catalog' ||
    productCategory === 'node_hosting' ||
    productCategory === 'python_hosting' ||
    productCategory === 'hosting'
  ) {
    return true;
  }

  const hostingServiceTypes = [
    'web_hosting',
    'node_hosting',
    'python_hosting',
    'discordbot_python',
    'discordbot_node',
    'docker_hosting',
  ];
  if (hostingServiceTypes.includes(serviceType)) {
    return true;
  }

  // Fallback: If it's a paid item not matching VPS/SMTP/DB, treat as hosting slot
  return true;
}

/**
 * Splits any OrderItem with quantity > 1 into individual unit OrderItem records (quantity = 1 each).
 * This ensures that each purchased unit gets its own distinct database record and deployment slot.
 */
export async function splitOrderItemsIntoUnits(orderId: string): Promise<void> {
  const multiQtyItems = await prisma.orderItem.findMany({
    where: { orderId, quantity: { gt: 1 } },
  });

  for (const item of multiQtyItems) {
    const extraQty = item.quantity - 1;
    // 1. Set the original row to quantity 1
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { quantity: 1 },
    });

    // 2. Create extraQty individual unit records for the same order
    for (let i = 0; i < extraQty; i++) {
      await prisma.orderItem.create({
        data: {
          orderId: item.orderId,
          serviceId: item.serviceId,
          planId: item.planId,
          priceLkr: item.priceLkr,
          quantity: 1,
          configJson: item.configJson ?? undefined,
        },
      });
    }

    logger.info(
      { orderId, orderItemId: item.id, unitsCreated: extraQty },
      'splitOrderItemsIntoUnits: Split multi-quantity order item into individual unit records'
    );
  }
}

export interface DeploymentSlotInfo {
  orderItemId: string;
  orderId: string;
  planName: string;
  priceLkr: number;
  purchasedAt: Date;
  isUsed: boolean;
  deployment: {
    id: string;
    subdomain: string | null;
    status: string;
  } | null;
}

/**
 * Retrieves all deployment slots (purchased hosting units) for a user, indicating
 * which slots are currently in use and which are available.
 */
export async function getAvailableDeploymentSlots(userId: string): Promise<{
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  slots: DeploymentSlotInfo[];
}> {
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        userId,
        status: 'paid',
      },
    },
    include: {
      order: true,
      plan: { include: { product: true } },
      service: true,
      deployment: {
        select: {
          id: true,
          subdomain: true,
          status: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const hostingItems = orderItems.filter(isHostingOrderItem);

  const slots: DeploymentSlotInfo[] = hostingItems.map((item) => {
    const isUsed = Boolean(item.deployment);
    const planName = item.plan?.name || item.plan?.product?.name || item.service?.name || 'Hosting Plan';

    return {
      orderItemId: item.id,
      orderId: item.orderId,
      planName,
      priceLkr: item.priceLkr ?? 0,
      purchasedAt: item.order.createdAt,
      isUsed,
      deployment: item.deployment
        ? {
            id: item.deployment.id,
            subdomain: item.deployment.subdomain,
            status: item.deployment.status,
          }
        : null,
    };
  });

  const totalSlots = slots.length;
  const usedSlots = slots.filter((s) => s.isUsed).length;
  const availableSlots = totalSlots - usedSlots;

  return { totalSlots, usedSlots, availableSlots, slots };
}

export interface ClaimSlotOptions {
  preferredOrderItemId?: string;
  isAdminOrDev?: boolean;
  isPreview?: boolean;
}

/**
 * Enforces server-side 1-to-1 purchase-to-deployment binding.
 * Each purchased unit grants exactly one deployment.
 * Returns the orderItemId to bind to the new deployment.
 *
 * - Admin/Dev users bypass slot limits if no specific orderItemId is provided.
 * - Preview branch deployments attach to parent deployments and do not consume a slot.
 * - Regular customers must have an available (unbound) purchased unit slot.
 */
export async function claimDeploymentSlot(
  userId: string,
  options?: ClaimSlotOptions
): Promise<{ orderItemId: string | null }> {
  // 1. Preview deployments are lightweight branch environments of a parent deployment
  if (options?.isPreview) {
    return { orderItemId: null };
  }

  // 2. Dev superusers / Admin staff bypass customer slot purchases if no slot specified
  if (options?.isAdminOrDev && !options?.preferredOrderItemId) {
    return { orderItemId: null };
  }

  // 3. User requested a specific orderItemId slot
  if (options?.preferredOrderItemId) {
    const item = await prisma.orderItem.findUnique({
      where: { id: options.preferredOrderItemId },
      include: {
        order: true,
        plan: { include: { product: true } },
        service: true,
        deployment: { select: { id: true, status: true } },
      },
    });

    if (!item) {
      throw new DeploymentSlotError('Purchased slot not found.', 404);
    }

    if (!options?.isAdminOrDev && item.order.userId !== userId) {
      throw new DeploymentSlotError('You do not own this purchase record.', 403);
    }

    if (!options?.isAdminOrDev && item.order.status !== 'paid') {
      throw new DeploymentSlotError('Payment for this order has not been completed.', 403);
    }

    if (!isHostingOrderItem(item)) {
      throw new DeploymentSlotError(
        'The specified purchase record is for a non-hosting product (e.g. VPS, Mailbox, or Managed Database) and cannot be used as an application deployment slot.',
        400
      );
    }

    if (item.deployment) {
      throw new DeploymentSlotError(
        `Deployment slot ${options.preferredOrderItemId} is already bound to deployment ${item.deployment.id} and cannot be reused. Each purchased unit grants exactly one deployment. Please purchase an additional plan or unit to deploy more applications.`,
        403
      );
    }

    return { orderItemId: item.id };
  }

  // 4. Auto-allocate an available (unbound) slot for regular customers
  const candidateItems = await prisma.orderItem.findMany({
    where: {
      order: {
        userId,
        status: 'paid',
      },
      deployment: null, // Strictly unbound slots only
    },
    include: {
      order: true,
      plan: { include: { product: true } },
      service: true,
    },
    orderBy: { id: 'asc' },
  });

  const availableItem = candidateItems.find(isHostingOrderItem);

  if (!availableItem) {
    if (options?.isAdminOrDev) {
      return { orderItemId: null };
    }
    throw new DeploymentSlotError(
      'No available deployment slots. Each purchased unit grants exactly one deployment. Please purchase an additional plan or unit to deploy more applications.',
      403
    );
  }

  return { orderItemId: availableItem.id };
}
