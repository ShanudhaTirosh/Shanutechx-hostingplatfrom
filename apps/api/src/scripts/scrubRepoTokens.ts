/**
 * One-off migration: removes plaintext git tokens from Deployment.repoUrl.
 *
 * Before the fix, tokens were stored inside repoUrl ("https://x-access-token:TOKEN@github.com/o/r.git"). This moves
 * each one into the encrypted githubTokenEncrypted column (unless the deployment already has a better credential
 * source: a saved token or a connected account) and stores the URL clean. Behaviour of later builds is unchanged,
 * since the build path now injects the credential from those fields (see lib/gitAuth.ts).
 *
 *   npx tsx apps/api/src/scripts/scrubRepoTokens.ts            # dry run: counts only
 *   npx tsx apps/api/src/scripts/scrubRepoTokens.ts --apply    # perform the change
 *
 * Never prints a token. Safe to re-run: rows that are already clean are skipped.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { encryptSecret } from '../lib/secretsVault';
import { extractEmbeddedToken, stripRepoCredentials } from '../lib/gitAuth';

async function main() {
  const apply = process.argv.includes('--apply');
  // "@" is a cheap pre-filter; extractEmbeddedToken decides (it ignores ssh-style git@host:o/r URLs).
  const rows = await prisma.deployment.findMany({
    where: { repoUrl: { contains: '@' } },
    select: { id: true, repoUrl: true, githubTokenEncrypted: true, gitAccountId: true },
  });

  let scrubbed = 0;
  let tokenMoved = 0;
  let skipped = 0;
  for (const row of rows) {
    const token = row.repoUrl ? extractEmbeddedToken(row.repoUrl) : null;
    if (!row.repoUrl || !token) {
      skipped++;
      continue;
    }
    const data: { repoUrl: string; githubTokenEncrypted?: string } = { repoUrl: stripRepoCredentials(row.repoUrl) };
    if (!row.githubTokenEncrypted && !row.gitAccountId) {
      data.githubTokenEncrypted = encryptSecret(token, env.secretsEncryptionKey);
      tokenMoved++;
    }
    if (apply) await prisma.deployment.update({ where: { id: row.id }, data });
    scrubbed++;
  }

  console.log(
    `${apply ? 'Scrubbed' : 'Would scrub'} ${scrubbed} deployment(s) (${tokenMoved} token(s) moved to encrypted storage); ${skipped} row(s) had no embedded credential.`
  );
  if (!apply && scrubbed > 0) console.log('Dry run: nothing was changed. Re-run with --apply to perform the change.');
}

main()
  .catch((err) => {
    console.error('scrubRepoTokens failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
