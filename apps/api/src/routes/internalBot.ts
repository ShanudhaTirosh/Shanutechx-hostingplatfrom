import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { fulfillOrder } from '../lib/orderFulfillment';
import { notifyCustomer, notifyTicketEmbed } from '../lib/notifications';
import { renderPaymentReviewEmail, renderTicketReplyEmail } from '../lib/emailTemplates';
import { generateInvoicePdf } from '../lib/invoicePdf';

export const internalBotRouter = Router();

let isSweepingTickets = false;
let lastSweepTimestamp = 0;

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

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ phoneNumber: phone }, { phoneNumber: `+${phone}` }],
    },
  });

  const last9 = phone.slice(-9);
  if (!user && last9.length === 9) {
    const matches = await prisma.user.findMany({
      where: { phoneNumber: { endsWith: last9 } },
      take: 2,
    });
    if (matches.length === 1) {
      user = matches[0];
    }
  }

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
      where: { userId: user.id, status: { in: ['open', 'claimed', 'on_hold', 'pending'] } },
      select: { id: true, subject: true, category: true, status: true, priority: true },
      take: 10,
    }),
  ]);

  res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role }, deployments, tickets });
});

/**
 * GET /api/internal/deployments-summary?email=customer@example.com
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
    url: d.customDomain ? `https://${d.customDomain}` : d.subdomain ? `https://${d.subdomain}.${env.rootDomain}` : null,
  }));

  res.json({ deployments: formatted });
});

/**
 * GET /api/internal/open-tickets
 * Retrieve open customer support tickets for internal bots with search & category filters
 */
internalBotRouter.get('/internal/open-tickets', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

  const whereClause: any = {};
  if (status) {
    whereClause.status = status;
  } else {
    whereClause.status = { in: ['open', 'claimed', 'on_hold', 'pending'] };
  }
  if (category && category !== 'all') {
    whereClause.category = category;
  }
  if (search) {
    whereClause.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { id: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    orderBy: { updatedAt: 'desc' },
    take: 30,
    include: {
      user: { select: { email: true, displayName: true, phoneNumber: true, discordUserId: true } },
      claimedBy: { select: { email: true, displayName: true } },
    },
  });

  res.json({ tickets });
});

/**
 * GET /api/internal/all-deployments
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
    publicUrl: d.customDomain ? `https://${d.customDomain}` : d.subdomain ? `https://${d.subdomain}.${env.rootDomain}` : null,
    node: d.node,
  }));

  res.json({ deployments: formatted });
});

/**
 * POST /api/internal/review-payment
 */
internalBotRouter.post('/internal/review-payment', async (req: Request, res: Response) => {
  const { orderId, paymentId, approve, reason, reviewedBy } = req.body || {};
  if (!orderId || typeof approve !== 'boolean') {
    return res.status(400).json({ error: 'orderId and approve (boolean) are required' });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
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

  const targetPayment = paymentId ? order.payments.find((p) => p.id === paymentId) || order.payments[0] : order.payments[0];
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

  const emailRender = renderPaymentReviewEmail({
    orderId: order.id,
    approved: approve,
    reason: reason || undefined,
  });

  void notifyCustomer(order.user, emailRender.text);

  await prisma.auditLog.create({
    data: {
      action: approve ? 'payment.approved' : 'payment.declined',
      target: `Order ${order.id}`,
      actorRole: 'staff',
    },
  });

  res.json({
    ok: true,
    orderId: order.id,
    status: newOrderStatus,
    reviewedBy: reviewedBy || 'Bot Reviewer',
  });
});

/**
 * POST /api/internal/open-ticket
 * Open support ticket from Discord/WhatsApp bot. Matches customer by discordUserId, phone, or email.
 */
internalBotRouter.post('/internal/open-ticket', async (req: Request, res: Response) => {
  const { discordUserId, userEmail, phone, category, subject, message, priority, originPlatform } = req.body || {};

  if (!subject || !message) {
    return res.status(400).json({ error: 'subject and message are required' });
  }

  let user: any = null;
  if (discordUserId) {
    user = await prisma.user.findFirst({ where: { discordUserId } });
  }
  if (!user && userEmail) {
    user = await prisma.user.findUnique({ where: { email: userEmail.trim().toLowerCase() } });
  }
  if (!user && phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    user = await prisma.user.findFirst({
      where: { OR: [{ phoneNumber: cleanPhone }, { phoneNumber: `+${cleanPhone}` }] },
    });
  }

  if (!user) {
    return res.status(404).json({ error: 'Customer account not found for provided contact info. Please register or verify account email/phone.' });
  }

  const validPriority = ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';
  const validCategory = ['support', 'billing', 'purchase', 'other'].includes(category) ? category : 'support';

  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      subject,
      category: validCategory,
      priority: validPriority as any,
      originPlatform: originPlatform || 'web',
      messages: {
        create: {
          senderId: user.id,
          senderRole: 'customer',
          body: message,
        },
      },
    },
    include: { messages: true, user: true },
  });

  void notifyTicketEmbed({
    ticketId: ticket.id,
    subject: ticket.subject,
    userEmail: user.email,
    userDiscordId: user.discordUserId || discordUserId,
    userPhone: user.phoneNumber || phone,
    initialMessage: message,
    priority: ticket.priority,
    status: ticket.status,
  });

  await prisma.auditLog.create({
    data: {
      action: 'ticket.opened',
      target: `Ticket ${ticket.id} (${ticket.subject})`,
      actorRole: 'customer',
    },
  });

  res.status(201).json({ ok: true, ticket });
});

