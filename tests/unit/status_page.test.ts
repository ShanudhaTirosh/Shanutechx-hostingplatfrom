import test from 'node:test';
import assert from 'node:assert/strict';

function calculateOverallStatus(componentStatuses: string[], activeMaintenance: boolean) {
  if (componentStatuses.includes('major_outage')) return 'major_outage';
  if (componentStatuses.includes('partial_outage')) return 'partial_outage';
  if (componentStatuses.includes('degraded')) return 'degraded';
  if (activeMaintenance || componentStatuses.includes('maintenance')) return 'maintenance';
  return 'operational';
}

function validateSubscriberTarget(type: 'email' | 'webhook' | 'push', target: string) {
  if (type === 'email') {
    return target.includes('@') && target.includes('.');
  }
  if (type === 'webhook') {
    return target.startsWith('http://') || target.startsWith('https://');
  }
  return target.length > 0;
}

function generate90DayHistory(status: string = 'operational') {
  const days: Array<{ date: string; status: string; uptimePct: number }> = [];
  const now = new Date('2026-08-26T12:00:00Z');
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days.push({
      date: d.toISOString().split('T')[0],
      status: i === 0 ? status : 'operational',
      uptimePct: i === 0 && status !== 'operational' ? 98.5 : 100,
    });
  }
  return days;
}

test('Status Telemetry Engine Unit Suite', async (t) => {
  await t.test('calculates overall operational status when all components operational', () => {
    const status = calculateOverallStatus(['operational', 'operational', 'operational'], false);
    assert.equal(status, 'operational');
  });

  await t.test('calculates major_outage when any component has major_outage', () => {
    const status = calculateOverallStatus(['operational', 'major_outage', 'operational'], false);
    assert.equal(status, 'major_outage');
  });

  await t.test('calculates degraded when component has degraded status', () => {
    const status = calculateOverallStatus(['operational', 'degraded', 'operational'], false);
    assert.equal(status, 'degraded');
  });

  await t.test('calculates maintenance when scheduled maintenance is active', () => {
    const status = calculateOverallStatus(['operational', 'operational'], true);
    assert.equal(status, 'maintenance');
  });

  await t.test('validates email subscriber targets correctly', () => {
    assert.equal(validateSubscriberTarget('email', 'dev@shanutechx.com'), true);
    assert.equal(validateSubscriberTarget('email', 'invalid-email'), false);
  });

  await t.test('validates webhook subscriber targets correctly', () => {
    assert.equal(validateSubscriberTarget('webhook', 'https://hooks.example.com/status'), true);
    assert.equal(validateSubscriberTarget('webhook', 'ftp://invalid-url'), false);
  });

  await t.test('generates exactly 90 days of uptime history', () => {
    const history = generate90DayHistory('operational');
    assert.equal(history.length, 90);
    assert.equal(history[history.length - 1].date, '2026-08-26');
    assert.equal(history[history.length - 1].status, 'operational');
  });
});
