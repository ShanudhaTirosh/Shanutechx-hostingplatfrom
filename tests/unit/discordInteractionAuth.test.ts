import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.DISCORD_INTERNAL_SECRET = 'test-secret-32-characters-long-xxxx';
process.env.API_INTERNAL_URL = 'http://api.test';
delete process.env.DISCORD_STAFF_ROLE_ID;

const require = createRequire(import.meta.url);

let fetchCalls: string[] = [];
let apiResponse: any = { ok: true };
(globalThis as any).fetch = async (url: string) => {
  fetchCalls.push(String(url));
  return { ok: true, status: 200, json: async () => apiResponse };
};

const { handleInteraction } = require('../../services/discord-bot/src/slashCommands.js');

function mk(opts: { id: string; roles?: string[]; kind: 'button' | 'modal' | 'command'; customId?: string; commandName?: string }) {
  const log: any = { replies: [] as any[], edits: [] as any[], modals: 0, deferred: false };
  const roles = (opts.roles || []).map((name, i) => ({ name, id: String(i + 1) }));
  const i: any = {
    user: { id: opts.id, username: 'tester', tag: 'tester#0' },
    member: { roles: { cache: { some: (fn: any) => roles.some(fn) } }, permissions: { has: () => false } },
    customId: opts.customId,
    commandName: opts.commandName,
    deferred: false,
    replied: false,
    isRepliable: () => true,
    isStringSelectMenu: () => false,
    isButton: () => opts.kind === 'button',
    isModalSubmit: () => opts.kind === 'modal',
    isChatInputCommand: () => opts.kind === 'command',
    options: { getString: () => null, getBoolean: () => false, getChannel: () => null },
    reply: async (x: any) => { i.replied = true; log.replies.push(x); },
    deferReply: async () => { i.deferred = true; },
    editReply: async (x: any) => { log.edits.push(x); },
    followUp: async () => {},
    showModal: async () => { log.modals += 1; },
  };
  return { i, log };
}
const reset = () => { fetchCalls = []; apiResponse = { ok: true }; };

test('a non-staff user (e.g. the customer in their ticket channel) cannot use Close/Claim/Reply buttons', async () => {
  for (const [n, action] of ['claim_ticket', 'reply_ticket', 'close_ticket'].entries()) {
    reset();
    const { i, log } = mk({ id: `1000${n}`, kind: 'button', customId: `${action}:abc12345` });
    await handleInteraction(i);
    assert.match(log.replies[0].content, /permission/);
    assert.equal(log.modals, 0);
    assert.equal(fetchCalls.length, 0);
  }
});

test('staff can still use the buttons', async () => {
  reset();
  const { i, log } = mk({ id: '20001', roles: ['Support'], kind: 'button', customId: 'close_ticket:abc12345' });
  await handleInteraction(i);
  assert.equal(log.modals, 1);
});

test('non-staff cannot submit the staff reply/close modals', async () => {
  reset();
  for (const [n, id] of ['modal_reply_ticket:abc12345', 'modal_close_ticket:abc12345'].entries()) {
    const { i, log } = mk({ id: `3000${n}`, kind: 'modal', customId: id });
    await handleInteraction(i);
    assert.match(log.replies[0].content, /permission/);
  }
  assert.equal(fetchCalls.length, 0);
});

test('/tickets-list (customer emails) is staff-only', async () => {
  reset();
  const { i, log } = mk({ id: '40001', kind: 'command', commandName: 'tickets-list' });
  await handleInteraction(i);
  assert.match(log.replies[0].content, /permission/);
  assert.equal(fetchCalls.length, 0);
});

test('DISCORD_STAFF_ROLE_ID role counts as staff (same role that gets ticket-channel access)', async () => {
  reset();
  process.env.DISCORD_STAFF_ROLE_ID = '1';
  const { i, log } = mk({ id: '50001', roles: ['Moderator'], kind: 'button', customId: 'close_ticket:abc12345' });
  await handleInteraction(i);
  delete process.env.DISCORD_STAFF_ROLE_ID;
  assert.equal(log.modals, 1);
});

test('registered-but-unimplemented commands answer instead of timing out', async () => {
  reset();
  const { i, log } = mk({ id: '60001', kind: 'command', commandName: 'deployments' });
  await handleInteraction(i);
  assert.match(log.replies[0].content, /not available yet/);
});

test('a failure after deferReply tells the user instead of leaving "thinking..."', async () => {
  reset();
  apiResponse = { ok: true }; // success but no `ticket` -> res.ticket.id throws
  const { i, log } = mk({ id: '70001', kind: 'command', commandName: 'open-ticket' });
  i.options.getString = (k: string) => (k === 'subject' ? 's' : k === 'message' ? 'm' : null);
  await handleInteraction(i);
  assert.equal(i.deferred, true);
  assert.match(String(log.edits[0]), /Something went wrong/);
});
