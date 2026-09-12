import test from 'node:test';
import assert from 'node:assert';
import { LokiClient } from '../../src/lib/loki';
import { GrafanaClient } from '../../src/lib/grafana';

test('LokiClient - unconfigured instance returns clean empty log result', async () => {
  const client = new LokiClient();
  assert.strictEqual(client.isConfigured(), false);

  const res = await client.queryLogs('{app="api"}', 10);
  assert.strictEqual(res.isConfigured, false);
  assert.strictEqual(res.status, 'unconfigured');
  assert.strictEqual(res.totalLines, 0);
  assert.strictEqual(res.entries.length, 0);
});

test('LokiClient - unreachable endpoint returns disconnected state with empty entries', async () => {
  const client = new LokiClient('http://127.0.0.1:59998');
  assert.strictEqual(client.isConfigured(), true);

  const res = await client.queryLogs('{app="api"}', 5);
  assert.strictEqual(res.status, 'disconnected');
  assert.strictEqual(res.entries.length, 0);
});


test('GrafanaClient - fetchDashboards and getNodeTelemetry return structured metrics', async () => {
  const client = new GrafanaClient();
  const dashboards = await client.fetchDashboards();
  assert.ok(Array.isArray(dashboards));

  const nodeTelemetry = await client.getNodeTelemetry('192.168.1.100');
  assert.ok(typeof nodeTelemetry.cpuUsagePct === 'number');
  assert.ok(typeof nodeTelemetry.memoryUsedMb === 'number');
});
