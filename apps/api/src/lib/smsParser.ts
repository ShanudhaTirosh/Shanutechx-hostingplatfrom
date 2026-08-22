export interface ParsedSms {
  source: 'ezcash' | 'combank' | 'sampath' | 'unknown';
  amount?: number;
  reference?: string;
}

const SOURCE_PATTERNS: Array<{ source: ParsedSms['source']; test: RegExp }> = [
  { source: 'ezcash', test: /ezcash/i },
  { source: 'combank', test: /combank|commercial\s*bank/i },
  { source: 'sampath', test: /sampath/i },
];

const AMOUNT_PATTERN = /Rs\.?\s?([\d,]+\.\d{2}|[\d,]+)/i;
const REFERENCE_PATTERN = /(?:ref(?:erence)?|txn|transaction)\s*[:#]?\s*([A-Za-z0-9]{4,})/i;

/**
 * Parses an incoming SMS body (from EzCash/ComBank/Sampath-style payment
 * notifications) into a structured shape the matching engine can compare
 * against a pending order. Unknown formats still return their best-effort
 * amount/reference extraction — the matching engine scores low confidence
 * for missing fields rather than this parser needing to be exhaustive.
 */
export function parseSms(rawText: string): ParsedSms {
  const source =
    SOURCE_PATTERNS.find((p) => p.test.test(rawText))?.source ?? 'unknown';

  const amountMatch = rawText.match(AMOUNT_PATTERN);
  const amount = amountMatch
    ? Math.round(parseFloat(amountMatch[1].replace(/,/g, '')) * 100) // store as smallest unit
    : undefined;

  const referenceMatch = rawText.match(REFERENCE_PATTERN);
  const reference = referenceMatch ? referenceMatch[1] : undefined;

  return { source, amount, reference };
}
