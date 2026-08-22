/**
 * Permanent unit tests for pure-function utilities.
 * Run: npx tsx --test tests/unit/utils.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { parsePagination } from '../../apps/api/src/lib/pagination';
import { encryptSecret, decryptSecret } from '../../apps/api/src/lib/secretsVault';

describe('parsePagination', () => {
  it('defaults when nothing provided', () => {
    const r = parsePagination({});
    assert.equal(r.take, 25);
    assert.equal(r.skip, 0);
  });

  it('normal values pass through', () => {
    const r = parsePagination({ take: '10', skip: '20' });
    assert.equal(r.take, 10);
    assert.equal(r.skip, 20);
  });

  it('take is capped at 100', () => {
    assert.equal(parsePagination({ take: '99999' }).take, 100);
  });

  it('negative take falls back to default', () => {
    assert.equal(parsePagination({ take: '-5' }).take, 25);
  });

  it('negative skip falls back to 0', () => {
    assert.equal(parsePagination({ skip: '-1' }).skip, 0);
  });

  it('zero take falls back to default', () => {
    assert.equal(parsePagination({ take: '0' }).take, 25);
  });

  it('non-numeric values fall back to defaults', () => {
    const r = parsePagination({ take: 'abc', skip: 'xyz' });
    assert.equal(r.take, 25);
    assert.equal(r.skip, 0);
  });

  it('fractional values are floored', () => {
    const r = parsePagination({ take: '10.9', skip: '5.9' });
    assert.equal(r.take, 10);
    assert.equal(r.skip, 5);
  });
});

describe('secretsVault', () => {
  const key = crypto.randomBytes(32).toString('hex');

  it('round-trip preserves the original plaintext', () => {
    const original = 'super-secret-smtp-password!';
    const encrypted = encryptSecret(original, key);
    assert.equal(decryptSecret(encrypted, key), original);
    assert.notEqual(encrypted, original);
  });

  it('same plaintext encrypts differently each time (random IV)', () => {
    assert.notEqual(encryptSecret('same', key), encryptSecret('same', key));
  });

  it('wrong key throws rather than returning garbage', () => {
    const encrypted = encryptSecret('hello', key);
    assert.throws(() => decryptSecret(encrypted, crypto.randomBytes(32).toString('hex')));
  });

  it('tampered ciphertext is rejected by the GCM auth tag', () => {
    const encrypted = encryptSecret('hello world', key);
    const parts = encrypted.split(':');
    const tampered = Buffer.from(parts[2], 'base64');
    tampered[0] ^= 0xff;
    const tamperedStr = [parts[0], parts[1], tampered.toString('base64')].join(':');
    assert.throws(() => decryptSecret(tamperedStr, key));
  });

  it('short key rejected at encrypt time', () => {
    assert.throws(() => encryptSecret('hello', 'tooshort'));
  });
});
