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
  // Needed only to attach the WAF forwardAuth middleware (see waf.js / the /agent/waf-check route in index.js).
  // Left undefined in tests that don't care about WAF; the label is simply omitted then.
  agentPort = undefined,
  agentSecret = undefined,
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

    // Every proxied request is checked against this deployment's WAF rules before Traefik forwards it. The check
    // itself is a fast local call (in-memory rule lookup on the same host) and returns instantly when there are no
    // rules, so this is attached unconditionally rather than only when rules exist -- that way turning a rule on
    // takes effect immediately, with no redeploy required, instead of only protecting deployments created after the
    // first rule was added. WAF only applies here: direct_port/internal_only bypass Traefik entirely, so there is no
    // HTTP request for a forwardAuth check to intercept.
    if (agentPort && agentSecret) {
      const authHost = process.env.AGENT_FORWARD_AUTH_HOST || (process.env.AGENT_RUNNING_IN_DOCKER ? 'node-agent' : '127.0.0.1');
      labels[`traefik.http.middlewares.${routerName}-waf.forwardauth.address`] = `http://${authHost}:${agentPort}/agent/waf-check/${deploymentId}?secret=${encodeURIComponent(agentSecret)}`;
      labels[`traefik.http.middlewares.${routerName}-waf.forwardauth.trustForwardHeader`] = 'true';
      const existing = labels[`traefik.http.routers.${routerName}.middlewares`];
      labels[`traefik.http.routers.${routerName}.middlewares`] = existing ? `${routerName}-waf@docker,${existing}` : `${routerName}-waf@docker`;
    }
  }

  return { effectiveMode, labels, portBindings, joinPublicNetwork };
}

module.exports = { resolveExposure, HOST_PORT_MODES, BOT_PRESETS };
