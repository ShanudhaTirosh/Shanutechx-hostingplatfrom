import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTicketRef, normalizePhone, phoneOwnsTicket } from '../../apps/api/src/lib/ticketRef';

test('cleanTicketRef strips # and whitespace and lower-cases for prefix lookup', () => {
  assert.deepEqual(cleanTicketRef(' #ABC12345 '), { exact: 'ABC12345', lower: 'abc12345' });
  assert.deepEqual(cleanTicketRef('clx9k2p4q0001abcd'), { exact: 'clx9k2p4q0001abcd', lower: 'clx9k2p4q0001abcd' });
});

test('cleanTicketRef rejects too-short, non-string and unsafe input', () => {
  assert.equal(cleanTicketRef('abc'), null);
  assert.equal(cleanTicketRef(undefined), null);
  assert.equal(cleanTicketRef(12345678), null);
  assert.equal(cleanTicketRef("abc12345'; DROP TABLE"), null);
  assert.equal(cleanTicketRef('a'.repeat(41)), null);
});

test('normalizePhone keeps digits only', () => {
  assert.equal(normalizePhone('+94 77-123 4567'), '94771234567');
  assert.equal(normalizePhone(null), '');
});

test('phoneOwnsTicket matches regardless of formatting', () => {
  assert.equal(phoneOwnsTicket('94771234567', '+94771234567'), true);
  assert.equal(phoneOwnsTicket('+94 77 123 4567', '94771234567'), true);
});

test('phoneOwnsTicket fails closed on mismatch or missing numbers', () => {
  assert.equal(phoneOwnsTicket('94771234567', '94719876543'), false);
  assert.equal(phoneOwnsTicket('94771234567', null), false);
  assert.equal(phoneOwnsTicket('', ''), false);
  assert.equal(phoneOwnsTicket(undefined, '94771234567'), false);
});
