import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { notifyDiscordChannel } from '../lib/discordWebhooks';
import { notifyAdmins } from '../lib/notifications';

/**
 * AI-subscription checkout items (Gemini Pro, GPT Pro, Lovable, Canva seats,
 * etc.) are never auto-provisioned — see architecture plan section 3.2.
 * The customer's popup has a single "Open Ticket" button; this is what it
 * calls. No free text from the customer — the reason is filled in here.
 */
export const aiSubscriptionRouter = Router();

aiSubscriptionRouter.use(requireAuth);

/** Idempotent: calling this twice for the same order item returns the same ticket. */
aiSubscriptionRouter.post('/order-items/:id/ai-subscription-ticket', async (req: AuthedRequest, res) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: req.params.id },
    include: {
      order: { include: { user: true } },
      plan: { include: { product: true } },
      aiSubscriptionRequest: { include: { ticket: true } },
    },
  });

  if (!orderItem || orderItem.order.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Order item not found' });
  }
  if (!orderItem.plan || orderItem.plan.product.category !== 'ai_subscription') {
    return res.status(400).json({ error: 'This order item is not an AI subscription product' });
  }

  if (orderItem.aiSubscriptionRequest?.ticket) {
    return res.json({ ticket: orderItem.aiSubscriptionRequest.ticket, alreadyExisted: true });
  }

  const reason = `AI subscription activation: ${orderItem.plan.name}, order #${orderItem.orderId}`;

  const ticket = await prisma.ticket.create({
    data: {
      userId: req.user!.id,
      orderId: orderItem.orderId,
      subject: reason,
      status: 'open',
      priority: 'medium',
      messages: {
        create: {
          senderId: req.user!.id,
          senderRole: 'customer',
          body: `Please activate my ${orderItem.plan.name} (${orderItem.plan.product.name}) subscription for order #${orderItem.orderId}.`,
        },
      },
    },
  });

  await prisma.aiSubscriptionRequest.upsert({
    where: { orderItemId: orderItem.id },
    create: { orderItemId: orderItem.id, ticketId: ticket.id },
    update: { ticketId: ticket.id },
  });

  void notifyAdmins(`New AI subscription activation request: ${reason}`);
  void notifyDiscordChannel('new_ai_subscription_request', {
    'Order': orderItem.orderId,
    'Customer': orderItem.order.user.email,
    'Plan': orderItem.plan.name,
    'Ticket': ticket.id,
  });

  res.status(201).json({ ticket, alreadyExisted: false });
});

/** Lets the popup check whether a ticket already exists before showing "Open Ticket" vs "View Ticket". */
aiSubscriptionRouter.get('/order-items/:id/ai-subscription-ticket', async (req: AuthedRequest, res) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: req.params.id },
    include: { order: true, aiSubscriptionRequest: { include: { ticket: true } } },
  });
  if (!orderItem || orderItem.order.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Order item not found' });
  }
  res.json({ ticket: orderItem.aiSubscriptionRequest?.ticket ?? null });
});
