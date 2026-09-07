/**
 * Multi-currency support. Deliberately NOT calling a live FX API on every
 * checkout — that's an external dependency and a point of failure for the
 * single most important transaction in the platform. Instead, a rate is
 * stored (admin-updatable) and snapshotted onto the order at checkout time
 * via `totalLkr`, so a later rate change never retroactively changes what
 * a past order was actually charged.
 *
 * All payment verification (Gemini OCR, SMS matching) works in LKR only —
 * the local banks and mobile-money providers this platform verifies
 * against don't operate in other currencies — so `totalLkr` is what
 * actually gets compared against a payment proof, regardless of what
 * currency the customer saw at checkout.
 */

export type Currency = 'LKR' | 'USD';

/**
 * In production this should be admin-configurable and persisted (e.g. a
 * dedicated settings row) rather than hardcoded — this default is a
 * starting point, not a live rate.
 */
const DEFAULT_USD_TO_LKR_RATE = 300;

export function convertToLkr(amount: number, currency: Currency | string, usdToLkrRate = DEFAULT_USD_TO_LKR_RATE): number {
  const norm = (currency || 'LKR').toString().toUpperCase();
  if (norm === 'LKR') return amount;
  return Math.round(amount * usdToLkrRate);
}

export function formatCurrency(amountInSmallestUnit: number, currency: Currency | string): string {
  const amount = amountInSmallestUnit / 100;
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const norm = (currency || 'LKR').toString().toUpperCase();
  return norm === 'LKR' ? `LKR ${formatted}` : `$${formatted}`;
}
