/**
 * Callers of buildAndRun (redeploy, webhook rebuild, failover, previews) mostly do not pass publishedPort, and several
 * do not pass exposureMode either. The node agent then falls back to `publishedPort || internalPort` for the host
 * port and to proxied routing for the mode, so a rebuild silently moved a direct-port deployment onto a different
 * host port (or back to HTTP routing). buildAndRun fills whatever the caller left out from the deployment record.
 */

export interface StoredExposure {
  exposureMode: string | null;
  publishedPort: number | null;
}

export interface ExposureDeps {
  load(deploymentId: string): Promise<StoredExposure | null>;
}

export async function resolveExposureForBuild(
  deploymentId: string,
  given: { exposureMode?: string; publishedPort?: number },
  deps: ExposureDeps = defaultDeps
): Promise<{ exposureMode?: string; publishedPort?: number }> {
  if (given.exposureMode !== undefined && given.publishedPort !== undefined) return given;
  let stored: StoredExposure | null = null;
  try {
    stored = await deps.load(deploymentId);
  } catch {
    return given; // never block a build on a lookup failure; the agent has its own defaults
  }
  if (!stored) return given;
  return {
    exposureMode: given.exposureMode ?? stored.exposureMode ?? undefined,
    publishedPort: given.publishedPort ?? stored.publishedPort ?? undefined,
  };
}

const defaultDeps: ExposureDeps = {
  async load(deploymentId) {
    const { prisma } = await import('./prisma');
    const row = await prisma.deployment.findUnique({ where: { id: deploymentId }, select: { exposureMode: true, publishedPort: true } });
    return row ? { exposureMode: row.exposureMode ?? null, publishedPort: row.publishedPort ?? null } : null;
  },
};
