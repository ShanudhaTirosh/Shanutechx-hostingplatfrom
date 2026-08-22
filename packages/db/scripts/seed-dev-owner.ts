/**
 * One-time seed: grant the platform owner's account role = 'dev'.
 *
 * There must only ever be exactly one 'dev' user on this platform (you).
 * This script enforces that: if another user already holds role='dev', it
 * refuses to run unless you pass --force, in which case it downgrades the
 * existing dev to 'admin' first (so they keep full admin access, just not
 * the dev-only surfaces) before promoting the new UID.
 *
 * There is deliberately NO admin-panel UI to grant the dev role — this
 * script (run directly against the database by whoever controls deploys)
 * is the only path, on purpose.
 *
 * Usage:
 *   cd packages/db
 *   FIREBASE_UID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx npm run seed:dev-owner
 *   # or: npm run seed:dev-owner -- --uid=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * The user row must already exist (i.e. you've signed in at least once
 * through Firebase Auth, which creates the User row via requireAuth's
 * upsert) — this script only flips the role, it does not create accounts.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const uidFlag = process.argv.find((a) => a.startsWith('--uid='));
  const uid = uidFlag ? uidFlag.split('=')[1] : process.env.FIREBASE_UID;
  const force = process.argv.includes('--force');
  return { uid, force };
}

async function main() {
  const { uid, force } = parseArgs();

  if (!uid) {
    console.error('Missing Firebase UID. Pass FIREBASE_UID=... or --uid=... — sign in once first so the User row exists.');
    process.exitCode = 1;
    return;
  }

  const target = await prisma.user.findUnique({ where: { firebaseUid: uid } });
  if (!target) {
    console.error(`No User row found for firebaseUid "${uid}". Sign in to the dashboard once first, then re-run this script.`);
    process.exitCode = 1;
    return;
  }

  const existingDev = await prisma.user.findFirst({ where: { role: 'dev' } });

  if (existingDev && existingDev.id !== target.id) {
    if (!force) {
      console.error(
        `User ${existingDev.email} (${existingDev.id}) already holds the 'dev' role. ` +
          `Only one dev account may exist. Re-run with --force to downgrade them to 'admin' and promote the new UID instead.`
      );
      process.exitCode = 1;
      return;
    }
    await prisma.user.update({ where: { id: existingDev.id }, data: { role: 'admin' } });
    console.log(`Downgraded previous dev account ${existingDev.email} to 'admin'.`);
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data: { role: 'dev' } });
  console.log(`Done. ${updated.email} (${updated.id}) now has role = 'dev'.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
