import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ownedResourceWhere } from '../middleware/rbac';
import { parsePagination } from '../lib/pagination';
import { activateSubscriptionsForOrder } from '../lib/billing';
import { idempotent } from '../middleware/idempotent';
import { convertToLkr, Currency } from '../lib/currency';
import { fireWebhook } from '../lib/webhooks';
import { notifyDiscordChannel } from '../lib/discordWebhooks';
import { fulfillOrder } from '../lib/orderFulfillment';
import { sendInvoiceDeliveryNotification } from '../lib/notifications';
import { logger } from '../lib/logger';


export const ordersRouter = Router();

ordersRouter.use(requireAuth);

/** Gets (or creates) the customer's single open draft order — their "cart". */
async function getOrCreateDraftOrder(userId: string) {
  const existing = await prisma.order.findFirst({
    where: { userId, status: 'draft' },
  });
  if (existing) return existing;

  return prisma.order.create({ data: { userId, status: 'draft', total: 0, totalLkr: 0 } });
}

/**
 * Recomputes both `total` (in the order's own currency) and `totalLkr`
 * (always LKR — what payment verification actually compares against).
 * An order's currency is fixed to whatever its first item was priced in;
 * see addItemSchema's handler for where mixed-currency carts are rejected
 * rather than silently averaged or summed across currencies.
 *
 * Each OrderItem is priced from `plan` (new catalog) if present, falling
 * back to the legacy `service` relation — never both on the same row.
 */
async function recalculateTotal(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    include: { service: true, plan: true },
  });
  type ItemWithPricing = (typeof items)[number];

  function priceOf(item: ItemWithPricing): { price: number; currency: Currency } {
    if (item.plan) {
      return { price: item.plan.price, currency: item.plan.currency as Currency };
    }
    if (item.service) {
      return { price: item.service.price, currency: item.service.currency as Currency };
    }
    // BUG-M04 FIX: Guard against data-corruption where an OrderItem has neither
    // a plan nor a service (e.g. after a hard-delete). Return zero-price to avoid
    // a runtime crash and let the order proceed; log for investigation.
    logger.error({ orderItemId: item.id, orderId }, 'OrderItem has neither plan nor service \u2014 using zero price. Data may be corrupted.');
    return { price: 0, currency: 'LKR' as Currency };
  }

  const currency: Currency = items[0] ? priceOf(items[0]).currency : 'LKR';
  const total = items.reduce((sum: number, item: ItemWithPricing) => sum + priceOf(item).price * item.quantity, 0);
  const totalLkr = convertToLkr(total, currency);

  for (const item of items) {
    const p = priceOf(item);
    const itemLkr = convertToLkr(p.price, p.currency);
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { priceLkr: itemLkr },
    });
  }

  await prisma.order.update({ where: { id: orderId }, data: { total, totalLkr, currency } });
  return { total, totalLkr, currency };
}

ordersRouter.get('/cart', async (req: AuthedRequest, res) => {
  const order = await getOrCreateDraftOrder(req.user!.id);
  const items = await prisma.orderItem.findMany({
    where: { orderId: order.id },
    include: { service: true, plan: { include: { product: true } } },
  });
  res.json({ order, items });
});

const addItemSchema = z
  .object({
    serviceId: z.string().optional(),
    planId: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    configJson: z.record(z.unknown()).optional(),
  })
  .refine((data) => !!data.serviceId !== !!data.planId, {
    message: 'Provide exactly one of serviceId (legacy) or planId (current catalog)',
  });

