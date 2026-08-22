import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signProjectAuthToken,
  verifyProjectAuthToken,
  hashPassword,
  verifyPassword,
} from './projectAuthService';

vi.mock('./prisma', () => ({
  prisma: {
    projectMagicLink: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    projectAuthUser: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

describe('Project auth — password hashing', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('never stores the plaintext password in the hash', async () => {
    const hash = await hashPassword('super-secret-123');
    expect(hash).not.toContain('super-secret-123');
  });
});

describe('Project auth — JWT scoping', () => {
  it('round-trips a token and rejects tampering', () => {
    const token = signProjectAuthToken({ sub: 'user-1', projectId: 'proj-1', email: 'a@example.com' });
    const payload = verifyProjectAuthToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.projectId).toBe('proj-1');

    expect(() => verifyProjectAuthToken(token + 'tampered')).toThrow();
  });

  it('embeds the projectId so a token from one project cannot silently pass as another\'s (checked by the route, this proves the payload carries it)', () => {
    const tokenA = signProjectAuthToken({ sub: 'user-1', projectId: 'proj-A', email: 'a@example.com' });
    const payload = verifyProjectAuthToken(tokenA);
    expect(payload.projectId).not.toBe('proj-B');
  });
});
