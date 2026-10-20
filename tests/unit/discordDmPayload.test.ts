import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildDmPayload, MAX_DM_DOCUMENT_BYTES } = require('../../services/discord-bot/src/dmPayload.js');
const b64 = (s: string) => Buffer.from(s).toString('base64');

test('text only: the payload is just the content (unchanged behaviour)', () => {
  assert.deepEqual(buildDmPayload('hello', null), { ok: true, payload: { content: 'hello' } });
});

test('a document becomes a file attachment with a safe name; the message stays as the content', () => {
  const r = buildDmPayload('Invoice', { fileName: 'INV-1.pdf', base64: b64('%PDF-data') });
  assert.equal(r.ok, true);
  assert.equal(r.payload.content, 'Invoice');
  assert.equal(r.payload.files[0].name, 'INV-1.pdf');
  assert.equal(r.payload.files[0].attachment.toString(), '%PDF-data');
});

test('file names are sanitised (no path separators / control characters) with a default', () => {
  assert.equal(buildDmPayload('m', { fileName: '../../etc/passwd\r\n.pdf', base64: b64('x') }).payload.files[0].name, 'passwd.pdf');
  assert.equal(buildDmPayload('m', { fileName: '', base64: b64('x') }).payload.files[0].name, 'document.pdf');
});

test('invalid or oversized documents are rejected, never half-sent', () => {
  for (const doc of [{ fileName: 'a.pdf' }, { base64: 42 }, { base64: '' }, 'string', 123]) {
    assert.equal(buildDmPayload('m', doc as any).ok, false, JSON.stringify(doc));
  }
  const tooBig = Buffer.alloc(MAX_DM_DOCUMENT_BYTES + 1).toString('base64');
  assert.equal(buildDmPayload('m', { fileName: 'big.pdf', base64: tooBig }).ok, false);
});

test('a message is optional when there is a document (the invoice caption can be empty)', () => {
  assert.equal(buildDmPayload('', { fileName: 'a.pdf', base64: b64('x') }).ok, true);
  assert.equal(buildDmPayload('', null).ok, false, 'nothing to send');
});
