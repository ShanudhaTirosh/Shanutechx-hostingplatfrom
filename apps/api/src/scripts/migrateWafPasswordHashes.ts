/**
 * One-off migration: converts existing (previously inert) URL Password Protection settings from a reversibly
 * encrypted password into the bcrypt hash the node agent's WAF gateway actually checks.
 *
 * Before this feature was made to work, `deploymentProtectionPassword` was saved but never enforced anywhere, so
 * every deployment with a value there currently allows public access despite a customer having set a password.
 * This script decrypts each one (using the same key it was encrypted with) and writes the equivalent bcrypt hash to
 * `deploymentProtectionPasswordHash`, so existing settings start being enforced with the SAME password the customer
 * already chose, rather than silently discarding it or leaving it permanently non-functional.
 *
 * Deployments this touches will start requiring their existing password on their next redeploy (the WAF gateway is
 * attached to a deployment's Traefik router at container-creation time). Run this BEFORE announcing the feature so
 * that redeploy does not come as a surprise -- consider notifying affected customers first.
 *
 *   npx tsx apps/api/src/scripts/migrateWafPasswordHashes.ts            # dry run: counts only
 *   npx tsx apps/api/src/scripts/migrateWafPasswordHashes.ts --apply    # perform the change
 *
 * Never prints a password or its hash. Safe to re-run: rows that already have a hash are skipped, and a row with an
 * encrypted value that fails to decrypt (wrong/rotated key) is reported, not silently dropped.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { decryptSecret } from '../lib/secretsVault';

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = await prisma.deployment.findMany({
    where: { deploymentProtectionPassword: { not: null }, deploymentProtectionPasswordHash: null },
    select: { id: true, deploymentProtectionPassword: true },
  });

  let migrated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const plaintext = decryptSecret(row.deploymentProtectionPassword!, env.secretsEncryptionKey);
      const hash = await bcrypt.hash(plaintext, 12);
      if (apply) {
        await prisma.deployment.update({ where: { id: row.id }, data: { deploymentProtectionPasswordHash: hash, deploymentProtectionPassword: null } });
      }
      migrated++;
    } catch (err) {
      failed++;
      console.error(`Deployment ${row.id}: could not migrate (${err instanceof Error ? err.message : 'unknown error'}). Left as-is; the password stays unenforced for this one.`);
    }
  }

  console.log(`${apply ? 'Migrated' : 'Would migrate'} ${migrated} deployment(s); ${failed} failed and were left untouched.`);
  if (!apply && migrated > 0) console.log('Dry run: nothing was changed. Re-run with --apply to perform the change.');
}

main()
  .catch((err) => {
    console.error('migrateWafPasswordHashes failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
