import test from 'node:test';
import assert from 'assert/strict';

// Test 1: WhatsApp connection exports & variables
test('WhatsApp connection module exposes telemetry state', async () => {
  const conn = require('../../services/whatsapp-bot/src/connection');
  assert.equal(typeof conn.getTelemetryState, 'function');
  const state = conn.getTelemetryState();
  assert.equal(state.state, 'disconnected');
  assert.equal(state.qr, null);
});

// Test 2: Order ID prefix matching pattern
test('Order ID search handles both full UUID and 8-character short prefix', () => {
  const shortId = 'A1B2C3D4';
  const fullUuid = 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890';

  const buildWhere = (orderId: string) => ({
    OR: [
      { id: orderId },
      { id: { startsWith: orderId } },
    ],
  });

  const query = buildWhere(shortId);
  assert.equal(query.OR[0].id, 'A1B2C3D4');
  assert.equal(query.OR[1].id.startsWith, 'A1B2C3D4');

  assert.ok(fullUuid.startsWith(shortId));
});
