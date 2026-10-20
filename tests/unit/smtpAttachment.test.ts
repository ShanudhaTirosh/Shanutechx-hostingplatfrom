import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sendSmtpEmail } from '../../apps/api/src/lib/smtpDispatcher';
import { fakeSmtp } from './helpers/fakeSmtp';

async function send(attachmentBytes: Buffer, extra: { filename?: string } = {}) {
  const smtp = await fakeSmtp();
  try {
    await sendSmtpEmail(
      { host: '127.0.0.1', port: smtp.port, user: 'u', pass: 'p', timeoutMs: 5000 },
      {
        from: 'a@example.com', to: 'b@example.com', subject: 'Invoice', html: '<p>hi</p>',
        attachments: [{ filename: extra.filename ?? 'invoice.pdf', contentType: 'application/pdf', content: attachmentBytes.toString('base64') }],
      }
    );
    return smtp.data();
  } finally { smtp.close(); }
}

function attachmentOf(data: string) {
  const start = data.indexOf('Content-Disposition: attachment');
  assert.ok(start > 0, 'attachment part missing');
  const afterHeaders = data.indexOf('\r\n\r\n', start) + 4;
  const end = data.indexOf('\r\n--', afterHeaders);
  return data.slice(afterHeaders, end);
}

test('an attachment arrives byte-for-byte intact (a ~50 KB PDF-sized payload)', async () => {
  const bytes = crypto.randomBytes(50_000);
  const body = attachmentOf(await send(bytes));
  assert.deepEqual(Buffer.from(body.replace(/\s+/g, ''), 'base64'), bytes);
});

test('no line on the wire exceeds the SMTP limit (998) and base64 is wrapped at 76 characters per MIME', async () => {
  const data = await send(crypto.randomBytes(50_000));
  const longest = Math.max(...data.split('\r\n').map((l) => l.length));
  assert.ok(longest <= 998, `longest line is ${longest} characters (SMTP limit 998)`);
  const lines = attachmentOf(data).split('\r\n').filter(Boolean);
  assert.ok(lines.every((l) => l.length <= 76), `base64 line of ${Math.max(...lines.map((l) => l.length))} chars`);
  assert.ok(lines.length > 100, 'expected a multi-line attachment body');
});

test('mails without attachments are unchanged (no attachment part)', async () => {
  const smtp = await fakeSmtp();
  try {
    await sendSmtpEmail({ host: '127.0.0.1', port: smtp.port, user: 'u', pass: 'p', timeoutMs: 5000 }, { from: 'a@example.com', to: 'b@example.com', subject: 's', html: '<p>x</p>' });
    assert.equal(smtp.data().includes('Content-Disposition: attachment'), false);
  } finally { smtp.close(); }
});
