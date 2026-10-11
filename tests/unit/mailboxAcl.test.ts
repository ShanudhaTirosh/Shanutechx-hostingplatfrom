import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserMailboxPermissions,
  canAccessMailbox,
  updateMailboxAcl,
  revokeMailboxAcl,
  normalizeMailboxProfile,
  normalizeMailboxAcl,
  MailboxPermission,
} from '../../apps/api/src/lib/mailboxAcl';

test('Mailbox ACL & Profile Management Suite', async (t) => {
  const dummyAccount = {
    userId: 'cust-123',
    allowedAdminIds: ['admin-legacy'],
    mailboxAcl: [
      {
        userId: 'admin-read-only',
        userEmail: 'readonly@shanutechx.com',
        userName: 'Read Only Admin',
        role: 'admin' as const,
        permissions: ['read'] as MailboxPermission[],
        grantedAt: new Date().toISOString(),
        grantedBy: 'dev-master',
      },
      {
        userId: 'support-full',
        userEmail: 'support@shanutechx.com',
        userName: 'Tier 2 Support',
        role: 'support' as const,
        permissions: ['read', 'write'] as MailboxPermission[],
        grantedAt: new Date().toISOString(),
        grantedBy: 'dev-master',
      },
    ],
  };

  await t.test('Dev role possesses full superuser permissions across any mailbox', () => {
    const permissions = getUserMailboxPermissions(dummyAccount, 'dev-user-999', 'dev');
    assert.ok(permissions.has('read'));
    assert.ok(permissions.has('write'));
    assert.ok(permissions.has('manage'));

    const accessCheck = canAccessMailbox(dummyAccount, 'dev-user-999', 'dev', 'write');
    assert.equal(accessCheck.allowed, true);
  });

  await t.test('Account owner has full read, write, and manage permissions on own mailbox', () => {
    const permissions = getUserMailboxPermissions(dummyAccount, 'cust-123', 'customer');
    assert.ok(permissions.has('read'));
    assert.ok(permissions.has('write'));
    assert.ok(permissions.has('manage'));

    const writeCheck = canAccessMailbox(dummyAccount, 'cust-123', 'customer', 'write');
    assert.equal(writeCheck.allowed, true);
  });

  await t.test('Read-only admin can read messages but is strictly denied write/sending permission', () => {
    const readCheck = canAccessMailbox(dummyAccount, 'admin-read-only', 'admin', 'read');
    assert.equal(readCheck.allowed, true);

    const writeCheck = canAccessMailbox(dummyAccount, 'admin-read-only', 'admin', 'write');
    assert.equal(writeCheck.allowed, false);
    assert.ok(writeCheck.reason?.includes('Forbidden'));
    assert.ok(writeCheck.reason?.includes('Sending / Write permission is required'));

    const manageCheck = canAccessMailbox(dummyAccount, 'admin-read-only', 'admin', 'manage');
    assert.equal(manageCheck.allowed, false);
  });

  await t.test('Support user with read+write permissions can send emails but cannot manage settings', () => {
    const readCheck = canAccessMailbox(dummyAccount, 'support-full', 'support', 'read');
    assert.equal(readCheck.allowed, true);

    const writeCheck = canAccessMailbox(dummyAccount, 'support-full', 'support', 'write');
    assert.equal(writeCheck.allowed, true);

    const manageCheck = canAccessMailbox(dummyAccount, 'support-full', 'support', 'manage');
    assert.equal(manageCheck.allowed, false);
  });

  await t.test('Unassigned user is completely denied access', () => {
    const access = canAccessMailbox(dummyAccount, 'stranger-danger', 'customer', 'read');
    assert.equal(access.allowed, false);
    assert.ok(access.reason?.includes('Access denied'));
  });

  await t.test('Legacy allowedAdminIds fallback grants read & write when no ACL is specified', () => {
    const legacyAcc = {
      userId: 'owner-456',
      allowedAdminIds: ['legacy-staff'],
      mailboxAcl: null,
    };
    const readCheck = canAccessMailbox(legacyAcc, 'legacy-staff', 'admin', 'read');
    assert.equal(readCheck.allowed, true);

    const writeCheck = canAccessMailbox(legacyAcc, 'legacy-staff', 'admin', 'write');
    assert.equal(writeCheck.allowed, true);
  });

  await t.test('updateMailboxAcl modifies permissions and synchronizes allowedAdminIds', () => {
    const updated = updateMailboxAcl(dummyAccount.mailboxAcl, {
      userId: 'new-support-1',
      userEmail: 'agent1@shanutechx.com',
      userName: 'Agent One',
      role: 'support',
      permissions: ['read', 'write'],
      grantedBy: 'dev-master',
    });

    assert.equal(updated.mailboxAcl.length, 3);
    assert.ok(updated.allowedAdminIds.includes('new-support-1'));
    assert.ok(updated.allowedAdminIds.includes('admin-read-only'));
    assert.ok(updated.allowedAdminIds.includes('support-full'));
  });

  await t.test('revokeMailboxAcl completely removes user from ACL and allowedAdminIds', () => {
    const revoked = revokeMailboxAcl(dummyAccount.mailboxAcl, 'admin-read-only');
    assert.equal(revoked.mailboxAcl.length, 1);
    assert.equal(revoked.mailboxAcl[0].userId, 'support-full');
    assert.ok(!revoked.allowedAdminIds.includes('admin-read-only'));
  });

  await t.test('normalizeMailboxProfile extracts and sanitizes per-mailbox profile data', () => {
    const profile = normalizeMailboxProfile(
      {
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        displayName: 'Sarah Connor',
        jobTitle: 'Head of Support',
        company: 'SkyNet Ops',
        phone: '+1 555-0199',
        bio: 'Protecting inboxes since 1984.',
      },
      'Default Name',
      'sarah@shanutechx.com'
    );

    assert.equal(profile.displayName, 'Sarah Connor');
    assert.equal(profile.avatarUrl, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');
    assert.equal(profile.jobTitle, 'Head of Support');
    assert.equal(profile.company, 'SkyNet Ops');
    assert.equal(profile.phone, '+1 555-0199');
    assert.equal(profile.bio, 'Protecting inboxes since 1984.');
  });
});