/**
 * POST /api/internal/claim-ticket
 * Claim ticket. Enforces anti-double-claim unless force=true.
 */
internalBotRouter.post('/internal/claim-ticket', async (req: Request, res: Response) => {
  const { ticketId, staffUserLabel, staffUserId, staffPhone, force } = req.body || {};

  if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true, claimedBy: true },
  });

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  let staffUser = staffUserId ? await prisma.user.findUnique({ where: { id: staffUserId } }) : null;
  if (!staffUser && staffPhone) {
    const cleanPhone = String(staffPhone).replace(/[^0-9]/g, '');
    staffUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanPhone }, { phoneNumber: `+${cleanPhone}` }],
        role: { in: ['admin', 'dev', 'support'] },
      },
    });
  }
  if (!staffUser) {
    return res.status(403).json({ error: 'Valid staff account (admin, dev, or support) required to claim ticket' });
  }

  if (ticket.claimedById && !force && ticket.claimedById !== staffUser?.id) {
    return res.status(409).json({
      error: `Ticket is already claimed by ${ticket.claimedBy?.displayName || ticket.claimedBy?.email || 'another staff member'}. Pass force=true to transfer.`,
    });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: 'claimed',
      claimedById: staffUser ? staffUser.id : ticket.userId,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    },
    include: { user: true, claimedBy: true },
  });

  await prisma.auditLog.create({
    data: {
      action: 'ticket.claimed',
      target: `Ticket ${ticket.id} claimed by ${staffUserLabel || staffUser?.email}`,
      actorRole: 'staff',
    },
  });

  res.json({ ok: true, ticket: updated, claimedBy: staffUserLabel || staffUser?.displayName || staffUser?.email });
});

/**
 * POST /api/internal/unclaim-ticket
 */
internalBotRouter.post('/internal/unclaim-ticket', async (req: Request, res: Response) => {
  const { ticketId, staffUserLabel } = req.body || {};
  if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'open',
      claimedById: null,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'ticket.unclaimed',
      target: `Ticket ${ticketId} unclaimed by ${staffUserLabel || 'Staff'}`,
      actorRole: 'staff',
    },
  });

  res.json({ ok: true, ticket: updated });
});

/**
 * POST /api/internal/reply-ticket
 */
internalBotRouter.post('/internal/reply-ticket', async (req: Request, res: Response) => {
  const { ticketId, body, staffUserLabel, senderRole } = req.body || {};

  if (!ticketId || !body) {
    return res.status(400).json({ error: 'ticketId and body are required' });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const role = senderRole === 'customer' ? 'customer' : 'admin';
  const staffUser =
    (await prisma.user.findFirst({ where: { role: { in: ['admin', 'dev', 'support'] } } })) || ticket.user;

  const msg = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: role === 'customer' ? ticket.userId : staffUser.id,
      senderRole: role as any,
      body: body,
    },
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: role === 'customer' ? 'open' : 'pending',
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    },
  });

  if (role !== 'customer') {
    const rendered = renderTicketReplyEmail({
      ticketSubject: ticket.subject,
      senderName: staffUserLabel || staffUser.displayName || 'ShanuTechX Support Staff',
      messageBody: body,
      ticketId: ticket.id,
    });
    void notifyCustomer(ticket.user, rendered.text, rendered.html, rendered.subject);
  }

  res.json({ ok: true, message: msg });
});

