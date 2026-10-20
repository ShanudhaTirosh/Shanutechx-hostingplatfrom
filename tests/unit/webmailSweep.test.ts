import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb } from './helpers/memoryDb';
import { bodyToHtml, runWebmailSweep, sweepScheduledDrafts, sweepScheduledSends, sweepSnoozes, type OutgoingMail } from '../../apps/api/src/lib/webmailSweep';

const NOW = new Date('2026-10-17T12:00:00Z');
const past = new Date('2026-10-17T11:00:00Z');
const future = new Date('2026-10-17T13:00:00Z');
const account = (over: any = {}) => ({ id: 'acc1', userId: 'u1', allowedAdminIds: [], smtpUsername: 'me@example.com', isSuspended: false, dailySendLimit: 0, dailySendCount: 0, createdAt: new Date(1), ...over });
function recorder(fail = false) {
  const sent: OutgoingMail[] = [];
  return { sent, deliver: async (_a: any, m: OutgoingMail) => { await Promise.resolve(); if (fail) throw new Error('smtp down'); sent.push(m); } };
}

// ------------------------------------------------------------------ snooze
test('snooze: a due message returns to its folder, unread, and the snooze row is removed', async () => {
  const db = memoryDb({
    webmailMessage: [{ id: 'm1', userId: 'u1', folder: 'snoozed', snoozedUntil: past, isRead: true }],
    webmailSnooze: [{ id: 's1', userId: 'u1', messageId: 'm1', snoozedUntil: past, returnFolder: 'archive' }],
  });
  assert.equal(await sweepSnoozes(db, NOW), 1);
  assert.deepEqual({ folder: db.tables.webmailMessage[0].folder, until: db.tables.webmailMessage[0].snoozedUntil, read: db.tables.webmailMessage[0].isRead }, { folder: 'archive', until: null, read: false });
  assert.equal(db.tables.webmailSnooze.length, 0);
});

test('snooze: future snoozes are untouched; a message the user already moved is not touched; a bad folder falls back to inbox', async () => {
  const db = memoryDb({
    webmailMessage: [
      { id: 'm1', userId: 'u1', folder: 'snoozed', snoozedUntil: future },
      { id: 'm2', userId: 'u1', folder: 'trash', snoozedUntil: null },
      { id: 'm3', userId: 'u1', folder: 'snoozed', snoozedUntil: past },
    ],
    webmailSnooze: [
      { id: 's1', userId: 'u1', messageId: 'm1', snoozedUntil: future, returnFolder: 'inbox' },
      { id: 's2', userId: 'u1', messageId: 'm2', snoozedUntil: past, returnFolder: 'inbox' },
      { id: 's3', userId: 'u1', messageId: 'm3', snoozedUntil: past, returnFolder: '../../etc' },
    ],
  });
  await sweepSnoozes(db, NOW);
  const f = (id: string) => db.tables.webmailMessage.find((m: any) => m.id === id).folder;
  assert.equal(f('m1'), 'snoozed');
  assert.equal(f('m2'), 'trash', 'a message the user trashed must stay in trash');
  assert.equal(f('m3'), 'inbox');
  assert.deepEqual(db.tables.webmailSnooze.map((s: any) => s.id), ['s1']);
});

// ------------------------------------------------------------------ scheduled drafts (POST /webmail/send)
const draft = (over: any = {}) => ({ id: 'd1', userId: 'u1', smtpAccountId: 'acc1', folder: 'drafts', scheduledAt: past, senderName: 'Me', senderEmail: 'me@example.com', recipientEmail: 'you@example.com', subject: 'Hi', htmlBody: '<p>hello</p>', ...over });

test('scheduled draft: a due message is delivered once, moved to sent and counted against the daily limit', async () => {
  const db = memoryDb({ webmailMessage: [draft(), draft({ id: 'd2', scheduledAt: future })], smtpAccount: [account()] });
  const r = recorder();
  const stats = await sweepScheduledDrafts(db, r.deliver, NOW);
  assert.deepEqual(stats, { sent: 1, failed: 0, skipped: 0 });
  assert.equal(r.sent.length, 1);
  assert.deepEqual(r.sent[0], { senderName: 'Me', senderEmail: 'me@example.com', to: 'you@example.com', subject: 'Hi', html: '<p>hello</p>', attachments: undefined });
  const m = db.tables.webmailMessage.find((x: any) => x.id === 'd1');
  assert.deepEqual({ folder: m.folder, at: m.scheduledAt }, { folder: 'sent', at: null });
  assert.equal(db.tables.smtpAccount[0].dailySendCount, 1);
  assert.equal(db.tables.webmailMessage.find((x: any) => x.id === 'd2').folder, 'drafts', 'a future message must wait');
});

