import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderWelcomeEmail,
  renderSubscriptionGracePeriodEmail,
  renderDeploymentStatusEmail,
  renderOrderPaidEmail,
} from '../../apps/api/src/lib/emailTemplates';

function parseEnvString(envText: string): Array<{ key: string; value: string }> {
  const lines = envText.split('\n');
  const parsedRows: Array<{ key: string; value: string }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      parsedRows.push({ key, value });
    }
  }
  return parsedRows;
}

test('Anti-Spam Email Suite & Env Vars Studio Unit Suite', async (t) => {
  await t.test('renders Welcome Email with branding and dashboard CTA', () => {
    const rendered = renderWelcomeEmail({ customerName: 'Shanudha Tirosh' });
    assert.equal(rendered.subject.includes('Welcome to ShanuTechX'), true);
    assert.equal(rendered.html.includes('Shanudha Tirosh'), true);
    assert.equal(rendered.html.includes('Account Active'), true);
    assert.equal(rendered.text.includes('Launch Client Dashboard'), false);
  });

  await t.test('renders Grace Period Warning Email with expiration date', () => {
    const rendered = renderSubscriptionGracePeriodEmail({
      serviceName: 'Pro NVMe VPS - Node #1',
      gracePeriodEndsAt: '2026-09-01 23:59 UTC',
    });
    assert.equal(rendered.subject.includes('Grace Period Warning'), true);
    assert.equal(rendered.html.includes('Pro NVMe VPS - Node #1'), true);
    assert.equal(rendered.html.includes('2026-09-01 23:59 UTC'), true);
    assert.equal(rendered.html.includes('Grace Period Active'), true);
  });

  await t.test('renders Deployment Status Alert for Live and Failed states', () => {
    const live = renderDeploymentStatusEmail({
      deploymentName: 'my-whatsapp-bot',
      subdomain: 'my-wa-bot',
      status: 'running',
    });
    assert.equal(live.subject.includes('Deployment Live: my-whatsapp-bot'), true);
    assert.equal(live.html.includes('my-wa-bot.shanutechx.com'), true);

    const failed = renderDeploymentStatusEmail({
      deploymentName: 'my-whatsapp-bot',
      status: 'failed',
      errorMessage: 'ModuleNotFoundError: Cannot find module baileys',
    });
    assert.equal(failed.subject.includes('FAILED'), true);
    assert.equal(failed.html.includes('ModuleNotFoundError'), true);
  });

  await t.test('parses bulk raw .env text correctly with quotes and comments', () => {
    const rawEnv = `
# Server Configuration
PORT=4000
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
API_SECRET='sk_live_12345'
# Empty trailing comment
    `;

    const parsed = parseEnvString(rawEnv);
    assert.equal(parsed.length, 3);
    assert.deepEqual(parsed[0], { key: 'PORT', value: '4000' });
    assert.deepEqual(parsed[1], { key: 'DATABASE_URL', value: 'postgresql://user:pass@localhost:5432/db' });
    assert.deepEqual(parsed[2], { key: 'API_SECRET', value: 'sk_live_12345' });
  });
});
