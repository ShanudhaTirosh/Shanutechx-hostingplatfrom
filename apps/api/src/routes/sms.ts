import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { parseSms } from '../lib/smsParser';
import { scorePayment } from '../lib/paymentMatcher';
import { verifySmsSignature } from '../lib/smsSignature';
import { notifyAdmins } from '../lib/notifications';
import { notifyDiscordChannel } from '../lib/discordWebhooks';
import { smsWebhookLimiter } from '../middleware/rateLimit';
import { asyncHandler } from '../lib/asyncHandler';
import { formatCurrency } from '../lib/currency';
import { logger } from '../lib/logger';

export const smsRouter = Router();

const incomingSmsSchema = z.object({
  text: z.string().min(1),
  timestamp: z.number().or(z.string()),
  nonce: z.string().optional(),
});

// Middleware: Verify HMAC signature before rate limiting to prevent DoS token exhaustion
const verifySmsHmac = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  if (!verifySmsSignature(req, env.smsWebhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
};

smsRouter.post(
  '/sms/incoming',
  verifySmsHmac,
  smsWebhookLimiter,
  asyncHandler(async (req, res) => {
    const parsed = incomingSmsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    // 2. Validate timestamp freshness (prevent replay attacks) (MED-13)
    const ts = typeof parsed.data.timestamp === 'string' ? Number(parsed.data.timestamp) : parsed.data.timestamp;
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Request timestamp expired or invalid (replay protection)' });
    }

    const { source, amount, reference } = parseSms(parsed.data.text);

    // 3. Check for duplicate SMS event processing (scoped to 10-minute window or nonce) (MED-15)
    const duplicateSms = parsed.data.nonce
      ? await prisma.smsEvent.findFirst({
          where: { rawText: { contains: parsed.data.nonce } },
        })
      : await prisma.smsEvent.findFirst({
          where: {
            rawText: parsed.data.text,
            createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
        });

    if (duplicateSms) {
      return res.status(200).json({ smsEvent: duplicateSms, matched: false, reason: 'Duplicate SMS event ignored' });
    }

    const smsEvent = await prisma.smsEvent.create({
      data: {
        source,
        rawText: parsed.data.text,
        parsedJson: { amount, reference },
      },
    });

    if (amount === undefined || amount <= 0) {
      return res.status(202).json({ smsEvent, matched: false, reason: 'No valid amount parsed' });
    }

    // 4. Efficient candidate query: filter orders by amount ±1% and exclude already-handled orders
    const minAmount = Math.floor(amount * 0.99);
    const maxAmount = Math.ceil(amount * 1.01);

    const candidates = await prisma.order.findMany({
      where: {
        status: 'awaiting_payment',
        totalLkr: { gte: minAmount, lte: maxAmount },
        payments: {
          none: {
            status: { in: ['manually_approved', 'auto_approved', 'manual_review'] },
          },
        },
      },
      select: {
        id: true,
        totalLkr: true,
        userId: true,
        user: { select: { email: true } },
      },
    });

    let bestMatch: { order: (typeof candidates)[number]; score: number } | null = null;

    // Dynamically derive extraction confidence from parse quality (MED-14)
    let dynamicExtractionConfidence = 45;
    if (source !== 'unknown' && reference) {
      dynamicExtractionConfidence = 95;
    } else if (source !== 'unknown' || reference) {
      dynamicExtractionConfidence = 75;
    }

    for (const order of candidates) {
      const { confidenceScore, decision } = scorePayment(
        { amount, reference, source, extractionConfidence: dynamicExtractionConfidence },
        { expectedAmount: order.totalLkr }
      );

      if (decision !== 'rejected' && (!bestMatch || confidenceScore > bestMatch.score)) {
        bestMatch = { order, score: confidenceScore };
      }
    }

    if (!bestMatch || bestMatch.score < 60) {
      return res.status(202).json({ smsEvent, matched: false, reason: 'No matching order found with high confidence' });
    }

    // 5. Create payment record in manual_review for admin verification
    const payment = await prisma.payment.create({
      data: {
        orderId: bestMatch.order.id,
        method: 'sms',
        extractedJson: { amount, reference, source },
        confidenceScore: bestMatch.score,
        status: 'manual_review',
      },
    });

    await prisma.smsEvent.update({
      where: { id: smsEvent.id },
      data: { matchedPaymentId: payment.id },
    });

    void notifyAdmins(
      `SMS payment for order ${bestMatch.order.id} matched (${formatCurrency(amount, 'LKR')}, confidence: ${bestMatch.score}%) — awaiting manual admin review.`
    );
    void notifyDiscordChannel('new_payment_submitted', {
      'Order': bestMatch.order.id,
      'Customer': bestMatch.order.user.email,
      'Source': 'SMS forwarder',
      'Amount': formatCurrency(amount, 'LKR'),
      'Match confidence': `${bestMatch.score}%`,
    });

    res.status(201).json({ smsEvent, matched: true, payment });
  })
);