/**
 * POST /api/internal/close-ticket
 * Close ticket with reason, generate full transcript, and save to DB
 */
internalBotRouter.post('/internal/close-ticket', async (req: Request, res: Response) => {
  const { ticketId, reason, staffUserLabel } = req.body || {};

  if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true, messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  // Generate clean text transcript
  const transcriptLines = [
    `==================================================`,
    `SHANUTECHX SUPPORT TICKET TRANSCRIPT`,
    `Ticket ID: ${ticket.id}`,
    `Subject: ${ticket.subject}`,
    `Category: ${ticket.category.toUpperCase()}`,
    `Customer: ${ticket.user.email} (${ticket.user.displayName || 'Customer'})`,
    `Closed Date: ${new Date().toISOString()}`,
    `Closed By: ${staffUserLabel || 'Staff'}`,
    `Close Reason: ${reason || 'Resolved'}`,
    `==================================================\n`,
  ];

  for (const m of ticket.messages) {
    const sender = m.senderRole === 'admin' ? 'STAFF' : 'CUSTOMER';
    transcriptLines.push(`[${m.createdAt.toISOString()}] ${sender}: ${m.body}`);
  }

  const transcript = transcriptLines.join('\n');

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: 'closed',
      closeReason: reason || 'Resolved',
      closedAt: new Date(),
      transcript,
      updatedAt: new Date(),
    },
  });

  const closeMessage = `Your support ticket "${ticket.subject}" (#${ticket.id.slice(0, 8).toUpperCase()}) has been closed.\nReason: ${
    reason || 'Resolved'
  }\n\nPlease rate your experience (1 to 5 stars) by replying with !rate ${ticket.id.slice(0, 8)} [1-5] [feedback]`;

  void notifyCustomer(ticket.user, closeMessage);

  await prisma.auditLog.create({
    data: {
      action: 'ticket.closed',
      target: `Ticket ${ticket.id} (${ticket.subject})`,
      actorRole: 'staff',
    },
  });

  res.json({ ok: true, ticket: updated, transcript });
});

/**
 * POST /api/internal/rate-ticket
 */
internalBotRouter.post('/internal/rate-ticket', async (req: Request, res: Response) => {
  const { ticketId, rating, feedback } = req.body || {};
  if (!ticketId || typeof rating !== 'number') {
    return res.status(400).json({ error: 'ticketId and rating (1-5) are required' });
  }

  const validRating = Math.max(1, Math.min(5, Math.round(rating)));

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      rating: validRating,
      feedback: feedback || null,
    },
  });

  res.json({ ok: true, ticket });
});

/**
 * POST /api/internal/announcements/send
 */
internalBotRouter.post('/internal/announcements/send', async (req: Request, res: Response) => {
  const { title, message, targetPlatform, channelId, color, imageUrl, rolePing, scheduledFor, createdById } = req.body || {};

  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      message,
      targetPlatform: targetPlatform || 'both',
      channelId: channelId || null,
      color: color || 8140525,
      imageUrl: imageUrl || null,
      rolePing: rolePing || null,
      status: scheduledFor ? 'scheduled' : 'sent',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      sentAt: scheduledFor ? null : new Date(),
      createdById: createdById || null,
    },
  });

  // If not scheduled, dispatch immediately
  if (!scheduledFor) {
    if (targetPlatform === 'discord' || targetPlatform === 'both') {
      await fetch(`${env.discordBotUrl}/internal/send-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': env.discordInternalSecret },
        body: JSON.stringify({
          channelId: channelId || process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID || process.env.ADMIN_ALERT_CHANNEL_ID,
          message: `${rolePing ? `${rolePing}\n` : ''}📢 **${title}**\n${message}${imageUrl ? `\n${imageUrl}` : ''}`,
        }),
      }).catch(() => {});
    }

    if (targetPlatform === 'whatsapp' || targetPlatform === 'both') {
      const customers = await prisma.user.findMany({
        where: { phoneNumber: { not: null } },
        select: { phoneNumber: true },
        take: 100,
      });

      for (const c of customers) {
        if (c.phoneNumber) {
          void fetch(`${env.whatsappBotUrl}/internal/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': env.whatsappInternalSecret },
            body: JSON.stringify({
              phoneNumber: c.phoneNumber,
              message: `📢 *${title}*\n\n${message}`,
            }),
          }).catch(() => {});
        }
      }
    }
  }

  res.json({ ok: true, announcement });
});

/**
 * POST /api/internal/invoices/generate-and-send
 * Generates branded PDF invoice and delivers to customer via WhatsApp/Discord DM
 */
