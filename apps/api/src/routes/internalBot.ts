import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { fulfillOrder } from '../lib/orderFulfillment';
import { notifyCustomer } from '../lib/notifications';
import { renderPaymentReviewEmail } from '../lib/emailTemplates';

export const internalBotRouter = Router();

// Middleware: Verify internal secret from either Discord or WhatsApp bot
internalBotRouter.use((req: Request, res: Response, next) => {
  const secret = req.headers['x-internal-secret'];
  if (typeof secret !== 'string' || !secret) return res.status(401).json({ error: 'Unauthorized' });

  const validSecrets = [env.whatsappInternalSecret, env.discordInternalSecret].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );

  if (validSecrets.length === 0) {
    return res.status(401).json({ error: 'Unauthorized: Bot secrets not configured' });
  }

  const key = 'shanutechx-bot-internal';

  const isValid = validSecrets.some((s) =>
    crypto.timingSafeEqual(
      crypto.createHmac('sha256', key).update(secret).digest(),
      crypto.createHmac('sha256', key).update(s).digest()
    )
  );

  if (!isValid) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

/**
 * GET /api/internal/customer-summary?phone=1234567890
 * Retrieve deployments & open tickets for a customer matched by phone number
 */
internalBotRouter.get('/internal/customer-summary', async (req: Request, res: Response) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.replace(/[^0-9]/g, '') : '';
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const last9 = phone.slice(-9);
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phoneNumber: phone },
        { phoneNumber: `+${phone}` },
        { phoneNumber: { endsWith: last9 } },
      ],
    },
  });

  if (!user) {
    return res.json({ user: null, deployments: [], tickets: [] });
  }

  const [deployments, tickets] = await Promise.all([
    prisma.deployment.findMany({
      where: { userId: user.id, status: { in: ['running', 'building', 'stopped'] } },
      select: { id: true, subdomain: true, status: true, customDomain: true },
      take: 10,
    }),
    prisma.ticket.findMany({
      where: { userId: user.id, status: { in: ['open', 'pending'] } },
      select: { id: true, subject: true, status: true, priority: true },
      take: 10,
    }),
  ]);

  res.json({ user: { id: user.id, email: user.email, displayName: user.displayName }, deployments, tickets });
});

/**
 * GET /api/internal/deployments-summary?email=customer@example.com
 * Retrieve deployments for a customer matched by email
 */
internalBotRouter.get('/internal/deployments-summary', async (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'Customer not found' });

  const deployments = await prisma.deployment.findMany({
    where: { userId: user.id },
    select: { id: true, subdomain: true, status: true, customDomain: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const formatted = deployments.map((d) => ({
    id: d.id,
    name: d.subdomain || d.id,
    subdomain: d.subdomain,
    status: d.status,
    url: d.customDomain ? `https://${d.customDomain}` : (d.subdomain ? `https://${d.subdomain}.${env.rootDomain}` : null),
  }));

  res.json({ deployments: formatted });
});

/**
 * GET /api/internal/open-tickets
 * Retrieve open customer support tickets for internal bots (Discord/WhatsApp)
 */
internalBotRouter.get('/internal/open-tickets', async (_req: Request, res: Response) => {
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: ['open', 'pending'] } },
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: { user: { select: { email: true, displayName: true } } },
  });

  res.json({ tickets });
});

/**
 * GET /api/internal/all-deployments
 * Retrieve all active container deployments across nodes
 */
internalBotRouter.get('/internal/all-deployments', async (_req: Request, res: Response) => {
  const deployments = await prisma.deployment.findMany({
    take: 30,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      subdomain: true,
      customDomain: true,
      status: true,
      node: { select: { label: true, ip: true } },
    },
  });

  const formatted = deployments.map((d) => ({
    id: d.id,
    name: d.subdomain ? `${d.subdomain}.${env.rootDomain}` : d.id,
    status: d.status,
    publicUrl: d.customDomain ? `https://${d.customDomain}` : (d.subdomain ? `https://${d.subdomain}.${env.rootDomain}` : null),
    node: d.node,
  }));

  res.json({ deployments: formatted });
});

/**
 * POST /api/internal/review-payment
 * Review manual payment proof (Approve or Decline) right inside Discord
 */
internalBotRouter.post('/internal/review-payment', async (req: Request, res: Response) => {
  const { orderId, approve, reason, reviewedBy } = req.body || {};
  if (!orderId || typeof approve !== 'boolean') {
    return res.status(400).json({ error: 'orderId and approve (boolean) are required' });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: true,
      user: true,
      items: { include: { plan: { include: { product: true } } } },
    },
  });

  if (!order || !order.payments || order.payments.length === 0) {
    return res.status(404).json({ error: 'Order or associated payment proof not found' });
  }

  if (order.status === 'paid' && approve) {
    return res.status(400).json({ error: 'Order is already marked as paid' });
  }

  const targetPayment = order.payments[0];
  const newOrderStatus = approve ? 'paid' : 'failed';
  const paymentStatus = approve ? 'manually_approved' : 'rejected';

  const claim = await prisma.payment.updateMany({
    where: { id: targetPayment.id, status: { in: ['manual_review', 'pending'] } },
    data: {
      status: paymentStatus,
      reviewedAt: new Date(),
      rejectionReason: approve ? null : reason || 'Declined via Discord review',
    },
  });

  if (claim.count === 0) {
    const latest = await prisma.payment.findUnique({ where: { id: targetPayment.id }, select: { status: true } });
    return res.status(409).json({ error: `Payment already reviewed (status: ${latest?.status ?? 'unknown'})` });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: newOrderStatus },
  });

  if (approve) {
    try {
      await fulfillOrder(order.id);
    } catch (err: any) {
      return res.status(500).json({ error: `Payment approved, but order fulfillment failed: ${err.message}` });
    }
  }

  // Notify customer of review outcome
  const emailRender = renderPaymentReviewEmail({
    orderId: order.id,
    approved: approve,
    reason: reason || undefined,
  });

  void notifyCustomer(order.user, emailRender.text);

  res.json({
    ok: true,
    orderId: order.id,
    status: newOrderStatus,
    reviewedBy: reviewedBy || 'Discord Bot',
  });
});