test('scheduled draft: a failed delivery goes back to a plain draft and is never retried automatically', async () => {
  const db = memoryDb({ webmailMessage: [draft()], smtpAccount: [account()] });
  const bad = recorder(true);
  assert.deepEqual(await sweepScheduledDrafts(db, bad.deliver, NOW), { sent: 0, failed: 1, skipped: 0 });
  const m = db.tables.webmailMessage[0];
  assert.deepEqual({ folder: m.folder, at: m.scheduledAt }, { folder: 'drafts', at: null });
  assert.equal(db.tables.smtpAccount[0].dailySendCount, 0);
  const again = recorder();
  assert.deepEqual(await sweepScheduledDrafts(db, again.deliver, NOW), { sent: 0, failed: 0, skipped: 0 });
  assert.equal(again.sent.length, 0, 'must not resend a failed message');
});

test('scheduled draft: suspended / missing mailbox is not sent; a reached daily limit defers instead of failing', async () => {
  const susp = memoryDb({ webmailMessage: [draft()], smtpAccount: [account({ isSuspended: true })] });
  const r1 = recorder();
  assert.deepEqual(await sweepScheduledDrafts(susp, r1.deliver, NOW), { sent: 0, failed: 1, skipped: 0 });
  assert.equal(r1.sent.length, 0);
  assert.equal(susp.tables.webmailMessage[0].scheduledAt, null);

  const limited = memoryDb({ webmailMessage: [draft()], smtpAccount: [account({ dailySendLimit: 5, dailySendCount: 5 })] });
  const r2 = recorder();
  assert.deepEqual(await sweepScheduledDrafts(limited, r2.deliver, NOW), { sent: 0, failed: 0, skipped: 1 });
  assert.equal(r2.sent.length, 0);
  assert.notEqual(limited.tables.webmailMessage[0].scheduledAt, null, 'stays scheduled for a later sweep');
});

test('scheduled draft: two overlapping sweeps deliver a message exactly once', async () => {
  const db = memoryDb({ webmailMessage: [draft()], smtpAccount: [account()] });
  const r = recorder();
  await Promise.all([sweepScheduledDrafts(db, r.deliver, NOW), sweepScheduledDrafts(db, r.deliver, NOW), sweepScheduledDrafts(db, r.deliver, NOW)]);
  assert.equal(r.sent.length, 1);
  assert.equal(db.tables.smtpAccount[0].dailySendCount, 1);
});

// ------------------------------------------------------------------ WebmailScheduledSend rows
const sched = (over: any = {}) => ({ id: 'r1', userId: 'u1', recipientTo: 'you@example.com', subject: 'Later', body: 'line1\nline2 & more', scheduledFor: past, status: 'pending', attachmentsJson: null, ...over });

test('scheduled send: a due pending row is sent via the owner\'s mailbox, marked sent, and a copy lands in Sent', async () => {
  const db = memoryDb({ webmailScheduledSend: [sched(), sched({ id: 'r2', scheduledFor: future }), sched({ id: 'r3', status: 'cancelled' })], smtpAccount: [account()] });
  const r = recorder();
  assert.deepEqual(await sweepScheduledSends(db, r.deliver, NOW), { sent: 1, failed: 0, skipped: 0 });
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0].html, 'line1<br>line2 &amp; more');
  assert.equal(r.sent[0].to, 'you@example.com');
  assert.equal(r.sent[0].senderEmail, 'me@example.com');
  const status = (id: string) => db.tables.webmailScheduledSend.find((x: any) => x.id === id).status;
  assert.deepEqual([status('r1'), status('r2'), status('r3')], ['sent', 'pending', 'cancelled']);
  const copy = db.tables.webmailMessage.find((m: any) => m.folder === 'sent');
  assert.equal(copy.recipientEmail, 'you@example.com');
  assert.equal(copy.userId, 'u1');
  assert.equal(db.tables.smtpAccount[0].dailySendCount, 1);
});

