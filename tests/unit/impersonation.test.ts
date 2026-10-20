import test from 'node:test';
import assert from 'node:assert/strict';
import { canImpersonate } from '../../apps/api/src/lib/impersonation';

const customer = (over: any = {}) => ({ role: 'customer', isBanned: false, assignedAdminId: 'admin1', ...over });

test('dev may impersonate any active customer', () => {
  assert.equal(canImpersonate({ id: 'd', role: 'dev' }, customer({ assignedAdminId: null })), true);
  assert.equal(canImpersonate({ id: 'd', role: 'dev' }, customer({ assignedAdminId: 'other' })), true);
});

test('admin may impersonate only customers assigned to them', () => {
  assert.equal(canImpersonate({ id: 'admin1', role: 'admin' }, customer()), true);
  assert.equal(canImpersonate({ id: 'admin1', role: 'admin' }, customer({ assignedAdminId: 'admin2' })), false);
  assert.equal(canImpersonate({ id: 'admin1', role: 'admin' }, customer({ assignedAdminId: null })), false);
});

test('nobody can impersonate staff accounts or banned customers', () => {
  for (const role of ['admin', 'dev', 'support']) {
    assert.equal(canImpersonate({ id: 'd', role: 'dev' }, customer({ role })), false, `target ${role}`);
  }
  assert.equal(canImpersonate({ id: 'd', role: 'dev' }, customer({ isBanned: true })), false);
});

test('support and customers can never impersonate', () => {
  assert.equal(canImpersonate({ id: 'admin1', role: 'support' }, customer()), false);
  assert.equal(canImpersonate({ id: 'admin1', role: 'customer' }, customer()), false);
});
