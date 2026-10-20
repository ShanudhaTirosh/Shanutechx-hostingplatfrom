import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.WHATSAPP_INTERNAL_SECRET = 'test-secret-32-characters-long-xxxx';
process.env.API_INTERNAL_URL = 'http://api.test';

const require = createRequire(import.meta.url);

type Call = { path: string; body: any };
let calls: Call[] = [];
let responder: (path: string, body: any) => any = () => ({ ok: true });

(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const path = String(url).replace('http://api.test', '');
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ path, body });
  const out = responder(path, body);
  const status = out && out.__status ? out.__status : 200;
  return { ok: status < 400, status, json: async () => out };
};

const { handleCommand } = require('../../services/whatsapp-bot/src/commandHandler.js');
const jid = (n: string) => `${n}@s.whatsapp.net`;
const reset = () => { calls = []; responder = () => ({ ok: true }); };

test('command word is case-insensitive (phone keyboards capitalise "!Status")', async () => {
  reset();
  const out = await handleCommand(jid('94770000001'), '!Status');
  assert.match(out, /System Status/);
  assert.equal(calls[0].path, '/api/health');
});

test('"Hi" / "Hello" return the help text', async () => {
  reset();
  assert.match(await handleCommand(jid('94770000002'), 'Hi'), /Virtual Assistant/);
  assert.match(await handleCommand(jid('94770000002'), 'HELLO'), /Virtual Assistant/);
});

test('a command typed during the ticket menu runs instead of cancelling the menu', async () => {
  reset();
  const p = jid('94770000004');
  assert.match(await handleCommand(p, '!ticket'), /Support Ticket System/);
  const out = await handleCommand(p, '!status');
  assert.match(out, /System Status/);
  assert.doesNotMatch(out, /Invalid category/);
});

test('ticket menu still works for numeric answers', async () => {
  reset();
  const p = jid('94770000005');
  await handleCommand(p, '!ticket');
  assert.match(await handleCommand(p, '2'), /BILLING/);
});

test('!claim --force sends a clean ticket id and force=true', async () => {
  reset();
  responder = (path) => (path.startsWith('/api/internal/customer-summary') ? { user: { role: 'support' } } : { ok: true });
  const out = await handleCommand(jid('94770000006'), '!claim ABC12345 --force');
  assert.match(out, /Claimed Successfully/);
  const claim = calls.find((c) => c.path === '/api/internal/claim-ticket')!;
  assert.equal(claim.body.ticketId, 'ABC12345');
  assert.equal(claim.body.force, true);
});

test('!rate forwards the sender phone so the API can enforce ownership', async () => {
  reset();
  await handleCommand(jid('94770000007'), '!rate abc12345 5 great');
  const rate = calls.find((c) => c.path === '/api/internal/rate-ticket')!;
  assert.equal(rate.body.senderPhone, '94770000007');
  assert.equal(rate.body.rating, 5);
});

test('companion-device suffix in the JID is stripped from the phone number', async () => {
  reset();
  await handleCommand('94770000008:12@s.whatsapp.net', '!deployments');
  assert.match(calls[0].path, /phone=94770000008$/);
});

test('anti-spam notice is sent once, then the flooder is silently ignored', async () => {
  reset();
  const p = jid('94770000009');
  const replies: Array<string | null> = [];
  for (let i = 0; i < 12; i++) replies.push(await handleCommand(p, '!status'));
  const notices = replies.filter((r) => r && /ANTI-SPAM/.test(r));
  assert.equal(notices.length, 1);
  assert.equal(replies.slice(7).every((r) => r === null), true);
});

test('!broadcast sends targetPlatform (the field the API actually reads)', async () => {
  reset();
  responder = (path) => (path.startsWith('/api/internal/customer-summary') ? { user: { role: 'admin' } } : { ok: true, deliveredCount: 3 });
  const out = await handleCommand(jid('94770000010'), '!broadcast Maintenance tonight');
  assert.match(out, /3 recipients/);
  const b = calls.find((c) => c.path === '/api/internal/announcements/send')!;
  assert.equal(b.body.targetPlatform, 'whatsapp');
  assert.equal('platforms' in b.body, false);
});

test('!deployments renders the fields the API returns (subdomain/customDomain)', async () => {
  reset();
  responder = () => ({ deployments: [{ id: 'd1', subdomain: 'my-app', status: 'running', customDomain: 'app.example.com' }] });
  const out = await handleCommand(jid('94770000011'), '!deployments');
  assert.match(out, /my-app/);
  assert.match(out, /app\.example\.com/);
  assert.doesNotMatch(out, /undefined/);
});

test('!invoice rejects zero, negative and non-finite amounts', async () => {
  reset();
  responder = (path) => (path.startsWith('/api/internal/customer-summary') ? { user: { role: 'admin' } } : { ok: true });
  for (const amt of ['0', '-5', 'Infinity']) {
    const out = await handleCommand(jid('94770000012'), `!invoice a@b.com ${amt} test`);
    assert.match(out, /Usage/);
  }
  assert.equal(calls.some((c) => c.path.includes('generate-and-send')), false);
});

test('!broadcast tells staff when the per-broadcast cap left customers out', async () => {
  reset();
  responder = (path) => (path.startsWith('/api/internal/customer-summary') ? { user: { role: 'admin' } } : { ok: true, deliveredCount: 100, totalRecipients: 250, truncated: true });
  const out = await handleCommand(jid('94770000013'), '!broadcast Maintenance tonight');
  assert.match(out, /only 100 of 250/);
  assert.match(out, /did NOT receive/);
});
