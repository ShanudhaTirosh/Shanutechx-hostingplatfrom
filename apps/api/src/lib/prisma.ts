// @shanutechx/db exports a plain CommonJS singleton; re-export it with a type
// import so the rest of the API gets full Prisma type-checking.
import type { PrismaClient } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@shanutechx/db') as { prisma: PrismaClient };

export { prisma };
