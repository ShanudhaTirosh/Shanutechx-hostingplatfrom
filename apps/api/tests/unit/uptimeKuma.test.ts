import test from 'node:test';
import assert from 'node:assert';
import { UptimeKumaClient } from '../../src/lib/uptimeKuma';
import { GrafanaClient } from '../../src/lib/grafana';

test('UptimeKumaClient - handles unconfigured instance gracefully', async () => {
  const client = new UptimeKumaClient();
  assert.strictEqual(client.isConfigured(), false);

  const monitors = await client.getMonitors();
  assert.deepStrictEqual(monitors, []);

  const pushed = await client.pushHeartbeat('');
  assert.strictEqual(pushed, false);
});

test('UptimeKumaClient - handles invalid endpoint fallback', async () => {
  const client = new UptimeKumaClient('http://127.0.0.1:59999', 'nonexistent');
  assert.strictEqual(client.isConfigured(), true);

  const monitors = await client.getMonitors();
  assert.deepStrictEqual(monitors, []);
});

test('GrafanaClient - handles unconfigured instance gracefully', async () => {
  const client = new GrafanaClient();
  assert.strictEqual(client.isConfigured(), false);

  const metrics = await client.getClusterMetrics();
  assert.strictEqual(metrics.isConfigured, false);
  assert.strictEqual(metrics.status, 'unconfigured');
  assert.strictEqual(metrics.cpuUsagePct, 0);
  assert.strictEqual(metrics.memoryUsagePct, 0);
});

