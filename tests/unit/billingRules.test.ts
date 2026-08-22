/**
 * Permanent, checked-in unit tests for billingRules.ts (pure functions, no
 * database needed). This is the same logic that was ad-hoc verified in
 * /tmp during development — moved here so it runs in CI on every push.
 *
 * Run: npx tsx --test tests/unit/billingRules.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRenewedPeriodEnd,
  decideSweepAction,
  periodLengthMs,
} from '../../apps/api/src/lib/billingRules';

const DAY = 24 * 60 * 60 * 1000;

describe('periodLengthMs', () => {
  it('monthly is 30 days', () => {
    assert.equal(periodLengthMs('monthly'), 30 * DAY);
  });

  it('yearly is 365 days', () => {
    assert.equal(periodLengthMs('yearly'), 365 * DAY);
  });
});

describe('computeRenewedPeriodEnd', () => {
  it('early renewal stacks on remaining time, not from now', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const expiry = new Date('2026-06-15T00:00:00Z'); // 14 days remaining
    const result = computeRenewedPeriodEnd(expiry, 'monthly', now);
    assert.equal(result.getTime(), expiry.getTime() + 30 * DAY);
  });

  it('late renewal (after lapse) extends from now, never backdates', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const expiry = new Date('2026-05-01T00:00:00Z'); // expired a month ago
    const result = computeRenewedPeriodEnd(expiry, 'monthly', now);
    assert.equal(result.getTime(), now.getTime() + 30 * DAY);
  });

  it('yearly period extends by 365 days', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const expiry = new Date('2026-07-01T00:00:00Z');
    const result = computeRenewedPeriodEnd(expiry, 'yearly', now);
    assert.equal(result.getTime(), expiry.getTime() + 365 * DAY);
  });
});

describe('decideSweepAction', () => {
  it('active, not yet expired -> none', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const expiry = new Date('2026-06-15T00:00:00Z');
    assert.equal(decideSweepAction('active', expiry, null, now), 'none');
  });

  it('active, just expired -> mark_past_due', () => {
    const now = new Date('2026-06-15T00:00:00Z');
    const expiry = new Date('2026-06-14T23:59:59Z');
    assert.equal(decideSweepAction('active', expiry, null, now), 'mark_past_due');
  });

  it('past_due within 7-day grace period -> none', () => {
    const pastDueAt = new Date('2026-06-14T00:00:00Z');
    const now = new Date('2026-06-18T00:00:00Z'); // 4 days in
    assert.equal(decideSweepAction('past_due', pastDueAt, pastDueAt, now), 'none');
  });

  it('past_due exactly at 7-day boundary -> cancel (>=, not >)', () => {
    const pastDueAt = new Date('2026-06-14T00:00:00Z');
    const now = new Date(pastDueAt.getTime() + 7 * DAY);
    assert.equal(decideSweepAction('past_due', pastDueAt, pastDueAt, now), 'cancel');
  });

  it('past_due beyond grace period -> cancel', () => {
    const pastDueAt = new Date('2026-06-14T00:00:00Z');
    const now = new Date('2026-06-22T00:00:00Z'); // 8 days in
    assert.equal(decideSweepAction('past_due', pastDueAt, pastDueAt, now), 'cancel');
  });

  it('cancelled -> always none, never touched again', () => {
    const now = new Date('2026-06-22T00:00:00Z');
    assert.equal(
      decideSweepAction('cancelled', new Date('2020-01-01'), new Date('2020-01-01'), now),
      'none'
    );
  });
});
