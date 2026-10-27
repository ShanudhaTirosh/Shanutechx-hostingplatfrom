import { prisma } from '../index';

async function main() {
  // Read credentials from environment variables to avoid committing personal
  // identifiers to version control. Set DEV_FIREBASE_UID and DEV_EMAIL before
  // running: DEV_FIREBASE_UID=xxx DEV_EMAIL=you@example.com npx tsx set-dev-user.ts
  const firebaseUid = process.env.DEV_FIREBASE_UID;
  const email = process.env.DEV_EMAIL;

  if (!firebaseUid && !email) {
    console.error('[ERROR] Must supply DEV_FIREBASE_UID and/or DEV_EMAIL as environment variables.');
    process.exit(1);
  }

  const updated = await prisma.user.updateMany({
    where: {
      OR: [{ firebaseUid }, { email }],
    },
    data: { role: 'dev' },
  });

  const users = await prisma.user.findMany({
    where: {
      OR: [{ firebaseUid }, { email }],
    },
  });

  console.log('[OK] Updated user accounts:', updated);
  console.log('[INFO] Active User Details:', users);
}

main()
  .catch((err) => {
    console.error('Error setting dev user:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
