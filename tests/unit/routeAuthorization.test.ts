import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

// ---------- orders: DELETE /cart/items/:itemId ----------
function cartItem(status: string, owner = 'u1') {
  return () => ({ id: 'i1', orderId: 'o1', order: { id: 'o1', userId: owner, status } });
}
const cartHandlers = { 'orderItem.findMany': () => [], 'order.update': () => ({}), 'orderItem.delete': () => ({}) };

test('cart: a customer can remove an item from their own DRAFT order', async () => {
  const f = makeFakePrisma({ ...cartHandlers, 'orderItem.findUnique': cartItem('draft') });
  const s = await mountRouter('orders', 'ordersRouter', f.prisma);
  try {
    const r = await s.call('DELETE', '/cart/items/i1');
    assert.equal(r.status, 200);
    assert.equal(f.count('orderItem.delete') >= 1, true);
  } finally { s.close(); }
});

test('cart: items of a placed/paid order can NOT be removed (would silently re-price a paid order)', async () => {
  for (const status of ['awaiting_payment', 'paid', 'cancelled']) {
    const f = makeFakePrisma({ ...cartHandlers, 'orderItem.findUnique': cartItem(status) });
    const s = await mountRouter('orders', 'ordersRouter', f.prisma);
    try {
      const r = await s.call('DELETE', '/cart/items/i1');
      assert.equal(r.status, 409, `status=${status}`);
      assert.equal(f.count('orderItem.delete'), 0, `status=${status} must not delete`);
      assert.equal(f.count('order.update'), 0, `status=${status} must not rewrite totals`);
    } finally { s.close(); }
  }
});

test("cart: another customer's item is a 404", async () => {
  const f = makeFakePrisma({ ...cartHandlers, 'orderItem.findUnique': cartItem('draft', 'someone-else') });
  const s = await mountRouter('orders', 'ordersRouter', f.prisma);
  try {
    assert.equal((await s.call('DELETE', '/cart/items/i1')).status, 404);
    assert.equal(f.count('orderItem.delete'), 0);
  } finally { s.close(); }
});

// ---------- email: GET /email/domains/:id/dns ----------
const domainRow = () => ({ id: 'd1', userId: 'owner', domain: 'acme.test', status: 'verified' });

test('email DNS details: owner and admin/dev see them, other customers get 404', async () => {
  const f = makeFakePrisma({ 'emailDomain.findUnique': domainRow });
  const s = await mountRouter('email', 'emailRouter', f.prisma);
  try {
    assert.equal((await s.call('GET', '/email/domains/d1/dns', { user: 'owner' })).status, 200);
    assert.equal((await s.call('GET', '/email/domains/d1/dns', { user: 'staff', role: 'admin' })).status, 200);
    const other = await s.call('GET', '/email/domains/d1/dns', { user: 'intruder' });
    assert.equal(other.status, 404);
    assert.equal(JSON.stringify(other.json).includes('acme.test'), false);
  } finally { s.close(); }
});

// ---------- webmail: snooze + schedule validation ----------
const ownMessage = () => ({ id: 'm1' });

test('snooze: rejects an invalid date and an unknown return folder', async () => {
  const f = makeFakePrisma({ 'webmailMessage.findFirst': ownMessage, 'webmailSnooze.create': (a: any) => a.data });
  const s = await mountRouter('webmail', 'webmailRouter', f.prisma);
  try {
    assert.equal((await s.call('POST', '/webmail/messages/m1/snooze', { body: { snoozedUntil: 'not-a-date' } })).status, 400);
    assert.equal((await s.call('POST', '/webmail/messages/m1/snooze', { body: { snoozedUntil: '2030-01-01T00:00:00Z', returnFolder: '../x' } })).status, 400);
    assert.equal(f.count('webmailSnooze.create'), 0);
  } finally { s.close(); }
});

test("snooze: only the owner's message can be snoozed (no snooze row for someone else's message id)", async () => {
  const f = makeFakePrisma({ 'webmailMessage.findFirst': () => null, 'webmailSnooze.create': (a: any) => a.data });
  const s = await mountRouter('webmail', 'webmailRouter', f.prisma);
  try {
    const r = await s.call('POST', '/webmail/messages/not-mine/snooze', { body: { snoozedUntil: '2030-01-01T00:00:00Z' } });
    assert.equal(r.status, 404);
    assert.equal(f.count('webmailSnooze.create'), 0);
  } finally { s.close(); }
});

test('snooze: valid request for own message succeeds with the default folder', async () => {
  const f = makeFakePrisma({ 'webmailMessage.findFirst': ownMessage, 'webmailSnooze.create': (a: any) => a.data, 'webmailMessage.updateMany': () => ({ count: 1 }) });
  const s = await mountRouter('webmail', 'webmailRouter', f.prisma);
  try {
    const r = await s.call('POST', '/webmail/messages/m1/snooze', { body: { snoozedUntil: '2030-01-01T00:00:00Z' } });
    assert.equal(r.status, 200);
    assert.equal(f.calls.find((c) => c.fn === 'webmailSnooze.create')!.args[0].data.returnFolder, 'inbox');
  } finally { s.close(); }
});

test('schedule: rejects invalid or past dates and non-string fields, accepts a future date', async () => {
  const f = makeFakePrisma({ 'webmailScheduledSend.create': (a: any) => ({ id: 's1', ...a.data }) });
  const s = await mountRouter('webmail', 'webmailRouter', f.prisma);
  try {
    const base = { recipientTo: 'a@b.com', subject: 'hi', body: 'x' };
    assert.equal((await s.call('POST', '/webmail/messages/schedule', { body: { ...base, scheduledFor: 'garbage' } })).status, 400);
    assert.equal((await s.call('POST', '/webmail/messages/schedule', { body: { ...base, scheduledFor: '2001-01-01T00:00:00Z' } })).status, 400);
    assert.equal((await s.call('POST', '/webmail/messages/schedule', { body: { ...base, recipientTo: { x: 1 }, scheduledFor: '2030-01-01T00:00:00Z' } })).status, 400);
    assert.equal(f.count('webmailScheduledSend.create'), 0);
    assert.equal((await s.call('POST', '/webmail/messages/schedule', { body: { ...base, scheduledFor: '2030-01-01T00:00:00Z' } })).status, 200);
    assert.equal(f.count('webmailScheduledSend.create'), 1);
  } finally { s.close(); }
});
