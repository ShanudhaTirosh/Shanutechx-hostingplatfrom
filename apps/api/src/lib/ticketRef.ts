/**
 * Pure helpers for the internal bot ticket endpoints (no DB / env imports so
 * they can be unit-tested in isolation).
 *
 * Both bots only ever display the first 8 characters of a ticket id (upper-cased,
 * e.g. "#ABC12345"), so users and staff send that short form back. The API used
 * to require the full cuid, which made every `!reply`, `!claim`, `!close`,
 * `!rate`, `/reply-ticket`, ... fail with "Ticket not found".
 */

/** Strip a leading "#", whitespace and normalise case. Returns null if unusable. */
export function cleanTicketRef(raw: unknown): { exact: string; lower: string } | null {
  if (typeof raw !== 'string') return null;
  const exact = raw.trim().replace(/^#/, '');
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(exact)) return null;
  return { exact, lower: exact.toLowerCase() };
}

/** Digits only, so "+94 77 123 4567" and "94771234567" compare equal. */
export function normalizePhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^0-9]/g, '') : '';
}

/**
 * True when `senderPhone` is the phone number stored on the ticket owner.
 * Fails closed: a missing/empty number on either side is never a match.
 */
export function phoneOwnsTicket(senderPhone: unknown, ownerPhone: unknown): boolean {
  const a = normalizePhone(senderPhone);
  const b = normalizePhone(ownerPhone);
  return a.length > 0 && b.length > 0 && a === b;
}
