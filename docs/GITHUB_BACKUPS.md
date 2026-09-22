# GitHub-backed deployment backups

Backs up a deployment's files to a **private GitHub repository**, on demand or on a schedule, and restores them from the
dashboard/API. This is separate from the platform-database backup to R2 (`routes/backup.ts`) and from the older
"shadow backup" that force-pushes a workspace as commits.

> **Status of verification.** The GitHub client was tested against a local mock of the GitHub REST API, not against
> github.com, and nothing was run against a real node with Docker. Before relying on this in production, run one real
> backup and one real restore end-to-end (see [First-run checklist](#first-run-checklist)).

## What is and is not backed up

| Backed up | Not backed up |
|---|---|
| The deployment's workspace files on its node (excluding `node_modules`, `.git`, `.next`, `cache`) | Managed databases (they have their own backup path) |
| Every named volume attached to the deployment | Environment variables and secrets (kept encrypted in the platform DB) |
| | Docker images and running container state |

Symlinks are never followed when archiving. On restore, a symlink whose target is absolute or points outside the restored
directory is **skipped and reported** (node-tar cannot restore absolute targets faithfully), not silently corrupted.

## How it is stored

One **GitHub Release per backup**, in a single private repo:

* tag `backup-<deploymentId>-<UTC timestamp>`
* one asset per component (`workspace.tar.gz`, `volume-<name>.tar.gz`) plus `manifest.json` (self-describing, so a backup is
  still understandable if the platform database is lost)
* created as a **draft**, published only after every asset uploaded, so a half-finished backup never looks complete; a failed
  backup deletes its draft.

Releases are used instead of commits because GitHub caps a git blob at 100 MB but a release asset at 2 GiB. The per-component
limit is `BACKUP_MAX_SIZE_MB` (default 1500, hard-capped at 1900).

## Setup

Environment variables (API and worker):

| Variable | Meaning |
|---|---|
| `BACKUP_GITHUB_TOKEN` | Token used for all backup calls. **If unset, the API falls back to `GITHUB_TOKEN`**; set it explicitly so backups never run on a token meant for something else. |
| `BACKUP_GITHUB_ORG` | Owner of the backup repo (default `shanutechx-deploy-backups`). |
| `BACKUP_GITHUB_REPO` | Repo name (default `deployment-backups`), or `owner/name` to override the owner. |
| `BACKUP_MAX_SIZE_MB` | Max size of one component archive, 1-1900 (default 1500). |

**Token permissions**

* Recommended: create the private repo yourself, then use a *fine-grained* token limited to that one repository with
  **Contents: Read and write** (Metadata: Read-only is added automatically). This is all the platform needs to create, upload,
  publish, read and delete releases.
* If the repo does not exist, the platform tries to create it (private). Creating repositories needs broader rights (a classic
  token with the `repo` scope, or organisation permission to create repos), so pre-creating it is the safer route.
* The platform **refuses to use a public repository** and checks that the token can push, with a clear error for each case.

Check the setup any time (admin/dev only; never returns the token): `GET /api/admin/backups/github-status`.

**Node agents must be updated** to the version that includes `/agent/backups/*`. The API probes for it and reports "this node
is running an older agent" instead of failing obscurely.

## Using it

| Action | Endpoint |
|---|---|
| List backups, schedule, and whether backups are configured | `GET /api/deployments/:id/backups` |
| Back up now (returns 202; poll the backup) | `POST /api/deployments/:id/backups` |
| Poll one backup / restore progress | `GET /api/deployments/:id/backups/:backupId` |
| Restore (202) | `POST /api/deployments/:id/backups/:backupId/restore` |
| Delete a backup and its GitHub release | `DELETE /api/deployments/:id/backups/:backupId` |
| Set schedule and retention | `PUT /api/deployments/:id/backup-policy` |

Backups and restores run in the background (they can take minutes, longer than proxy limits); clients poll.
Manual backups have a 60-second cooldown per deployment. Team members need write permission on the deployment for anything
that changes state.

### Schedule and retention

* Interval 1-168 hours, retention 1-30. The worker sweeps every 5 minutes and runs at most 3 due backups per sweep.
* Retention applies to **scheduled** backups only. **Manual backups are never auto-deleted.** The latest 3 pre-restore
  snapshots and the latest 5 failed records are kept.
* Failures back off (1h, 2h, 4h, ... never longer than the interval). After **5 consecutive failures the schedule disables
  itself** and writes an audit entry, so a broken token does not retry forever.
* A job "in progress" for over 2 hours (API restarted mid-job) is marked failed and stops blocking the deployment.

### Restore

1. The request must include `confirm` equal to the deployment's subdomain (or id if it has none). This is enforced on the
   server, not only in the UI.
2. Unless `skipSafetyBackup` is set, a **safety backup of the current state is taken first**; if that fails the restore is
   cancelled with nothing changed. ("Nothing to back up", e.g. a workspace already purged, is tolerated: that is the
   disaster-recovery case.)
3. The app is stopped, each component is streamed GitHub -> API -> node, and the node **verifies the recorded SHA-256 before
   changing anything**. Files are extracted into a staging directory and swapped in atomically, with rollback on failure.
4. The app is restarted if it was running, **even when the restore failed part-way**. A partial failure names which
   components were already restored and points at the safety backup.
5. Restoring workspace files does not rebuild the image: **redeploy afterwards** (the result says so).

Restoring a subset is supported with `components: ["workspace", "volume:data"]`.

### Deleting a deployment deletes its backups

Deleting a deployment is a soft delete, and nothing can restore a deleted deployment, so its backups (customer data) are
purged rather than kept: right after the delete, and again by the 5-minute sweep for anything that failed (for example a
GitHub outage) or that was still running when the deployment was deleted. A record is only removed once GitHub confirms the
release is gone, so a failed purge is retried, not forgotten. This is immediate, with no grace period; if you want one
(for example 7 days), change `purgeDeletedDeploymentBackups` to skip rows newer than that.

### Dashboard

The deployment page has a **Backups** tab: list with live progress, Back up now, schedule, restore (choose components, type the
deployment name to confirm, optional skip of the safety copy) and delete. It polls every 3 seconds only while something is
running. Restore and delete are disabled while a backup or restore is running.

## Security notes

* The GitHub token exists only in the API/worker. Nodes never see it; they only produce and consume archives.
* Restore archives are treated as hostile: `..` and absolute paths, device nodes, and writes through symlinks are rejected, and
  a size ceiling is enforced while streaming.
* When downloading from GitHub, the signed redirect target is fetched **without** the Authorization header.
* API responses never include GitHub asset ids, release ids or checksums.
* **All customers' backups live in one repo under one token.** Anyone with that token can read every customer's files. Use a
  dedicated GitHub account/org, keep the repo private, scope the token to that repo only, and rotate it if it may have leaked.
* **Backups are not encrypted client-side.** They are protected by GitHub's access control and encryption at rest only. App
  files and volumes can contain secrets even though platform env vars are excluded. If that matters to your customers, add
  encryption before upload.

## Known gaps

* An upload that fails part-way is not retried within the same run; the draft is deleted and the next scheduled run tries again.
* Two backups starting in the same instant could both pass the "already running" check (each is still a valid backup).
* The dashboard tab has not been opened in a real browser. Its behaviour (confirmation gating, what is sent to the API,
  polling) was tested in jsdom against a mocked API, with the shared UI kit stubbed.

## First-run checklist

1. Create the private repo; create the token with Contents: Read and write on that repo only; set `BACKUP_GITHUB_*`.
2. `GET /api/admin/backups/github-status` shows `ok: true`.
3. Update the node agents; run a manual backup on a small test deployment; confirm a published release with 2+ assets appears.
4. Restore it (typing the deployment name), redeploy, and confirm the app works.
5. Enable a schedule on the test deployment and confirm the next sweep runs it.

## Code map

* `apps/api/src/lib/githubBackup.ts`: GitHub Releases client (retry, typed errors, no token in messages)
* `apps/api/src/lib/deploymentBackup.ts`: orchestration, retention, policy, scheduler logic
* `apps/api/src/routes/deploymentBackups.ts`: HTTP API; `apps/api/src/jobs/backup-sweep.ts` + `worker.ts`: scheduling
* `services/node-agent/src/backup.js`: archive create/verify/restore on the node (`/agent/backups/*`)
* Tests: `tests/unit/{githubBackup,deploymentBackup,nodeAgentBackup,nodeAgentBackupHttp}.test.ts`
