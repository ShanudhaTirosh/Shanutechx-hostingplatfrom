import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { memoryDb } from './helpers/memoryDb';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';
import { discordText, dispatchAnnouncement, sweepScheduledAnnouncements, whatsappText, type AnnouncementSenders } from '../../apps/api/src/lib/announcements';

const NOW = new Date('2026-10-17T12:00:00Z');
const past = new Date('2026-10-17T11:00:00Z');
const future = new Date('2026-10-17T13:00:00Z');

const users = (n: number, withoutPhone = 0) => [
  ...Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}`, phoneNumber: `9477000${String(i + 1).padStart(4, '0')}`, createdAt: new Date(1000 + i) })),
  ...Array.from({ length: withoutPhone }, (_, i) => ({ id: `x${i + 1}`, phoneNumber: null, createdAt: new Date(10 + i) })),
];
const ann = (over: any = {}) => ({ id: 'a1', title: 'Maintenance', message: 'Tonight 22:00', targetPlatform: 'both', channelId: null, rolePing: null, imageUrl: null, status: 'scheduled', scheduledFor: past, sentAt: null, ...over });

function senders(opts: { discordOk?: boolean; throws?: boolean } = {}) {
  const discord: Array<{ channel?: string; message: string }> = [];
  const whatsapp: Array<{ phone: string; message: string }> = [];
  const s: AnnouncementSenders = {
    discord: async (channel, message) => { await Promise.resolve(); if (opts.throws) throw new Error('boom'); discord.push({ channel, message }); return opts.discordOk ?? true; },
    whatsapp: (phone, message) => { if (opts.throws) throw new Error('boom'); whatsapp.push({ phone, message }); },
  };
  return { s, discord, whatsapp };
}

// ---------------------------------------------------------------- dispatch
test('WhatsApp dispatch is capped but honest: deterministic oldest-first order, total and truncated reported', async () => {
  const db = memoryDb({ user: users(5, 2) });
  const a = senders();
  const r = await dispatchAnnouncement(db, ann({ targetPlatform: 'whatsapp' }), a.s, { whatsappLimit: 3 });
  assert.deepEqual({ deliveredCount: r.deliveredCount, totalRecipients: r.totalRecipients, truncated: r.truncated }, { deliveredCount: 3, totalRecipients: 5, truncated: true });
  assert.deepEqual(a.whatsapp.map((w) => w.phone), ['94770000001', '94770000002', '94770000003'], 'oldest customers first, people without a phone never counted');
  assert.equal(a.discord.length, 0);

  const all = senders();
  const r2 = await dispatchAnnouncement(db, ann({ targetPlatform: 'whatsapp' }), all.s, { whatsappLimit: 10 });
  assert.deepEqual({ d: r2.deliveredCount, t: r2.totalRecipients, trunc: r2.truncated }, { d: 5, t: 5, trunc: false });
});

test('platform selection: discord only, whatsapp only, both; the default channel is used when none is given', async () => {
  const db = memoryDb({ user: users(2) });
  const d = senders();
  await dispatchAnnouncement(db, ann({ targetPlatform: 'discord' }), d.s, { defaultChannelId: 'chan-default' });
  assert.deepEqual([d.discord.length, d.whatsapp.length, d.discord[0].channel], [1, 0, 'chan-default']);
  const w = senders();
  await dispatchAnnouncement(db, ann({ targetPlatform: 'whatsapp' }), w.s, {});
  assert.deepEqual([w.discord.length, w.whatsapp.length], [0, 2]);
  const b = senders();
  await dispatchAnnouncement(db, ann({ targetPlatform: 'both', channelId: 'c9' }), b.s, {});
  assert.deepEqual([b.discord.length, b.whatsapp.length, b.discord[0].channel], [1, 2, 'c9']);
});

test('message formats', () => {
  assert.equal(whatsappText(ann()), '📢 *Maintenance*\n\nTonight 22:00');
  assert.equal(discordText(ann({ rolePing: '@here', imageUrl: 'https://x/y.png' })), '@here\n📢 **Maintenance**\nTonight 22:00\nhttps://x/y.png');
  assert.equal(discordText(ann()), '📢 **Maintenance**\nTonight 22:00');
});

// ---------------------------------------------------------------- scheduled sweep
test('a due scheduled announcement is dispatched once and marked sent; future / draft / sent ones are left alone', async () => {
  const db = memoryDb({ user: users(2), announcement: [ann(), ann({ id: 'a2', scheduledFor: future }), ann({ id: 'a3', status: 'draft' }), ann({ id: 'a4', status: 'sent' })] });
  const a = senders();
  const r = await sweepScheduledAnnouncements(db, a.s, {}, NOW);
  assert.deepEqual(r, { processed: 1, failed: 0 });
  assert.equal(a.discord.length, 1);
  assert.equal(a.whatsapp.length, 2);
  const row = (id: string) => db.tables.announcement.find((x: any) => x.id === id);
  assert.equal(row('a1').status, 'sent');
  assert.ok(row('a1').sentAt, 'sentAt must be recorded');
  assert.deepEqual(['a2', 'a3', 'a4'].map((id) => row(id).status), ['scheduled', 'draft', 'sent']);
});

test('overlapping sweeps dispatch an announcement exactly once', async () => {
  const db = memoryDb({ user: users(3), announcement: [ann()] });
  const a = senders();
  await Promise.all([sweepScheduledAnnouncements(db, a.s, {}, NOW), sweepScheduledAnnouncements(db, a.s, {}, NOW), sweepScheduledAnnouncements(db, a.s, {}, NOW)]);
  assert.equal(a.discord.length, 1);
  assert.equal(a.whatsapp.length, 3);
});

test('failures are recorded and never retried: a Discord-only announcement that cannot be delivered, or a thrown error', async () => {
  const dOnly = memoryDb({ announcement: [ann({ targetPlatform: 'discord' })] });
  const bad = senders({ discordOk: false });
  assert.deepEqual(await sweepScheduledAnnouncements(dOnly, bad.s, {}, NOW), { processed: 0, failed: 1 });
  assert.equal(dOnly.tables.announcement[0].status, 'failed');
  const again = senders();
  await sweepScheduledAnnouncements(dOnly, again.s, {}, NOW);
  assert.equal(again.discord.length, 0, 'a failed announcement must not be re-sent');

  const thrown = memoryDb({ user: users(1), announcement: [ann()] });
  assert.deepEqual(await sweepScheduledAnnouncements(thrown, senders({ throws: true }).s, {}, NOW), { processed: 0, failed: 1 });
  assert.equal(thrown.tables.announcement[0].status, 'failed');

  const both = memoryDb({ user: users(2), announcement: [ann({ targetPlatform: 'both' })] });
  assert.deepEqual(await sweepScheduledAnnouncements(both, senders({ discordOk: false }).s, {}, NOW), { processed: 1, failed: 0 }, 'WhatsApp still went out, so it counts as sent');
});

// ---------------------------------------------------------------- the real route
const realFetch = globalThis.fetch;
const posted: Array<{ url: string; body: any }> = [];
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (u.startsWith('http://127.0.0.1') && !u.includes('/internal/send')) return realFetch(url, init);
  if (init?.body) posted.push({ url: u, body: JSON.parse(init.body) });
  return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

async function postAnnouncement(body: any, totalUsers = 150) {
  posted.length = 0;
  const f = makeFakePrisma({
    'announcement.create': (a: any) => ({ id: 'a1', ...a.data }),
    'user.count': () => totalUsers,
    'user.findMany': (args: any) => users(Math.min(totalUsers, args.take ?? totalUsers)),
  });
  const s = await mountRouter('internalBot', 'internalBotRouter', f.prisma);
  try {
    const r = await s.call('POST', '/internal/announcements/send', { body, headers: { 'x-internal-secret': process.env.WHATSAPP_INTERNAL_SECRET! } });
    await new Promise((res) => setTimeout(res, 150));
    return r;
  } finally { s.close(); }
}

test('POST /internal/announcements/send reports the cap instead of silently dropping recipients', async () => {
  delete process.env.WHATSAPP_BROADCAST_LIMIT;
  const r = await postAnnouncement({ title: 'T', message: 'M', targetPlatform: 'whatsapp' });
  assert.equal(r.status, 200);
  assert.deepEqual({ d: r.json.deliveredCount, t: r.json.totalRecipients, trunc: r.json.truncated }, { d: 100, t: 150, trunc: true });
  assert.equal(posted.filter((p) => p.url.endsWith('/internal/send')).length, 100);
});

test('the broadcast limit is configurable (WHATSAPP_BROADCAST_LIMIT)', async () => {
  process.env.WHATSAPP_BROADCAST_LIMIT = '120';
  try {
    const r = await postAnnouncement({ title: 'T', message: 'M', targetPlatform: 'whatsapp' });
    assert.equal(r.json.deliveredCount, 120);
    assert.equal(r.json.truncated, true);
  } finally { delete process.env.WHATSAPP_BROADCAST_LIMIT; }
});

test('a SCHEDULED announcement is stored for later and nothing is sent now', async () => {
  const r = await postAnnouncement({ title: 'T', message: 'M', targetPlatform: 'both', scheduledFor: '2030-01-01T00:00:00Z' });
  assert.equal(r.status, 200);
  assert.equal(r.json.announcement.status, 'scheduled');
  assert.equal(posted.length, 0);
});

// ---------------------------------------------------------------- wiring
test('the worker schedules the announcement sweep and its queue never retries', () => {
  const API = path.join(__dirname, '../../apps/api/src');
  const worker = fs.readFileSync(path.join(API, 'worker.ts'), 'utf8');
  assert.match(worker, /new Worker<AnnouncementSweepJob>\(\s*'announcement-sweep'/);
  assert.match(worker, /announcementSweepQueue\.upsertJobScheduler\(\s*'announcement-sweep-recurring',\s*\{ every: 60 \* 1000 \}/);
  const queue = fs.readFileSync(path.join(API, 'lib/queue.ts'), 'utf8');
  const def = queue.slice(queue.indexOf("new Queue<AnnouncementSweepJob>('announcement-sweep'"), queue.indexOf("new Queue<WebmailSweepJob>('webmail-sweep'"));
  assert.match(def, /attempts: 1\b/);
});
