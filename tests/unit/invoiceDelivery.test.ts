import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fakeSmtp } from './helpers/fakeSmtp';
import { loadApiModule, makeFakePrisma, mountRouter } from './helpers/routeStubs';

/**
 * The invoice endpoint generated a PDF and then threw it away: customers only ever got a text summary.
 * notifyCustomer() now carries an optional attachment to e-mail, WhatsApp and Discord.
 */
const realFetch = globalThis.fetch;
type Seen = { url: string; body: any };
const seen: Seen[] = [];
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (u.startsWith('http://127.0.0.1') && !u.includes('/internal/send')) return realFetch(url, init);
  if (init?.body && /\/internal\/send(-dm)?$/.test(u.split('?')[0])) seen.push({ url: u, body: JSON.parse(init.body) });
  return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), crypto.randomBytes(30_000)]);
const attachment = { fileName: 'INV-2026-ABCDEF12.pdf', mimetype: 'application/pdf', base64: PDF.toString('base64') };
const user = { email: 'cust@example.com', phoneNumber: '94771234567', discordUserId: '123456789012345678' };

async function runNotify(withAttachment: boolean) {
  seen.length = 0;
  const smtp = await fakeSmtp();
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'u', SMTP_PASS: 'p' });
  try {
    const { notifyCustomer } = loadApiModule('lib/notifications', makeFakePrisma().prisma);
    await notifyCustomer(user, 'Your invoice', undefined, undefined, withAttachment ? attachment : undefined);
    return { email: smtp.data(), wa: seen.find((s) => s.url.endsWith('/internal/send'))?.body, dm: seen.find((s) => s.url.endsWith('/internal/send-dm'))?.body };
  } finally { smtp.close(); }
}

test('notifyCustomer delivers the attachment on all three channels', async () => {
  const { email, wa, dm } = await runNotify(true);
  assert.deepEqual(wa.document, attachment, 'WhatsApp bot must receive the document');
  assert.equal(wa.message, 'Your invoice');
  assert.deepEqual(dm.document, attachment, 'Discord bot must receive the document');
  assert.match(email, /Content-Disposition: attachment; filename="INV-2026-ABCDEF12\.pdf"/);
  const start = email.indexOf('\r\n\r\n', email.indexOf('Content-Disposition: attachment')) + 4;
  const b64 = email.slice(start, email.indexOf('\r\n--', start)).replace(/\s+/g, '');
  assert.deepEqual(Buffer.from(b64, 'base64'), PDF, 'the e-mailed PDF must be byte-identical');
});

test('without an attachment nothing changes: no document field, no attachment part', async () => {
  const { email, wa, dm } = await runNotify(false);
  assert.equal('document' in wa, false);
  assert.equal('document' in dm, false);
  assert.equal(email.includes('Content-Disposition: attachment'), false);
});

test('POST /internal/invoices/generate-and-send delivers the generated PDF itself, not just a text summary', async () => {
  seen.length = 0;
  delete process.env.SMTP_USER;
  const order = {
    id: 'cl9x4k2p0001abcdef', createdAt: new Date('2026-10-17T10:00:00Z'), total: 2500, currency: 'USD', status: 'awaiting_payment',
    user, items: [{ quantity: 1, plan: { name: 'Pro Hosting', price: 25 } }],
  };
  const f = makeFakePrisma({ 'order.findUnique': () => order, 'invoice.upsert': () => ({ id: 'inv1' }) });
  const s = await mountRouter('internalBot', 'internalBotRouter', f.prisma);
  try {
    const r = await s.call('POST', '/internal/invoices/generate-and-send', { body: { orderId: order.id }, headers: { 'x-internal-secret': process.env.WHATSAPP_INTERNAL_SECRET! } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    await new Promise((res) => setTimeout(res, 300)); // notifyCustomer is fire-and-forget
  } finally { s.close(); }
  const wa = seen.find((x) => x.url.endsWith('/internal/send'))!.body;
  assert.ok(wa.document, 'the WhatsApp message must carry the PDF');
  assert.equal(wa.document.fileName, 'INV-2026-CL9X4K2P.pdf');
  assert.equal(wa.document.mimetype, 'application/pdf');
  assert.equal(Buffer.from(wa.document.base64, 'base64').subarray(0, 5).toString(), '%PDF-');
  const dm = seen.find((x) => x.url.endsWith('/internal/send-dm'))!.body;
  assert.deepEqual(dm.document, wa.document);
});