ordersRouter.post('/cart/items', async (req: AuthedRequest, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  let itemCurrency: Currency;
  if (parsed.data.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
    if (!plan || !plan.isActive) return res.status(404).json({ error: 'Plan not found' });
    itemCurrency = plan.currency as Currency;
  } else {
    const service = await prisma.service.findUnique({ where: { id: parsed.data.serviceId } });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    itemCurrency = service.currency as Currency;
  }

  const order = await getOrCreateDraftOrder(req.user!.id);

  const existingCount = await prisma.orderItem.count({ where: { orderId: order.id } });
  if (existingCount > 0) {
    const firstItem = await prisma.orderItem.findFirst({
      where: { orderId: order.id },
      include: { service: true, plan: true },
    });
    const firstCurrency = (firstItem?.plan?.currency ?? firstItem?.service?.currency) as Currency | undefined;
    if (firstItem && firstCurrency !== itemCurrency) {
      return res.status(409).json({
        error: `Your cart contains ${firstCurrency} items. Cannot mix currencies in a single order.`,
        currentCurrency: firstCurrency,
        attemptedCurrency: itemCurrency,
        suggestion: `Please checkout your ${firstCurrency} items first, or clear your cart to add ${itemCurrency} items.`,
        canClearCart: true,
      });
    }
  }

  // One row per service/plan per cart — adding the same one again just
  // bumps the quantity, rather than creating duplicate line items.
  const existingItem = parsed.data.planId
    ? await prisma.orderItem.findFirst({ where: { orderId: order.id, planId: parsed.data.planId } })
    : await prisma.orderItem.findFirst({ where: { orderId: order.id, serviceId: parsed.data.serviceId } });

  const item = existingItem
    ? await prisma.orderItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + parsed.data.quantity },
      })
    : await prisma.orderItem.create({
        data: {
          orderId: order.id,
          serviceId: parsed.data.serviceId ?? null,
          planId: parsed.data.planId ?? null,
          quantity: parsed.data.quantity,
          configJson: parsed.data.configJson as any,
        },
      });

  const { total, currency } = await recalculateTotal(order.id);
  res.status(201).json({ item, total, currency });
});

ordersRouter.delete('/cart', async (req: AuthedRequest, res) => {
  const order = await getOrCreateDraftOrder(req.user!.id);
  
  // Delete all items from the cart
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  
  // Reset order total
  await prisma.order.update({
    where: { id: order.id },
    data: { total: 0, totalLkr: 0 },
  });
  
  res.json({ message: 'Cart cleared successfully', total: 0, currency: null });
});

ordersRouter.delete('/cart/items/:itemId', async (req: AuthedRequest, res) => {
  const item = await prisma.orderItem.findUnique({
    where: { id: req.params.itemId },
    include: { order: true },
  });

  if (!item || item.order.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Item not found' });
  }

  await prisma.orderItem.delete({ where: { id: item.id } });
  const { total, currency } = await recalculateTotal(item.orderId);
  res.json({ total, currency });
});

/**
 * Finalizes the cart into an order. A $0 order (free-tier services) is
 * marked paid immediately with no payment step — there's nothing to verify.
 * Anything with a real total goes to "awaiting_payment" as before, where
 * the customer uploads a proof or an SMS auto-matches it.
 */
ordersRouter.post('/cart/checkout', idempotent, async (req: AuthedRequest, res) => {
  const order = await getOrCreateDraftOrder(req.user!.id);
  const itemCount = await prisma.orderItem.count({ where: { orderId: order.id } });

  if (itemCount === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const { total, totalLkr, currency } = await recalculateTotal(order.id);

  if (totalLkr === 0) {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'paid' },
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'manual',
        status: 'auto_approved',
        confidenceScore: 100,
        extractedJson: { note: 'Free-tier order — no payment required' },
      },
    });
    
    // Create invoice for free orders (pdfUrl can be null)
    await prisma.invoice.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        pdfUrl: null, // No PDF generation needed for $0 orders
      },
      update: {},
    });

    await activateSubscriptionsForOrder(order.id);
    await fulfillOrder(order.id);
    void fireWebhook(req.user!.id, 'order_paid', { orderId: order.id, total, currency: currency ?? 'LKR' });
    void notifyDiscordChannel('new_order', { 'Order': order.id, 'Customer': req.user!.email, 'Total': `${total} ${currency ?? 'LKR'}`, 'Status': 'paid (free)' });

    void sendInvoiceDeliveryNotification(
      req.user!,
      order.id,
      0,
      [{ name: 'Free Cloud Package', quantity: 1, price: 0 }]
    ).catch(() => {});

    return res.json({
      order: updated,
      total,
      currency: currency ?? 'LKR',
      free: true,
    });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'awaiting_payment' },
  });

  void notifyDiscordChannel('new_order', { 'Order': order.id, 'Customer': req.user!.email, 'Total': `${total} ${currency ?? 'LKR'}`, 'Status': 'awaiting payment' });

  res.json({
    order: updated,
    total,
    currency,
    free: false,
  });
});

ordersRouter.get('/orders', async (req: AuthedRequest, res) => {
  // Admin scoped to assigned customers' orders; dev sees all.
  const where = await ownedResourceWhere(req);
  const { take, skip } = parsePagination(req.query);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { service: true, plan: { include: { product: true } } } }, payments: true },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ orders, total, take, skip });
});
