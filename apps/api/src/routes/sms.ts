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

export const smsRouter = Router();

const incomingSmsSchema = z.object({ text: z.string().min(1) });

smsRouter.post('/sms/incoming', smsWebhookLimiter, async (req, res) => {
  if (!verifySmsSignature(req, env.smsWebhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const parsed = incomingSmsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { source, amount, reference } = parseSms(parsed.data.text);

  const smsEvent = await prisma.smsEvent.create({
    data: {
      source,
      rawText: parsed.data.text,
      parsedJson: { amount, reference },
    },
  });

  if (amount === undefined) {
    return res.status(202).json({ smsEvent, matched: false, reason: 'No amount parsed' });
  }

  // Try to match against any pending payment expecting roughly this amount.
  // "Pending" here means the order is awaiting_payment and has no
  // already-approved payment yet.
  const candidates = await prisma.order.findMany({
    where: { status: 'awaiting_payment' },
    include: { payments: true, user: true },
  });

  let bestMatch: { order: (typeof candidates)[number]; score: number } | null = null;

  for (const order of candidates) {
    const { confidenceScore, decision } = scorePayment(
      { amount, reference, source, extractionConfidence: 85 }, // SMS text is structured, trust it more than a photo
      { expectedAmount: order.totalLkr }
    );

    if (decision !== 'rejected' && (!bestMatch || confidenceScore > bestMatch.score)) {
      bestMatch = { order, score: confidenceScore };
    }
  }

  if (!bestMatch) {
    return res.status(202).json({ smsEvent, matched: false, reason: 'No matching order found' });
  }

  // IMPORTANT: an SMS match is supporting evidence only, never an approval.
  // Every payment created here lands in manual_review regardless of score —
  // an admin/dev still has to click Approve/Decline on the review queue.
  // Do not reintroduce an auto_approved branch here.
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
    `SMS payment for order ${bestMatch.order.id} matched (confidence: ${bestMatch.score}%) — awaiting manual admin review.`
  );
  void notifyDiscordChannel('new_payment_submitted', {
    'Order': bestMatch.order.id,
    'Customer': bestMatch.order.user.email,
    'Source': 'SMS forwarder',
    'Match confidence': `${bestMatch.score}%`,
  });

  res.status(201).json({ smsEvent, matched: true, payment });
});
