# Git credentials for private repositories

## What changed and why

Previously the access token was pasted into `Deployment.repoUrl` (`https://x-access-token:TOKEN@github.com/...`) and stored
that way. Consequences: plaintext tokens in the database; GitHub App tokens expire in about an hour, so every later
redeploy, webhook rebuild or failover used a dead token; and on the node the token was written to the workspace's
`.git/config` and could appear in error messages and logs.

Now:

* `repoUrl` is stored **without credentials**. A connected account is recorded as `gitAccountId` + `gitProvider`; a pasted
  token is stored AES-GCM-encrypted in `githubTokenEncrypted` (the existing column).
* The credential is resolved **fresh at build time** in one place, `buildAndRun` (`apps/api/src/lib/gitAuth.ts`), which every
  create / redeploy / webhook / failover / preview build passes through. Account -> a new short-lived scoped token is
  minted; otherwise the saved token is decrypted.
* Previews inherit their parent deployment's access (only when the same user owns both).
* On the node (`services/node-agent/src/repo.js`) the credential is passed to git through environment variables as an
  `Authorization` header. It is not in argv, not in `.git/config`, and error text is redacted. Remotes are re-pointed at the
  clean URL on every deploy, which also scrubs tokens written by older agent versions.
* The platform-wide shadow-backup token is no longer written into customer workspaces' `.git/config` either.

## Behaviour changes to be aware of

1. **A failed `git fetch` now fails the deploy.** Before, fetch/reset errors were swallowed and the deploy silently rebuilt the
   previous code and reported success. Now the deploy stops with "Could not fetch the latest code ... so the deploy was
   stopped instead of rebuilding old code." This is deliberate, but it will surface problems (expired token, deleted branch)
   that used to be invisible.
2. Saving a token via `PATCH /deployments/:id/git-settings` **unlinks a connected account** on that deployment (the account
   otherwise takes precedence and the new token would be ignored). Same for pasting a credentialed URL into `PATCH .../config`.
3. Creating a deployment with a connected account now verifies a token can be minted and returns a clear 400 if the
   connection is broken, instead of failing later.

## Requirements

* Node agents need **git >= 2.31** (environment-based config, `GIT_CONFIG_COUNT`). Older git ignores it and private clones
  fail with an authentication error. Check with `git --version` on each node.

## Migrating existing rows

Rows created before this change still hold plaintext tokens. Run once, after deploying, from the repo root with the API's
environment loaded:

```
npx tsx apps/api/src/scripts/scrubRepoTokens.ts            # dry run, prints counts only
npx tsx apps/api/src/scripts/scrubRepoTokens.ts --apply
```

It moves each embedded token into `githubTokenEncrypted` (unless the row already has a saved token or account link), stores the
URL clean, never prints a token, and is safe to re-run. Old GitHub App tokens are already expired; the script cannot revive
them. Those deployments need to be redeployed once with a connected account to get a working credential again.

## Not verified

* The migration script and the create/config/git-settings route changes are typechecked but were not run against a real
  database (the Prisma engine could not be downloaded in the environment they were written in).
* Whether the Railpack build copies `.git` into the image was not checked. The fix removes the token from `.git/config`
  regardless, but the "is `.git` in the image?" question is worth answering separately.
