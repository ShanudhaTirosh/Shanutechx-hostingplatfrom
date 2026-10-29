/**
 * Adversarial Stress-Test Suite for Milestone 1:
 * - Auth Role Guards (`requireDev`, `requireStaff`, `requireAdminOrDev`)
 * - Mailbox Access Control (`canAccessMailbox`, `getUserMailboxPermissions`, `normalizeMailboxAcl`, `updateMailboxAcl`, `revokeMailboxAcl`)
 *
 * Designed and executed by Challenger 2 (teamwork_challenger_m1_2).
 * Verifies zero role escalations, zero bypasses, and strict rejection of all invalid/malformed inputs.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express, { Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  requireDev,
  requireStaff,
  requireAdminOrDev,
  AuthedRequest,
} from '../../apps/api/src/middleware/auth';

import {
  canAccessMailbox,
  getUserMailboxPermissions,
  normalizeMailboxAcl,
  updateMailboxAcl,
  revokeMailboxAcl,
  normalizeMailboxProfile,
  MailboxPermission,
  MailboxAclEntry,
} from '../../apps/api/src/lib/mailboxAcl';

describe('Adversarial Test Suite: Milestone 1 Security & ACL Hardening', () => {
  let server: Server;
  let baseUrl: string;

  // Custom mock authenticator to inject arbitrary user objects for adversarial testing
  let injectedUser: any = undefined;

  function adversarialAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
    req.user = injectedUser;
    next();
  }

  before(async () => {
    const app = express();
    app.use(adversarialAuth);

    app.get('/test/dev-only', requireDev, (_req, res) => {
      res.status(200).json({ ok: true, access: 'granted_dev' });
    });

    app.get('/test/staff-only', requireStaff, (_req, res) => {
      res.status(200).json({ ok: true, access: 'granted_staff' });
    });

    app.get('/test/admin-or-dev', requireAdminOrDev, (_req, res) => {
      res.status(200).json({ ok: true, access: 'granted_admin_or_dev' });
    });

    // Listen on dynamic port 0 to prevent conflicts
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  async function requestPath(path: string): Promise<{ status: number; body: any }> {
    const res = await fetch(`${baseUrl}${path}`);
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    return { status: res.status, body };
  }

  // =========================================================================
  // SECTION 1: Adversarial Stress-Testing of `requireDev`
  // =========================================================================
  describe('1. Adversarial Challenge on `requireDev` Middleware', () => {
    it('1.1 Allows legitimate dev role with 200 OK', async () => {
      injectedUser = { id: 'u_dev', role: 'dev', email: 'dev@shanutechx.internal' };
      const { status, body } = await requestPath('/test/dev-only');
      assert.equal(status, 200);
      assert.deepEqual(body, { ok: true, access: 'granted_dev' });
    });

    it('1.2 Blocks admin role escalation attempt with 403 and exact error payload', async () => {
      injectedUser = { id: 'u_admin', role: 'admin', email: 'admin@shanutechx.internal' };
      const { status, body } = await requestPath('/test/dev-only');
      assert.equal(status, 403);
      assert.deepEqual(body, { error: 'Dev access required' });
    });

    it('1.3 Blocks support role escalation attempt with 403', async () => {
      injectedUser = { id: 'u_supp', role: 'support', email: 'support@shanutechx.internal' };
      const { status, body } = await requestPath('/test/dev-only');
      assert.equal(status, 403);
      assert.deepEqual(body, { error: 'Dev access required' });
    });

    it('1.4 Blocks customer role escalation attempt with 403', async () => {
      injectedUser = { id: 'u_cust', role: 'customer', email: 'cust@customer.com' };
      const { status, body } = await requestPath('/test/dev-only');
      assert.equal(status, 403);
      assert.deepEqual(body, { error: 'Dev access required' });
    });

    it('1.5 Blocks malformed roles (case variants, substrings, synonyms)', async () => {
      const malformedRoles = [
        'DEV',
        'Dev',
        'deV',
        'developer',
        'DEVELOPER',
        'development',
        'devops',
        'superdev',
        'root',
        'superuser',
        'admin,dev',
        'dev;admin',
        ' dev',
        'dev ',
        'dev\0',
        'dev\n',
        '',
        ' ',
      ];

      for (const badRole of malformedRoles) {
        injectedUser = { id: 'u_mal', role: badRole };
        const { status, body } = await requestPath('/test/dev-only');
        assert.equal(
          status,
          403,
          `Expected 403 for malformed role "${badRole}", but received ${status}`
        );
        assert.deepEqual(
          body,
          { error: 'Dev access required' },
          `Incorrect error body for role "${badRole}"`
        );
      }
    });

    it('1.6 Blocks non-string and object role types (type confusion attack)', async () => {
      const typeConfusionRoles: any[] = [
        ['dev'],
        ['admin', 'dev'],
        { dev: true },
        { toString: () => 'dev' },
        true,
        false,
        1,
        0,
        null,
        undefined,
        NaN,
      ];

      for (const badRole of typeConfusionRoles) {
        injectedUser = { id: 'u_type', role: badRole };
        const { status, body } = await requestPath('/test/dev-only');
        assert.equal(status, 403, `Expected 403 for role type ${typeof badRole}, got ${status}`);
        assert.deepEqual(body, { error: 'Dev access required' });
      }
    });

    it('1.7 Blocks missing, null, or empty user object (unauthenticated / corrupted context)', async () => {
      const invalidUsers = [
        undefined,
        null,
        {},
        { id: 'u_no_role' },
        { id: 'u_null_role', role: null },
        { id: 'u_undef_role', role: undefined },
      ];

      for (const badUser of invalidUsers) {
        injectedUser = badUser;
        const { status, body } = await requestPath('/test/dev-only');
        assert.equal(status, 403);
        assert.deepEqual(body, { error: 'Dev access required' });
      }
    });

    it('1.8 Direct function invocation harness: verifies next() is never called on unauthorized roles', () => {
      const mockRes = () => {
        const res: any = {};
        res.statusCode = 200;
        res.status = (code: number) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data: any) => {
          res.sentJson = data;
          return res;
        };
        return res;
      };

      const invalidRoles = ['admin', 'support', 'customer', 'developer', '', null, undefined];
      for (const r of invalidRoles) {
        const req: any = { user: { role: r } };
        const res = mockRes();
        let nextCalled = false;

        requireDev(req, res, () => {
          nextCalled = true;
        });

        assert.equal(nextCalled, false, `next() was improperly called for role "${r}"`);
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.sentJson, { error: 'Dev access required' });
      }

      // Valid dev must call next() and not modify status
      const validReq: any = { user: { role: 'dev' } };
      const validRes = mockRes();
      let validNextCalled = false;

      requireDev(validReq, validRes, () => {
        validNextCalled = true;
      });

      assert.equal(validNextCalled, true);
      assert.equal(validRes.statusCode, 200);
      assert.equal(validRes.sentJson, undefined);
    });
  });

  // =========================================================================
  // SECTION 2: Adversarial Stress-Testing of Mailbox ACL (`canAccessMailbox`)
  // =========================================================================
  describe('2. Adversarial Challenge on Mailbox ACL (`canAccessMailbox`)', () => {
    const victimAccount = {
      id: 'acc_victim_001',
      userId: 'user_alice_victim',
      allowedAdminIds: ['admin_legacy_bob'],
      mailboxAcl: [
        {
          userId: 'admin_read_only',
          userEmail: 'readonly@corp.com',
          role: 'admin' as const,
          permissions: ['read'] as MailboxPermission[],
          grantedAt: '2026-10-28T00:00:00.000Z',
          grantedBy: 'dev_charlie',
        },
        {
          userId: 'support_write_staff',
          userEmail: 'support@corp.com',
          role: 'support' as const,
          permissions: ['read', 'write'] as MailboxPermission[],
          grantedAt: '2026-10-28T00:00:00.000Z',
          grantedBy: 'dev_charlie',
        },
      ],
    };

    it('2.1 Admin with only "read" permission attempting privilege escalation to "write" or "manage"', () => {
      // Must be allowed for read
      const readRes = canAccessMailbox(victimAccount, 'admin_read_only', 'admin', 'read');
      assert.equal(readRes.allowed, true);
      assert.deepEqual(readRes.permissions, ['read']);

      // Escalation to write must fail
      const writeRes = canAccessMailbox(victimAccount, 'admin_read_only', 'admin', 'write');
      assert.equal(writeRes.allowed, false);
      assert.ok(writeRes.reason?.includes('Forbidden'));
      assert.ok(writeRes.reason?.includes('Sending / Write permission is required'));

      // Escalation to manage must fail
      const manageRes = canAccessMailbox(victimAccount, 'admin_read_only', 'admin', 'manage');
      assert.equal(manageRes.allowed, false);
      assert.ok(manageRes.reason?.includes('Forbidden'));
      assert.ok(manageRes.reason?.includes('Management permission is required'));
    });

    it('2.2 Unassigned Admin with no ACL entry and not in allowedAdminIds is strictly blocked from all operations', () => {
      const ops: MailboxPermission[] = ['read', 'write', 'manage'];
      for (const op of ops) {
        const res = canAccessMailbox(victimAccount, 'admin_stranger_unassigned', 'admin', op);
        assert.equal(res.allowed, false, `Unassigned admin was improperly allowed for operation "${op}"`);
        assert.ok(res.reason?.includes('Access denied'));
        assert.deepEqual(res.permissions, []);
      }
    });

    it('2.3 Legacy admin in allowedAdminIds attempting privilege escalation to "manage"', () => {
      // Legacy admin should get 'read' and 'write' for backward compatibility
      const readRes = canAccessMailbox(victimAccount, 'admin_legacy_bob', 'admin', 'read');
      assert.equal(readRes.allowed, true);

      const writeRes = canAccessMailbox(victimAccount, 'admin_legacy_bob', 'admin', 'write');
      assert.equal(writeRes.allowed, true);

      // Legacy admin MUST NEVER receive 'manage' access
      const manageRes = canAccessMailbox(victimAccount, 'admin_legacy_bob', 'admin', 'manage');
      assert.equal(manageRes.allowed, false);
      assert.ok(manageRes.reason?.includes('Forbidden'));
      assert.ok(manageRes.reason?.includes('Management permission is required'));
    });

    it('2.4 Cross-Tenant Isolation: Another customer attempting unauthorized access to victim mailbox', () => {
      const maliciousCustomers = [
        'user_mallory_attacker',
        'user_alice_victim_spoof',
        'user_alice_victim2',
        'user_alice',
        '',
        ' ',
      ];

      for (const attackerId of maliciousCustomers) {
        for (const op of ['read', 'write', 'manage'] as MailboxPermission[]) {
          const res = canAccessMailbox(victimAccount, attackerId, 'customer', op);
          assert.equal(
            res.allowed,
            false,
            `Cross-tenant breach! Attacker "${attackerId}" accessed mailbox for op "${op}"`
          );
        }
      }
    });

    it('2.5 Malformed ACL entries in database do not crash or leak permissions', () => {
      const corruptedAccount = {
        userId: 'owner_1',
        mailboxAcl: [
          null,
          undefined,
          12345,
          'string_instead_of_object',
          { userId: '' }, // empty userId
          { userId: '   ' }, // whitespace userId
          { userId: 9999, permissions: ['manage'] }, // non-string userId
          { userId: 'hacker_all_caps', permissions: ['READ', 'WRITE', 'MANAGE'] }, // invalid casing
          { userId: 'hacker_sudo', permissions: ['root', 'admin', 'sudo', 'exec', 'all'] }, // nonexistent permissions
          { userId: 'hacker_empty_perm', permissions: [] }, // empty array -> defaults safely to ['read']
        ],
      };

      // Corrupted items should be ignored
      const normalized = normalizeMailboxAcl(corruptedAccount.mailboxAcl);
      assert.equal(normalized.length, 3); // hacker_all_caps, hacker_sudo, hacker_empty_perm (all default safely to 'read')

      // Hacker with invalid permissions ['root', 'sudo'] must NOT get write or manage
      const hackerSudoWrite = canAccessMailbox(corruptedAccount, 'hacker_sudo', 'admin', 'write');
      assert.equal(hackerSudoWrite.allowed, false);
      const hackerSudoManage = canAccessMailbox(corruptedAccount, 'hacker_sudo', 'admin', 'manage');
      assert.equal(hackerSudoManage.allowed, false);

      // Hacker with empty array defaulted to 'read' must NOT get write or manage
      const hackerEmptyWrite = canAccessMailbox(corruptedAccount, 'hacker_empty_perm', 'admin', 'write');
      assert.equal(hackerEmptyWrite.allowed, false);
      const hackerEmptyManage = canAccessMailbox(corruptedAccount, 'hacker_empty_perm', 'admin', 'manage');
      assert.equal(hackerEmptyManage.allowed, false);

      // Non-string or empty userId must never be found
      const emptyUserRes = canAccessMailbox(corruptedAccount, '', 'admin', 'read');
      assert.equal(emptyUserRes.allowed, false);
      const whitespaceUserRes = canAccessMailbox(corruptedAccount, '   ', 'admin', 'read');
      assert.equal(whitespaceUserRes.allowed, false);
    });

    it('2.6 Null, undefined, and empty account and user parameters are safely handled', () => {
      const falsyAccounts: any[] = [null, undefined, {}, { userId: null }, { userId: undefined }];
      const falsyUsers: any[] = [null, undefined, '', '   '];

      for (const acc of falsyAccounts) {
        for (const u of falsyUsers) {
          const res = canAccessMailbox(acc, u, 'admin', 'read');
          assert.equal(res.allowed, false);
          assert.deepEqual(res.permissions, []);
        }
      }
    });

    it('2.7 Duplicate ACL entries: first entry precedence prevents malicious overrides', () => {
      const duplicateAclAccount = {
        userId: 'owner_2',
        mailboxAcl: [
          {
            userId: 'target_admin',
            permissions: ['read'],
          },
          {
            userId: 'target_admin',
            permissions: ['read', 'write', 'manage'],
          },
        ],
      };

      // Attempting 'manage' should fail because first entry only granted 'read'
      const manageRes = canAccessMailbox(duplicateAclAccount, 'target_admin', 'admin', 'manage');
      assert.equal(manageRes.allowed, false);

      const writeRes = canAccessMailbox(duplicateAclAccount, 'target_admin', 'admin', 'write');
      assert.equal(writeRes.allowed, false);

      const readRes = canAccessMailbox(duplicateAclAccount, 'target_admin', 'admin', 'read');
      assert.equal(readRes.allowed, true);
    });

    it('2.8 ACL Revocation lifecycle: revoked user access is immediately denied on all operations', () => {
      const initialAccount = {
        userId: 'owner_3',
        mailboxAcl: [
          {
            userId: 'admin_to_revoke',
            userEmail: 'revokeme@corp.com',
            role: 'admin' as const,
            permissions: ['read', 'write'] as MailboxPermission[],
            grantedAt: new Date().toISOString(),
            grantedBy: 'dev_admin',
          },
        ],
        allowedAdminIds: ['admin_to_revoke'],
      };

      // Before revocation: has read and write
      assert.equal(canAccessMailbox(initialAccount, 'admin_to_revoke', 'admin', 'read').allowed, true);
      assert.equal(canAccessMailbox(initialAccount, 'admin_to_revoke', 'admin', 'write').allowed, true);

      // Perform revocation
      const revoked = revokeMailboxAcl(initialAccount.mailboxAcl, 'admin_to_revoke');
      const updatedAccount = {
        ...initialAccount,
        mailboxAcl: revoked.mailboxAcl,
        allowedAdminIds: revoked.allowedAdminIds,
      };

      // After revocation: completely denied on all operations
      assert.equal(canAccessMailbox(updatedAccount, 'admin_to_revoke', 'admin', 'read').allowed, false);
      assert.equal(canAccessMailbox(updatedAccount, 'admin_to_revoke', 'admin', 'write').allowed, false);
      assert.equal(canAccessMailbox(updatedAccount, 'admin_to_revoke', 'admin', 'manage').allowed, false);
      assert.deepEqual(canAccessMailbox(updatedAccount, 'admin_to_revoke', 'admin', 'read').permissions, []);
    });

    it('2.9 Account owner maintains full access on own mailbox regardless of ACL entries', () => {
      // Even if owner is not in mailboxAcl or allowedAdminIds, owner has full access
      const ownerAccount = {
        userId: 'owner_exclusive',
        mailboxAcl: [],
        allowedAdminIds: [],
      };

      for (const op of ['read', 'write', 'manage'] as MailboxPermission[]) {
        const res = canAccessMailbox(ownerAccount, 'owner_exclusive', 'customer', op);
        assert.equal(res.allowed, true);
        assert.deepEqual(new Set(res.permissions), new Set(['read', 'write', 'manage']));
      }
    });

    it('2.10 Dev superuser maintains full access across all mailboxes and operations', () => {
      const lockedAccount = {
        userId: 'locked_owner',
        mailboxAcl: [],
        allowedAdminIds: [],
      };

      for (const op of ['read', 'write', 'manage'] as MailboxPermission[]) {
        const res = canAccessMailbox(lockedAccount, 'dev_superuser_xyz', 'dev', op);
        assert.equal(res.allowed, true);
        assert.deepEqual(new Set(res.permissions), new Set(['read', 'write', 'manage']));
      }
    });

    it('2.11 Non-array allowedAdminIds (string, object, null) does not crash or grant access', () => {
      const malformedLegacyAccounts = [
        { userId: 'owner_leg', allowedAdminIds: 'admin_stranger' as any },
        { userId: 'owner_leg', allowedAdminIds: { 'admin_stranger': true } as any },
        { userId: 'owner_leg', allowedAdminIds: null as any },
        { userId: 'owner_leg', allowedAdminIds: 12345 as any },
      ];

      for (const acc of malformedLegacyAccounts) {
        const res = canAccessMailbox(acc, 'admin_stranger', 'admin', 'read');
        assert.equal(res.allowed, false);
      }
    });

    it('2.12 updateMailboxAcl sanitizes permissions and normalizes safely', () => {
      const updated = updateMailboxAcl([], {
        userId: 'admin_new',
        userEmail: 'new@corp.com',
        role: 'admin',
        permissions: ['manage', 'invalid_perm' as any, 'exec' as any],
        grantedBy: 'dev_root',
      });

      assert.equal(updated.mailboxAcl.length, 1);
      assert.deepEqual(updated.mailboxAcl[0].permissions, ['manage']);
      assert.deepEqual(updated.allowedAdminIds, ['admin_new']);

      // Empty permissions array defaults to ['read']
      const emptyPerms = updateMailboxAcl([], {
        userId: 'admin_empty',
        userEmail: 'empty@corp.com',
        role: 'admin',
        permissions: [],
        grantedBy: 'dev_root',
      });
      assert.deepEqual(emptyPerms.mailboxAcl[0].permissions, ['read']);
    });

    it('2.13 Revoking nonexistent userId is safe and idempotent', () => {
      const initial = [
        {
          userId: 'admin_stable',
          userEmail: 'stable@corp.com',
          role: 'admin' as const,
          permissions: ['read'] as MailboxPermission[],
          grantedAt: new Date().toISOString(),
          grantedBy: 'dev',
        },
      ];

      const res = revokeMailboxAcl(initial, 'ghost_user');
      assert.equal(res.mailboxAcl.length, 1);
      assert.equal(res.mailboxAcl[0].userId, 'admin_stable');
      assert.deepEqual(res.allowedAdminIds, ['admin_stable']);
    });
  });

  // =========================================================================
  // SECTION 3: Concurrency and Race Condition Stress Testing
  // =========================================================================
  describe('3. Concurrency Stress Testing on Guards & ACL', () => {
    it('3.1 Direct middleware invocation under parallel concurrency maintains strict isolation', async () => {
      const roles = ['dev', 'admin', 'support', 'customer', 'DEV', 'developer', '', null];
      const results: { role: any; status: number; ok: boolean }[] = [];

      const promises = Array.from({ length: 50 }).map(async (_, idx) => {
        const testRole = roles[idx % roles.length];
        const req: any = { user: testRole !== null ? { role: testRole } : undefined };
        let status = 200;
        let ok = false;
        const res: any = {
          status: (code: number) => {
            status = code;
            return res;
          },
          json: () => res,
        };

        requireDev(req, res, () => {
          ok = true;
        });

        results.push({ role: testRole, status, ok });
      });

      await Promise.all(promises);

      for (const r of results) {
        if (r.role === 'dev') {
          assert.equal(r.status, 200);
          assert.equal(r.ok, true);
        } else {
          assert.equal(r.status, 403);
          assert.equal(r.ok, false);
        }
      }
    });
  });
});
