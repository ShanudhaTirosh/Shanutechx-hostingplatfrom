import { prisma } from '../index';

async function main() {
  const firebaseUid = 'mrTThasIt7RXPk7QgbplnDK0FkR2';
  const email = 'tiroshbrot123@gmail.com';

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

  console.log('✅ Updated user accounts:', updated);
  console.log('👤 Active User Details:', users);
}

main()
  .catch((err) => {
    console.error('Error setting dev user:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
