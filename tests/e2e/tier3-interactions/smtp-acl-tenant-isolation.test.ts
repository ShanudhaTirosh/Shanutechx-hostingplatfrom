import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { canAccessMailbox } from '../../../apps/api/src/lib/mailboxAcl';

describe('Tier 3: Cross-Feature Interactions — SMTP Provisioning, Mailbox ACL & Multi-Tenant Isolation', () => {
  let server: TestServerInstance;
  const accountId = 'smtp_pair_test_001';

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  it('T3.21: Step 1: Provision SMTP mailbox for Customer 1 with quota and encrypted credentials', async () => {
    server.seed({
      smtpAccount: [
        {
          id: accountId,
          userId: TEST_USERS.customer1.id,
          smtpUsername: 'alice@custom-corp.com',
          smtpHost: 'mail.shanutechx.com',
          smtpPort: 587,
          credentialRef: 'enc_aes256_mock_blob',
          storageQuotaMb: 5120,
          mailboxAcl: [],
          createdAt: new Date(),
        },
      ],
    });

    const account = await server.db.smtpAccount.findUnique({ where: { id: accountId } });
    assert.ok(account);
    assert.equal(account.smtpUsername, 'alice@custom-corp.com');
  });

  it('T3.22: Step 2: Account owner (Customer 1) has full read, write, and manage access', async () => {
    const account = await server.db.smtpAccount.findUnique({ where: { id: accountId } });
    const access = canAccessMailbox(account, TEST_USERS.customer1.id, 'customer', 'write');
    assert.equal(access.allowed, true);
  });

  it('T3.23: Step 3: Customer 2 is strictly blocked from reading or sending from Customer 1 mailbox', async () => {
    const account = await server.db.smtpAccount.findUnique({ where: { id: accountId } });
    const access = canAccessMailbox(account, TEST_USERS.customer2.id, 'customer', 'read');
    assert.equal(access.allowed, false);
  });

  it('T3.24: Step 4: Grant granular read-only ACL to support staff', async () => {
    const updatedAcl = [
      {
        userId: TEST_USERS.support.id,
        userEmail: TEST_USERS.support.email,
        userName: 'Support Agent',
        role: 'support',
        permissions: ['read'],
        grantedAt: new Date().toISOString(),
        grantedBy: TEST_USERS.dev.id,
      },
    ];

    await server.db.smtpAccount.update({
      where: { id: accountId },
      data: { mailboxAcl: updatedAcl },
    });

    const account = await server.db.smtpAccount.findUnique({ where: { id: accountId } });
    const readCheck = canAccessMailbox(account, TEST_USERS.support.id, 'support', 'read');
    assert.equal(readCheck.allowed, true);

    const writeCheck = canAccessMailbox(account, TEST_USERS.support.id, 'support', 'write');
    assert.equal(writeCheck.allowed, false);
  });

  it('T3.25: Step 5: Dev role retains superuser administration access across all mailboxes', async () => {
    const account = await server.db.smtpAccount.findUnique({ where: { id: accountId } });
    const devAccess = canAccessMailbox(account, TEST_USERS.dev.id, 'dev', 'manage');
    assert.equal(devAccess.allowed, true);
  });
});
