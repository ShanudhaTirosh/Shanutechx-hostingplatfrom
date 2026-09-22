import { createDefaultDeps, runDueBackups } from '../lib/deploymentBackup';

/** Runs every few minutes from the worker: executes at most a few due scheduled backups and reaps dead jobs. */
export async function executeBackupSweepJob(): Promise<{ ran: number; failed: number }> {
  const deps = await createDefaultDeps();
  return runDueBackups(deps, 3);
}
