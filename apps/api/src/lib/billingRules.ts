import { env } from '../env';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long one billing period is, in milliseconds. Deliberately simple
 * (30/365 days rather than calendar months/years) so renewal math is
 * trivially testable and never lands on an ambiguous date like Feb 30.
 */
export function periodLengthMs(billingPeriod: 'monthly' | 'yearly'): number {
  return billingPeriod === 'monthly' ? 30 * DAY_MS : 365 * DAY_MS;
}

/**
 * Computes the new currentPeriodEnd when a customer renews. Extends from
 * whichever is LATER: now, or the existing expiry. Renewing early (before
 * expiry) stacks on top of the remaining time rather than wasting it;
 * renewing late (after a lapse) starts fresh from now rather than trying to
 * "back-date" a period that's already elapsed.
 */
export function computeRenewedPeriodEnd(
  currentPeriodEnd: Date,
  billingPeriod: 'monthly' | 'yearly',
  now: Date = new Date()
): Date {
  const base = currentPeriodEnd.getTime() > now.getTime() ? currentPeriodEnd.getTime() : now.getTime();
  return new Date(base + periodLengthMs(billingPeriod));
}

export type SubscriptionSweepAction = 'none' | 'mark_past_due' | 'cancel';

/**
 * Decides what should happen to an active/past_due subscription right now,
 * given when its period ended (or, if already past_due, when it became so).
 * Used by the daily sweep (lib/billing.ts's runBillingChecks) — kept as a
 * pure function so the grace-period math can be unit tested without a
 * database.
 * 
 * @param gracePeriodDays - Number of days to wait after period end before cancelling (default from env.gracePeriodDays)
 */
export function decideSweepAction(
  status: 'active' | 'past_due' | 'cancelled',
  currentPeriodEnd: Date,
  pastDueAt: Date | null,
  now: Date = new Date(),
  gracePeriodDays: number = env.gracePeriodDays
): SubscriptionSweepAction {
  if (status === 'cancelled') return 'none';

  if (status === 'active') {
    return currentPeriodEnd.getTime() <= now.getTime() ? 'mark_past_due' : 'none';
  }

  // status === 'past_due': cancel once the grace period has elapsed.
  const graceDeadline = (pastDueAt?.getTime() ?? currentPeriodEnd.getTime()) + gracePeriodDays * DAY_MS;
  return now.getTime() >= graceDeadline ? 'cancel' : 'none';
}
