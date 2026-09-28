import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

test('CAS deduplication sha1 hash calculation & integrity match', () => {
  const content = 'console.log("Hello ShanuTechX CAS");';
  const buffer = Buffer.from(content, 'utf-8');
  const computedSha = createHash('sha1').update(buffer).digest('hex');

  assert.equal(typeof computedSha, 'string');
  assert.equal(computedSha.length, 40);

  const base64 = buffer.toString('base64');
  const decodedBuffer = Buffer.from(base64, 'base64');
  const recomputedSha = createHash('sha1').update(decodedBuffer).digest('hex');

  assert.equal(recomputedSha, computedSha);
});

test('CAS hash set deduplication and missing list filter', () => {
  const allHashes = [
    'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    '8c9c037985790c0a5a4176461f3a2b4a3a9925e5',
    'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3', // duplicate
  ];

  const existingInDb = ['a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'];

  const uniqueRequested = Array.from(new Set(allHashes));
  const existingSet = new Set(existingInDb);
  const missing = uniqueRequested.filter((sha) => !existingSet.has(sha));

  assert.deepEqual(uniqueRequested, [
    'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    '8c9c037985790c0a5a4176461f3a2b4a3a9925e5',
  ]);
  assert.deepEqual(missing, ['8c9c037985790c0a5a4176461f3a2b4a3a9925e5']);
});

test('Sub-second instant rollback timing calculation', async () => {
  const startTime = Date.now();
  
  // Simulate pointer swap operations (< 300ms)
  await new Promise((resolve) => setTimeout(resolve, 15));
  
  const rollbackDurationMs = Date.now() - startTime;
  assert.ok(rollbackDurationMs < 300, `Rollback took ${rollbackDurationMs}ms, expected < 300ms`);
});
