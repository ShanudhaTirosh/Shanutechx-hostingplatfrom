const fs = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');

const DYNAMIC_DIR = process.env.TRAEFIK_DYNAMIC_DIR || '/etc/traefik/dynamic';

function configPath(deploymentId, domain) {
  // One file per (deployment, domain) pair — a deployment could in theory
  // have more than one custom domain attached over time.
  const safeDomain = domain.replace(/[^a-z0-9.-]/gi, '_');
  return path.join(DYNAMIC_DIR, `custom-${deploymentId}-${safeDomain}.yml`);
}

/**
 * Adds a Traefik file-provider route for a verified custom domain, pointing
 * at the SAME running container as the deployment's auto-assigned
 * subdomain. Deliberately uses the file provider (which Traefik already
 * watches in both control-plane and node-stack docker-compose files via
 * --providers.file.watch=true) rather than recreating the container with
 * new Docker labels: that would mean a restart (downtime) just to attach a
 * domain, when nothing about the running app actually needs to change.
 */
async function addDomainRoute(deploymentId, domain, internalPort, rootDomain) {
  const routerName = `customdomain-${deploymentId}`;
  // Container name follows the same convention runContainer() in docker.js
  // uses, so this can point at it without needing the container ID.
  const containerName = `deploy-${deploymentId}`;
  const targetPort = internalPort && Number(internalPort) > 0 ? Number(internalPort) : 3000;

  const config = {
    http: {
      routers: {
        [routerName]: {
          rule: `Host(\`${domain}\`)`,
          entryPoints: ['websecure'],
          tls: { certResolver: 'le' },
          service: routerName,
        },
      },
      services: {
        [routerName]: {
          loadBalancer: { servers: [{ url: `http://${containerName}:${targetPort}` }] },
        },
      },
    },
  };

  const targetPath = configPath(deploymentId, domain);
  const tmpPath = `${targetPath}.${Date.now()}.tmp`;
  await fs.mkdir(DYNAMIC_DIR, { recursive: true });
  await fs.writeFile(tmpPath, yaml.dump(config), 'utf-8');
  await fs.rename(tmpPath, targetPath);
}

async function removeDomainRoute(deploymentId, domain) {
  try {
    await fs.unlink(configPath(deploymentId, domain));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { addDomainRoute, removeDomainRoute, configPath };
