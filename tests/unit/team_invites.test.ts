import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTeamInviteEmail } from '../../apps/api/src/lib/emailTemplates';

function generateInviteToken(length = 24): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length * 2; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildInviteUrl(appBaseUrl: string, token: string): string {
  const base = appBaseUrl.replace(/\/$/, '');
  return `${base}/team/accept?token=${token}`;
}

function mapResourcePermissions(
  rawPermissions: Array<{ resourceType: string; resourceId: string; permission: string }>
) {
  return rawPermissions
    .filter((p) => p.permission !== 'none')
    .map((p) => ({
      type: p.resourceType,
      id: p.resourceId,
      level: p.permission,
    }));
}

test('Team Invites & Email Dispatch Unit Suite', async (t) => {
  await t.test('generates secure 48-char hex invite token', () => {
    const token = generateInviteToken(24);
    assert.equal(token.length, 48);
    assert.equal(/^[a-z0-9]+$/.test(token), true);
  });

  await t.test('constructs valid invitation accept URL', () => {
    const token = 'abcdef1234567890abcdef1234567890abcdef1234567890';
    const url = buildInviteUrl('https://dashboard.shanutechx.com', token);
    assert.equal(url, `https://dashboard.shanutechx.com/team/accept?token=${token}`);
  });

  await t.test('renders branded team invite HTML email with CTA link', () => {
    const emailData = renderTeamInviteEmail({
      teamName: 'Acme Cloud Corp',
      inviterName: 'Shanudha Tirosh',
      role: 'developer',
      inviteLink: 'https://dashboard.shanutechx.com/team/accept?token=sample123',
    });

    assert.equal(emailData.subject.includes('Acme Cloud Corp'), true);
    assert.equal(emailData.html.includes('Shanudha Tirosh'), true);
    assert.equal(emailData.html.includes('DEVELOPER'), true);
    assert.equal(emailData.html.includes('https://dashboard.shanutechx.com/team/accept?token=sample123'), true);
    assert.equal(emailData.text.includes('Accept your invitation here'), true);
  });

  await t.test('correctly maps and filters granular resource permissions', () => {
    const raw = [
      { resourceType: 'deployment', resourceId: 'dep-101', permission: 'manage' },
      { resourceType: 'managed_database', resourceId: 'db-202', permission: 'view' },
      { resourceType: 'vps', resourceId: 'vps-303', permission: 'none' },
    ];

    const mapped = mapResourcePermissions(raw);
    assert.equal(mapped.length, 2);
    assert.deepEqual(mapped[0], { type: 'deployment', id: 'dep-101', level: 'manage' });
    assert.deepEqual(mapped[1], { type: 'managed_database', id: 'db-202', level: 'view' });
  });
});
