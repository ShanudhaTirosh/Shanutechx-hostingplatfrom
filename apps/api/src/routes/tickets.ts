import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireStaff, AuthedRequest } from '../middleware/auth';
import { ticketVisibilityWhere, canSeeTicket } from '../middleware/rbac';
import { notifyCustomer, notifyAdmins, notifyTicketEmbed } from '../lib/notifications';
import { parsePagination } from '../lib/pagination';
import { fireWebhook } from '../lib/webhooks';

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

const createTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1),
  orderId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

ticketsRouter.post('/tickets', async (req: AuthedRequest, res) => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.orderId) {
    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order || (req.user!.role !== 'admin' && req.user!.role !== 'dev' && order.userId !== req.user!.id)) {
      return res.status(404).json({ error: 'Referenced order not found' });
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      userId: req.user!.id,
      subject: parsed.data.subject,
      orderId: parsed.data.orderId,
      priority: parsed.data.priority || 'medium',
      messages: {
        create: {
          senderId: req.user!.id,
          senderRole: 'customer',
          body: parsed.data.message,
        },
      },
    },
    include: { messages: true },
  });

  void notifyAdmins(`New support ticket from ${req.user!.email}: "${ticket.subject}"`);

  const fullUser = await prisma.user.findUnique({ where: { id: req.user!.id } });

  void notifyTicketEmbed({
    ticketId: ticket.id,
    subject: ticket.subject,
    userEmail: req.user!.email,
    userDiscordId: fullUser?.discordUserId,
    userPhone: fullUser?.phoneNumber,
    initialMessage: parsed.data.message,
    priority: ticket.priority,
    status: ticket.status,
  });

  res.status(201).json({ ticket });
});

ticketsRouter.get('/tickets', async (req: AuthedRequest, res) => {
  // Admin sees tickets from their assigned customers + anyone unassigned.
  const where = await ticketVisibilityWhere(req);
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
  const { take, skip } = parsePagination(req.query);

  const filter = { ...where, ...(statusFilter ? { status: statusFilter as any } : {}) };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where: filter,
      include: { user: true, _count: { select: { messages: true } } },
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
    }),
    prisma.ticket.count({ where: filter }),
  ]);

  res.json({ tickets, total, take, skip });
});

async function loadOwnedTicket(req: AuthedRequest, id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' }, include: { sender: true } }, user: true },
  });
  if (!ticket) return null;
  if (!(await canSeeTicket(ticket.userId, req))) return null;
  return ticket;
}

ticketsRouter.get('/tickets/:id', async (req: AuthedRequest, res) => {
  const ticket = await loadOwnedTicket(req, req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ticket });
});

const replySchema = z.object({ body: z.string().min(1) });

ticketsRouter.post('/tickets/:id/messages', async (req: AuthedRequest, res) => {
  const ticket = await loadOwnedTicket(req, req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Stored as 'admin' for ANY staff reply (admin or support) — customers
  // see it labeled "Support" either way; the distinction between admin and
  // support doesn't need to be visible to them, only the access-control
  // logic above needs to know about it.
  const isStaffReply = req.user!.role === 'admin' || req.user!.role === 'support' || req.user!.role === 'dev';

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: req.user!.id,
      senderRole: isStaffReply ? 'admin' : 'customer',
      body: parsed.data.body,
    },
  });

  // A customer replying to a ticket staff had marked "pending" (waiting on
  // the customer) should reopen it; staff replying doesn't change status
  // automatically — they set that explicitly via PATCH.
  if (!isStaffReply && ticket.status === 'pending') {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'open' } });
  } else {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
  }

  if (isStaffReply) {
    void notifyCustomer(ticket.user, `New reply on your ticket "${ticket.subject}".`);
  } else {
    void notifyAdmins(`New reply from ${ticket.user.email} on ticket "${ticket.subject}".`);
  }

  res.status(201).json({ message });
});

const updateTicketSchema = z.object({
  status: z.enum(['open', 'pending', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

ticketsRouter.patch('/tickets/:id', requireStaff, async (req: AuthedRequest, res) => {
  const existing = await loadOwnedTicket(req, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });

  const parsed = updateTicketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const ticket = await prisma.ticket.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'ticket.update', target: ticket.id },
  });
  void fireWebhook(ticket.userId, 'ticket_updated', { ticketId: ticket.id, status: ticket.status, priority: ticket.priority });

  res.json({ ticket });
});

/** Authenticated endpoints for mobile & web staff to claim, unclaim and close tickets */
ticketsRouter.post('/tickets/:id/claim', requireStaff, async (req: AuthedRequest, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const force = Boolean(req.body?.force);
  if (ticket.claimedById && !force && ticket.claimedById !== req.user!.id) {
    return res.status(409).json({ error: 'Ticket already claimed' });
  }
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { claimedById: req.user!.id, status: 'pending', updatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'ticket.claim', target: ticket.id },
  });
  res.json({ ok: true, ticket: updated });
});

ticketsRouter.post('/tickets/:id/unclaim', requireStaff, async (req: AuthedRequest, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { claimedById: null, status: 'open', updatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'ticket.unclaim', target: ticket.id },
  });
  res.json({ ok: true, ticket: updated });
});

ticketsRouter.post('/tickets/:id/close', requireStaff, async (req: AuthedRequest, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const updated = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { status: 'closed', updatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: 'ticket.close', target: ticket.id },
  });
  res.json({ ok: true, ticket: updated });
});
