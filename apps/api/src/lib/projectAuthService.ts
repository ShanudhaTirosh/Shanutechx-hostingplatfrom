import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma';
import { env } from '../env';

/**
 * Supabase/Firebase-Auth-style authentication, scoped per dev Project.
 * Each Project gets its own isolated set of end users (ProjectAuthUser) —
 * a user in one project has no relationship to a user of the same email in
 * another project, or to the platform's own User/staff accounts.
 */

export interface ProjectAuthTokenPayload {
  sub: string; // ProjectAuthUser.id
  projectId: string;
  email: string;
}

export function signProjectAuthToken(payload: ProjectAuthTokenPayload): string {
  return jwt.sign(payload, env.projectAuthJwtSecret, { expiresIn: '7d' });
}

export function verifyProjectAuthToken(token: string): ProjectAuthTokenPayload {
  return jwt.verify(token, env.projectAuthJwtSecret, { algorithms: ['HS256'] }) as ProjectAuthTokenPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generates a magic-link token, stores only its hash, returns the raw token for the emailed URL. */
export async function createMagicLink(projectId: string, email: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.projectMagicLink.create({
    data: {
      projectId,
      email: email.toLowerCase(),
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
  });

  return rawToken;
}

/** Verifies and consumes (single-use) a magic-link token, returning the email it was issued for. */
export async function consumeMagicLink(projectId: string, rawToken: string): Promise<string | null> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const link = await prisma.projectMagicLink.findUnique({ where: { tokenHash } });

  if (!link || link.projectId !== projectId || link.usedAt || link.expiresAt < new Date()) {
    return null;
  }

  const updateResult = await prisma.projectMagicLink.updateMany({
    where: { id: link.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (updateResult.count === 0) {
    return null;
  }

  return link.email;
}

/** Finds or creates a ProjectAuthUser for the given project+email, marking them email-verified (used after magic link / OAuth, both of which prove email ownership). */
export async function findOrCreateVerifiedUser(projectId: string, email: string) {
  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.projectAuthUser.findUnique({
    where: { projectId_email: { projectId, email: normalizedEmail } },
  });
  if (existing) {
    if (!existing.emailVerified) {
      return prisma.projectAuthUser.update({ where: { id: existing.id }, data: { emailVerified: true, lastLoginAt: new Date() } });
    }
    return prisma.projectAuthUser.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
  }
  return prisma.projectAuthUser.create({
    data: { projectId, email: normalizedEmail, emailVerified: true, lastLoginAt: new Date() },
  });
}