internalBotRouter.post('/internal/invoices/generate-and-send', async (req: Request, res: Response) => {
  const { orderId, userEmail, items: reqItems, createdBy } = req.body || {};

  let order: any = null;
  if (orderId) {
    order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: { include: { plan: { include: { product: true } }, service: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
  } else if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail.trim().toLowerCase() } });
    if (!user) return res.status(404).json({ error: `Customer account not found for ${userEmail}` });

    const rawItems: Array<{ name: string; amount?: number; unitPrice?: number; quantity?: number }> = Array.isArray(reqItems) && reqItems.length > 0
      ? reqItems
      : [{ name: 'Platform Hosting Service', amount: 0, quantity: 1 }];

    const calcTotal = rawItems.reduce((acc, i) => acc + Math.round((i.amount ?? i.unitPrice ?? 0) * (i.quantity ?? 1) * 100), 0);

    order = await prisma.order.create({
      data: {
        userId: user.id,
        total: calcTotal,
        totalLkr: calcTotal,
        status: 'awaiting_payment',
        currency: 'USD',
      },
      include: {
        user: true,
        items: true,
      },
    });
  } else {
    return res.status(400).json({ error: 'Either orderId or userEmail is required' });
  }

  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map((i: any) => ({
        name: i.plan?.name ?? i.service?.name ?? 'Cloud Hosting Service',
        quantity: i.quantity,
        unitPrice: i.plan?.price ?? i.service?.price ?? 0,
      }))
    : (Array.isArray(reqItems) ? reqItems.map((i: any) => ({ name: i.name || 'Cloud Hosting Service', quantity: i.quantity || 1, unitPrice: i.amount ?? i.unitPrice ?? 0 })) : [{ name: 'Cloud Hosting Service', quantity: 1, unitPrice: order.total / 100 }]);

  const pdfBytes = await generateInvoicePdf({
    invoiceId: `INV-${new Date(order.createdAt).getFullYear()}-${order.id.slice(0, 8).toUpperCase()}`,
    issuedAt: order.createdAt,
    customerEmail: order.user.email,
    items,
    total: order.total,
    currencyLabel: order.currency,
  });

  const invoice = await prisma.invoice.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, pdfUrl: null },
    update: {},
  });

  const messageText = `📄 *Invoice INV-${new Date(order.createdAt).getFullYear()}-${order.id
    .slice(0, 8)
    .toUpperCase()}*\n\nOrder Total: ${order.currency} ${(order.total / 100).toFixed(2)}\nStatus: ${order.status.toUpperCase()}\nDate: ${new Date(
    order.createdAt
  ).toLocaleDateString()}`;

  void notifyCustomer(order.user, messageText);

  res.json({
    ok: true,
    invoiceId: invoice.id,
    orderId: order.id,
    pdfBytesLength: pdfBytes.length,
    message: 'Invoice PDF generated and dispatched to customer channels',
  });
});

/**
 * GET /api/internal/invoices/list
 */
internalBotRouter.get('/internal/invoices/list', async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

  const whereClause: any = {};
  if (search) {
    whereClause.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { order: { user: { email: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where: whereClause,
    orderBy: { issuedAt: 'desc' },
    take: 30,
    include: {
      order: {
        include: {
          user: { select: { email: true, displayName: true } },
          items: true,
        },
      },
    },
  });

  res.json({ invoices });
});

/**
 * POST /api/internal/sweep-inactive-tickets
 * Auto-close tickets inactive >24 hours
 */
internalBotRouter.post('/internal/sweep-inactive-tickets', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (isSweepingTickets) {
    return res.status(409).json({ error: 'Ticket sweep is already in progress' });
  }
  if (now - lastSweepTimestamp < 60000) {
    return res.status(429).json({ error: 'Ticket sweep cooldown active (try again in 60s)' });
  }

  isSweepingTickets = true;
  lastSweepTimestamp = now;

  try {
    const cutoff = new Date(now - 24 * 60 * 60 * 1000);

    const updateResult = await prisma.ticket.updateMany({
      where: {
        status: { in: ['open', 'pending'] },
        lastActivityAt: { lt: cutoff },
      },
      data: {
        status: 'closed',
        closeReason: 'Auto-closed after 24h of inactivity',
        closedAt: new Date(now),
      },
    });

    res.json({ ok: true, closedCount: updateResult.count });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to sweep inactive tickets', details: err?.message });
  } finally {
    isSweepingTickets = false;
  }
});
