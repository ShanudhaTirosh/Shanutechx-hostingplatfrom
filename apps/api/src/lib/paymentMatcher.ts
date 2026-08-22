export interface ExtractedPayment {
  amount?: number;
  reference?: string;
  source?: string;
  /** Self-reported extraction confidence from Gemini/OCR, 0-100. */
  extractionConfidence?: number;
}

export interface MatchTarget {
  expectedAmount: number; // smallest currency unit, same scale as Order.total
}

export type PaymentDecision = 'auto_approved' | 'manual_review' | 'rejected';

export interface MatchResult {
  confidenceScore: number; // 0-100
  decision: PaymentDecision;
  reasons: string[];
}

const AUTO_APPROVE_THRESHOLD = 90;
const MANUAL_REVIEW_THRESHOLD = 60;

/**
 * Scores how well an extracted payment proof matches the order it's meant
 * to be paying for, then routes it per your original design:
 *   >=90  -> auto_approved
 *   60-89 -> manual_review
 *   <60   -> rejected
 *
 * The score blends three signals so no single weak signal can force a wrong
 * auto-approval: how closely the amount matches, whether a plausible
 * reference/transaction ID was found, and how confident the extraction step
 * itself was (a perfectly matching amount read off a blurry, half-guessed
 * image still shouldn't auto-approve).
 */
export function scorePayment(
  extracted: ExtractedPayment,
  target: MatchTarget
): MatchResult {
  const reasons: string[] = [];

  const amountScore = scoreAmount(extracted.amount, target.expectedAmount, reasons);
  const referenceScore = scoreReference(extracted.reference, reasons);
  const extractionScore = clamp(extracted.extractionConfidence ?? 50, 0, 100);

  const confidenceScore = Math.round(
    amountScore * 0.5 + extractionScore * 0.3 + referenceScore * 0.2
  );

  let decision: PaymentDecision = 'rejected';
  if (confidenceScore >= AUTO_APPROVE_THRESHOLD) decision = 'auto_approved';
  else if (confidenceScore >= MANUAL_REVIEW_THRESHOLD) decision = 'manual_review';

  return { confidenceScore, decision, reasons };
}

function scoreAmount(
  extractedAmount: number | undefined,
  expectedAmount: number,
  reasons: string[]
): number {
  if (extractedAmount === undefined || expectedAmount <= 0) {
    reasons.push('No amount could be extracted');
    return 0;
  }

  const diff = Math.abs(extractedAmount - expectedAmount);
  const pctDiff = diff / expectedAmount;

  if (pctDiff === 0) {
    reasons.push('Amount matches exactly');
    return 100;
  }
  if (pctDiff <= 0.01) {
    reasons.push('Amount matches within rounding tolerance');
    return 95;
  }
  if (pctDiff <= 0.05) {
    reasons.push('Amount is close but not exact (within 5%)');
    return 65;
  }

  reasons.push(
    `Amount mismatch: expected ${expectedAmount}, got ${extractedAmount}`
  );
  return 0;
}

function scoreReference(reference: string | undefined, reasons: string[]): number {
  if (!reference || reference.trim().length < 3) {
    reasons.push('No usable transaction reference found');
    return 35; // weak supporting evidence, not disqualifying on its own
  }
  reasons.push('Transaction reference present');
  return 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
