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

export type ExposureModeType = 'ssl_with_proxy' | 'ssl_direct' | 'no_ssl' | 'internal_only';

export const WEB_HTTP_PORTS = new Set([
  80, 443, 3000, 3001, 3002, 4000, 5000, 5173, 5678, 7880, 8000, 8080, 8081, 8443, 8888, 9000, 10000,
]);

export const RAW_TCP_UDP_PORTS = new Set([
  25565, 27015, 7777, 53, 1883,
]);

/**
 * Automatically detects the ideal exposure mode for a workload based on:
 * - user explicit input (if provided and != 'auto')
 * - internal port number
 * - docker image or compose YAML content
 */
export function autoDetectExposureMode(options: {
  explicitMode?: string | null;
  port?: number | null;
  image?: string | null;
  composeYaml?: string | null;
}): ExposureModeType {
  const { explicitMode, port, image, composeYaml } = options;

  if (explicitMode && explicitMode !== 'auto') {
    if (explicitMode === 'raw_tcp') return 'no_ssl';
    if (['ssl_with_proxy', 'ssl_direct', 'no_ssl', 'internal_only'].includes(explicitMode)) {
      return explicitMode as ExposureModeType;
    }
  }

  // 1. Check Compose YAML hints
  if (composeYaml) {
    if (/traefik\.enable\s*=\s*true/i.test(composeYaml) || /entrypoints\s*=\s*websecure/i.test(composeYaml)) {
      return 'ssl_with_proxy';
    }
    if (/udp/i.test(composeYaml) && !/websecure|traefik\.enable/i.test(composeYaml) && !/7880|80|443|3000|8080/i.test(composeYaml)) {
      return 'no_ssl';
    }
  }

  // 2. Check Port hints
  if (port !== undefined && port !== null) {
    const numPort = Number(port);
    if (RAW_TCP_UDP_PORTS.has(numPort)) {
      return 'no_ssl';
    }
    if (WEB_HTTP_PORTS.has(numPort) || (numPort >= 3000 && numPort <= 9999)) {
      return 'ssl_with_proxy';
    }
    if (numPort <= 0) {
      return 'internal_only';
    }
  }

  // 3. Check Image hints
  if (image) {
    const lowerImage = image.toLowerCase();
    if (lowerImage.includes('minecraft') || lowerImage.includes('csgo') || lowerImage.includes('valheim')) {
      return 'no_ssl';
    }
    if (lowerImage.includes('bot') || lowerImage.includes('worker') || lowerImage.includes('agent')) {
      if (!port || port <= 0) return 'internal_only';
    }
  }

  // Default for web hosting and app catalog platforms is SSL with Traefik proxy
  return 'ssl_with_proxy';
}
