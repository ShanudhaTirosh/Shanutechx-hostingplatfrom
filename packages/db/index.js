const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across hot-reloads in dev.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__shanutechxPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__shanutechxPrisma = prisma;
}

module.exports = { prisma };
