const fs = require('fs/promises');
const yaml = require('js-yaml');
const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const CONFIG_FILE = process.env.LIVEKIT_CONFIG_FILE || '/etc/livekit/livekit.yaml';
const LIVEKIT_CONTAINER_NAME = process.env.LIVEKIT_CONTAINER_NAME || 'livekit-server';

const DEFAULT_CONFIG = {
  port: 7880,
  rtc: { tcp_port: 7881, port_range_start: 50000, port_range_end: 60000 },
  keys: {},
};

/**
 * Adds a new key/secret pair to LiveKit's config and restarts the
 * container. Self-hosted LiveKit reads its entire key list once at startup
 * from this file (mounted into the container) — there's no admin API to add
 * a key to a running instance, so a restart is the only way to pick up a
 * change. This briefly drops any in-progress LiveKit sessions on this node;
 * acceptable for how infrequently new projects get provisioned.
 *
 * This reads, modifies, and rewrites the actual YAML structure (`keys:` is
 * a map at the top level of LiveKit's config) rather than blindly appending
 * a line — a naive append would land outside the `keys:` block and produce
 * a config LiveKit can't parse.
 */
let lockPromise = Promise.resolve();

async function addKey(apiKey, apiSecret) {
  return (lockPromise = lockPromise.then(async () => {
    let config;
    try {
      const existing = await fs.readFile(CONFIG_FILE, 'utf-8');
      config = yaml.load(existing) || {};
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      config = { ...DEFAULT_CONFIG };
    }

    config.keys = config.keys || {};
    config.keys[apiKey] = apiSecret;

    await fs.writeFile(CONFIG_FILE, yaml.dump(config), 'utf-8');

    const container = docker.getContainer(LIVEKIT_CONTAINER_NAME);
    await container.restart().catch((err) => {
      console.warn('[node-agent:livekit] Container restart error after addKey:', err.message || err);
    });
  }));
}

async function removeKey(apiKey) {
  return (lockPromise = lockPromise.then(async () => {
    try {
      const existing = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = yaml.load(existing) || {};
      if (config.keys && config.keys[apiKey]) {
        delete config.keys[apiKey];
        await fs.writeFile(CONFIG_FILE, yaml.dump(config), 'utf-8');
        const container = docker.getContainer(LIVEKIT_CONTAINER_NAME);
        await container.restart().catch((err) => {
          console.warn('[node-agent:livekit] Container restart error after removeKey:', err.message || err);
        });
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }));
}

module.exports = { addKey, removeKey, CONFIG_FILE };
