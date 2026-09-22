/**
 * Decides how a deployment's container is reachable: Traefik labels, host port bindings and whether it joins the
 * public proxy network. Pure (no Docker calls) so it can be tested, and so the mode names the API sends are
 * interpreted in exactly one place.
 *
 * Exposure modes:
 *   ssl_with_proxy  Traefik + Let's Encrypt TLS (default)
 *   ssl_direct      Traefik + TLS without the proxy-hardening middlewares
 *   no_ssl          raw host port mapping, bypassing Traefik (game servers, TCP/UDP listeners)
 *   raw_tcp         alias of no_ssl. The API and dashboard use this name for "direct" mode; before this module it was
 *                   not recognised here and silently fell through to Traefik HTTP routing with no host port bound.
 *   internal_only   no public route at all: no Traefik labels, no host port. Before this module it was not recognised
 *                   and the container was still given a public Traefik router.
 */

const BOT_PRESETS = ['nodejs_bot', 'python_bot', 'whatsapp_baileys'];
const HOST_PORT_MODES = new Set(['no_ssl', 'raw_tcp']);

function parsePort(value, what) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid ${what} "${value}": must be a whole number between 1 and 65535`);
  }
  return String(n);
}

function resolveExposure({
  deploymentId,
  internalPort,
  subdomain,
  rootDomain,
  deploymentsRootDomain,
  routingMode = 'proxied',
  exposureMode = 'ssl_with_proxy',
  frameworkPreset = 'auto',
  publishedPort = null,
}) {
  const labels = {};
  const portBindings = {};
  let joinPublicNetwork = false;

  const isBotProcess = BOT_PRESETS.includes(frameworkPreset);
  const effectiveMode = exposureMode || (routingMode === 'direct' ? 'no_ssl' : 'ssl_with_proxy');

  if (effectiveMode === 'internal_only') {
    return { effectiveMode, labels, portBindings, joinPublicNetwork };
  }

  if (HOST_PORT_MODES.has(effectiveMode) || routingMode === 'direct' || (isBotProcess && publishedPort)) {
    // Raw host port mapping: bypasses Traefik entirely (game servers, bots on a direct port, TCP/UDP listeners).
    if (publishedPort || internalPort) {
      const hostPort = parsePort(publishedPort || internalPort, publishedPort ? 'published port' : 'port');
      const containerPort = parsePort(internalPort || publishedPort, 'internal port');
      portBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
      portBindings[`${containerPort}/udp`] = [{ HostPort: hostPort }];
    }
  } else if (!isBotProcess || subdomain) {
    // Proxied routing via Traefik (web services, or bots with an HTTP management interface).
    const activeSubdomain = subdomain || `app-${deploymentId.slice(0, 8)}`;
    const routerName = `deploy-${deploymentId}`;
    const targetPort = internalPort && Number(internalPort) > 0 ? Number(internalPort) : 3000;
    const effectiveZone = deploymentsRootDomain || rootDomain || process.env.DEPLOYMENTS_ROOT_DOMAIN || process.env.ROOT_DOMAIN || 'shanutechx.com';

    labels['traefik.enable'] = 'true';
    labels[`traefik.http.routers.${routerName}.rule`] = `Host(\`${activeSubdomain}.${effectiveZone}\`)`;
    labels[`traefik.http.services.${routerName}.loadbalancer.server.port`] = String(targetPort);

    if (effectiveMode === 'ssl_direct') {
      labels[`traefik.http.routers.${routerName}.entrypoints`] = 'websecure';
      labels[`traefik.http.routers.${routerName}.tls`] = 'true';
      labels[`traefik.http.routers.${routerName}.middlewares`] = 'gzip-compress@file';
    } else {
      // Default: ssl_with_proxy, proxied + TLS Let's Encrypt
      labels[`traefik.http.routers.${routerName}.entrypoints`] = 'websecure';
      labels[`traefik.http.routers.${routerName}.tls.certresolver`] = 'le';
      labels[`traefik.http.routers.${routerName}.middlewares`] = 'security-headers@file,rate-limit@file,gzip-compress@file';
    }
    joinPublicNetwork = true;
  }

  return { effectiveMode, labels, portBindings, joinPublicNetwork };
}

module.exports = { resolveExposure, HOST_PORT_MODES, BOT_PRESETS };