test('scheduled send: no accessible mailbox -> failed (not sent); delivery error -> failed and never retried', async () => {
  const none = memoryDb({ webmailScheduledSend: [sched()], smtpAccount: [account({ userId: 'someone-else' })] });
  const r1 = recorder();
  assert.deepEqual(await sweepScheduledSends(none, r1.deliver, NOW), { sent: 0, failed: 1, skipped: 0 });
  assert.equal(none.tables.webmailScheduledSend[0].status, 'failed');
  assert.equal(r1.sent.length, 0);

  const boom = memoryDb({ webmailScheduledSend: [sched()], smtpAccount: [account()] });
  assert.deepEqual(await sweepScheduledSends(boom, recorder(true).deliver, NOW), { sent: 0, failed: 1, skipped: 0 });
  assert.equal(boom.tables.webmailScheduledSend[0].status, 'failed');
  const again = recorder();
  await sweepScheduledSends(boom, again.deliver, NOW);
  assert.equal(again.sent.length, 0);
});

test('scheduled send: a delegated admin can send through the mailbox they were granted', async () => {
  const db = memoryDb({ webmailScheduledSend: [sched({ userId: 'admin1' })], smtpAccount: [account({ userId: 'owner', allowedAdminIds: ['admin1'] })] });
  const r = recorder();
  assert.equal((await sweepScheduledSends(db, r.deliver, NOW)).sent, 1);
});

test('scheduled send: overlapping sweeps and a cancel racing the sweep never send twice / send a cancelled row', async () => {
  const db = memoryDb({ webmailScheduledSend: [sched()], smtpAccount: [account()] });
  const r = recorder();
  await Promise.all([sweepScheduledSends(db, r.deliver, NOW), sweepScheduledSends(db, r.deliver, NOW)]);
  assert.equal(r.sent.length, 1);

  const raced = memoryDb({ webmailScheduledSend: [sched()], smtpAccount: [account()] });
  await raced.webmailScheduledSend.updateMany({ where: { id: 'r1', status: 'pending' }, data: { status: 'cancelled' } });
  const r2 = recorder();
  await sweepScheduledSends(raced, r2.deliver, NOW);
  assert.equal(r2.sent.length, 0);
});

test('bodyToHtml wraps plain text (escaped, line breaks kept) and passes real HTML through', () => {
  assert.equal(bodyToHtml('a & b\nc < d'), 'a &amp; b<br>c &lt; d');
  assert.equal(bodyToHtml('<p>already <b>html</b></p>'), '<p>already <b>html</b></p>');
});

test('runWebmailSweep runs all three sweeps and reports what it did', async () => {
  const db = memoryDb({
    webmailMessage: [draft(), { id: 'm9', userId: 'u1', folder: 'snoozed', snoozedUntil: past }],
    webmailSnooze: [{ id: 's9', userId: 'u1', messageId: 'm9', snoozedUntil: past, returnFolder: 'inbox' }],
    webmailScheduledSend: [sched()],
    smtpAccount: [account()],
  });
  const r = recorder();
  assert.deepEqual(await runWebmailSweep(db, r.deliver, NOW), { snoozed: 1, drafts: { sent: 1, failed: 0, skipped: 0 }, scheduled: { sent: 1, failed: 0, skipped: 0 } });
  assert.equal(r.sent.length, 2);
});

// ------------------------------------------------------------------ wiring (worker.ts connects to Redis on import, so check it statically)
import fs from 'node:fs';
import path from 'node:path';
const API = path.join(__dirname, '../../apps/api/src');

test('the webmail sweep is scheduled by the worker and its queue never retries (sending mail must not be retried)', () => {
  const worker = fs.readFileSync(path.join(API, 'worker.ts'), 'utf8');
  assert.match(worker, /new Worker<WebmailSweepJob>\(\s*'webmail-sweep'/);
  assert.match(worker, /webmailSweepQueue\.upsertJobScheduler\(\s*'webmail-sweep-recurring',\s*\{ every: 60 \* 1000 \}/);
  assert.match(worker, /concurrency: 1/);
  const queue = fs.readFileSync(path.join(API, 'lib/queue.ts'), 'utf8');
  const def = queue.slice(queue.indexOf("new Queue<WebmailSweepJob>('webmail-sweep'"), queue.indexOf("new Queue<UptimeSweepJob>('uptime-sweep'"));
  assert.match(def, /attempts: 1\b/);
});
