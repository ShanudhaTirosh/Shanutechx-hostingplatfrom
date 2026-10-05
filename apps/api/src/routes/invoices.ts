import { Router } from 'express';
import { existsSync } from 'fs';
import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { canAccessResource } from '../middleware/rbac';
import { generateInvoicePdf } from '../lib/invoicePdf';

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);

const INVOICES_DIR = process.env.INVOICES_DIR || '/var/lib/shanutechx/invoices';

/**
 * GET /api/invoices - Lists all invoices (proforma & paid) for the current user or admin
 */
invoicesRouter.get('/invoices', async (req: AuthedRequest, res) => {
  const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev' || req.user!.role === 'support';
  const where = isStaff ? {} : { userId: req.user!.id };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      items: { include: { service: true, plan: { include: { product: true } } } },
      payments: { select: { id: true, status: true, method: true, createdAt: true } },
      invoice: true,
    },
    take: 100,
  });

  const invoices = orders.map((order: any) => {
    const createdDate = new Date(order.createdAt);
    const dueDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invoiceNumber = `INV-${createdDate.getFullYear()}-${order.id.slice(0, 8).toUpperCase()}`;
    const invoiceStatus = order.status === 'paid' ? 'paid' : order.status === 'awaiting_payment' ? 'proforma' : 'cancelled';

    return {
      id: order.invoice?.id || order.id,
      invoiceNumber,
      orderId: order.id,
      issuedAt: order.createdAt,
      dueAt: dueDate.toISOString(),
      status: invoiceStatus,
      isProforma: order.status !== 'paid',
      total: order.total,
      totalLkr: order.totalLkr,
      currency: order.currency || 'LKR',
      customer: order.user,
      itemCount: order.items.length,
      itemsSummary: order.items.map((it: any) => it.service?.name || it.plan?.name || 'Service').join(', '),
      pdfAvailable: !!order.invoice?.pdfUrl || order.status === 'paid',
    };
  });

  res.json({ invoices, total: invoices.length });
});

async function loadOwnedOrderWithItems(req: AuthedRequest, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { service: true, plan: { include: { product: true } } } }, user: true, invoice: true },
  });
  if (!order) return null;
  // Dev always passes, admin only passes for an assigned customer's order.
  if (!(await canAccessResource(order.userId, req))) return null;
  return order;
}

/**
 * Generates the invoice PDF for a paid order on first request and caches it
 * to disk; subsequent requests just re-serve the same file. Only orders with
 * status "paid" get an invoice — an unpaid order has nothing to invoice yet.
 */
invoicesRouter.get('/orders/:orderId/invoice', async (req: AuthedRequest, res) => {
  const order = await loadOwnedOrderWithItems(req, req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'paid') {
    return res.status(409).json({ error: 'Order is not paid yet' });
  }

  let invoice = order.invoice;

  if (!invoice || !invoice.pdfUrl || !existsSync(invoice.pdfUrl)) {
    const pdfBytes = await generateInvoicePdf({
      invoiceId: order.id,
      issuedAt: new Date(),
      customerEmail: order.user.email,
      items: order.items.map((item: any) => {
        const name = item.service ? item.service.name : item.plan ? `${item.plan.product?.name} — ${item.plan.name}` : 'Unknown Product';
        const unitPrice = item.service ? item.service.price : item.plan ? item.plan.price : 0;
        return {
          name,
          quantity: item.quantity,
          unitPrice,
        };
      }),
      total: order.total,
    });

    await mkdir(INVOICES_DIR, { recursive: true });
    const filePath = path.join(INVOICES_DIR, `${order.id}.pdf`);
    await writeFile(filePath, pdfBytes);

    invoice = await prisma.invoice.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, pdfUrl: filePath },
      update: { pdfUrl: filePath },
    });
  }

  const pdfBytes = await readFile(invoice.pdfUrl!);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.id}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

/**
 * Returns structured JSON invoice details for rendering invoice preview modals
 */
invoicesRouter.get('/orders/:orderId/invoice/json', async (req: AuthedRequest, res) => {
  const order = await loadOwnedOrderWithItems(req, req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const invoiceNumber = `INV-${order.createdAt.getFullYear()}-${order.id.slice(0, 8).toUpperCase()}`;

  const lineItems = order.items.map((item: any) => {
    const name = item.service
      ? item.service.name
      : item.plan
      ? `${item.plan.product?.name ?? 'Cloud Hosting'} — ${item.plan.name}`
      : 'Cloud Resource Allocation';
    const unitPrice = item.service ? item.service.price : item.plan ? item.plan.price : 0;
    return {
      id: item.id,
      name,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
    };
  });

  const orderAny = order as any;
  res.json({
    invoiceNumber,
    orderId: order.id,
    issuedAt: order.createdAt,
    paidAt: orderAny.updatedAt || order.createdAt,
    status: order.status,
    customer: {
      id: order.user.id,
      name: order.user.displayName || order.user.email.split('@')[0],
      email: order.user.email,
      whatsapp: order.user.phoneNumber,
    },
    company: {
      name: 'ShanuTechX Platform (Pvt) Ltd',
      address: 'Level 18, Orion City Towers, Colombo 09, Sri Lanka',
      taxId: 'LK-884920492-STX',
      email: 'billing@shanutechx.com',
      website: 'https://shanutechx.com',
    },
    items: lineItems,
    subtotal: order.total,
    tax: 0,
    discount: 0,
    total: order.total,
  });
});
