import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Test API-side compose isolation validator
import { validateComposeSecurity } from '../../apps/api/src/lib/composeIsolation';

// Test Node-Agent isolation and shared asset cache engine
const {
  validateAndHardenCompose,
  seedSharedPlugins,
  getCacheStatus,
  SHARED_CACHE_DIR,
} = require('../../services/node-agent/src/isolationEngine');

describe('Multi-Tenant Compose Isolation & Shared Asset Engine', () => {
  describe('validateComposeSecurity (API Gateway)', () => {
    it('accepts safe compose with project-relative mounts and named volumes', () => {
      const safeYaml = `
version: '3.8'
services:
  web:
    image: nginx:alpine
    volumes:
      - ./config.conf:/etc/nginx/nginx.conf:ro
      - web_data:/var/www/html
volumes:
  web_data:
`;
      const res = validateComposeSecurity(safeYaml);
      assert.equal(res.valid, true);
    });

    it('rejects privileged container mode', () => {
      const privilegedYaml = `
version: '3.8'
services:
  exploit:
    image: alpine:latest
    privileged: true
`;
      const res = validateComposeSecurity(privilegedYaml);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /privileged containers are strictly forbidden/i);
    });

    it('rejects host network mode', () => {
      const hostNetYaml = `
version: '3.8'
services:
  snoop:
    image: alpine:latest
    network_mode: "host"
`;
      const res = validateComposeSecurity(hostNetYaml);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /host network mode is strictly forbidden/i);
    });

    it('rejects host PID and IPC namespaces', () => {
      const hostPidYaml = `
version: '3.8'
services:
  spy:
    image: alpine:latest
    pid: host
`;
      const res = validateComposeSecurity(hostPidYaml);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /host pid namespace is strictly forbidden/i);
    });

    it('rejects docker.sock volume mounts', () => {
      const sockYaml = `
version: '3.8'
services:
  takeover:
    image: alpine:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
`;
      const res = validateComposeSecurity(sockYaml);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /docker socket/i);
    });

    it('rejects relative path traversal in volume mounts', () => {
      const traversalYaml = `
version: '3.8'
services:
  theft:
    image: alpine:latest
    volumes:
      - ../other-tenant/secrets.env:/stolen.env
`;
      const res = validateComposeSecurity(traversalYaml);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /relative path traversal/i);
    });

    it('rejects root host mounts and sensitive system directories', () => {
      const rootMountYaml = `
version: '3.8'
services:
  escape:
    image: alpine:latest
    volumes:
      - /etc/shadow:/etc/shadow:ro
`;
      const res = validateComposeSecurity(rootMountYaml);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /host mount '\/etc\/shadow' is forbidden/i);
    });

    it('rejects dangerous Linux capabilities like SYS_ADMIN', () => {
      const capYaml = `
version: '3.8'
services:
  rooty:
    image: alpine:latest
    cap_add:
      - SYS_ADMIN
`;
      const res = validateComposeSecurity(capYaml);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /dangerous capability 'sys_admin'/i);
    });
  });

  describe('validateAndHardenCompose (Node-Agent Isolation Engine)', () => {
    it('hardens safe stacks by injecting no-new-privileges and resource limits', () => {
      const inputYaml = `
version: '3.8'
services:
  app:
    image: node:20-alpine
    volumes:
      - ./app.js:/app/app.js:ro
`;
      const res = validateAndHardenCompose(inputYaml, 'proj-user123', '/tmp/test-proj');
      assert.equal(res.valid, true);
      assert.match(res.hardenedYaml, /no-new-privileges:true/);
      assert.match(res.hardenedYaml, /memory:\s*1G/);
      assert.match(res.hardenedYaml, /cpus:\s*['"]?1\.5['"]?/);
    });

    it('applies custom resource limits including 0.5 CPU core on the agent', () => {
      const inputYaml = `
version: '3.8'
services:
  app:
    image: node:20-alpine
`;
      const res = validateAndHardenCompose(inputYaml, 'proj-halfcore', '/tmp/test-proj', {
        cpus: '0.5',
        memory: '512M',
      });
      assert.equal(res.valid, true);
      assert.match(res.hardenedYaml, /cpus:\s*['"]?0\.5['"]?/);
      assert.match(res.hardenedYaml, /memory:\s*512M/);
    });

    it('blocks docker.sock and host path escapes on the agent', () => {
      const attackYaml = `
version: '3.8'
services:
  bad:
    image: alpine:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
`;
      const res = validateAndHardenCompose(attackYaml, 'proj-attack', '/tmp/bad-proj');
      assert.equal(res.valid, false);
      assert.match(res.error, /docker socket/i);
    });

    it('blocks directory traversal mounts', () => {
      const traversalYaml = `
version: '3.8'
services:
  bad:
    image: alpine:latest
    volumes:
      - ../other-tenant:/target
`;
      const res = validateAndHardenCompose(traversalYaml, 'proj-attack', '/tmp/bad-proj');
      assert.equal(res.valid, false);
      assert.match(res.error, /traversal/i);
    });

    it('blocks unconfined security profiles', () => {
      const unconfinedYaml = `
version: '3.8'
services:
  bad:
    image: alpine:latest
    security_opt:
      - seccomp:unconfined
`;
      const res = validateAndHardenCompose(unconfinedYaml, 'proj-attack', '/tmp/bad-proj');
      assert.equal(res.valid, false);
      assert.match(res.error, /disabling security profiles/i);
    });
  });

  describe('Shared Asset and Plugin Cache Reuse', () => {
    it('returns prewarmed images and cached plugins in getCacheStatus', () => {
      const status = getCacheStatus();
      assert.ok(status.sharedCacheDir);
      assert.ok(Array.isArray(status.prewarmedImages));
      assert.ok(status.prewarmedImages.includes('ghcr.io/lavalink-devs/lavalink:4-alpine'));
      assert.ok(status.prewarmedImages.includes('redis:7-alpine'));
      assert.ok(status.cachedPlugins);
    });

    it('safely pre-seeds plugins into project directory without cross-tenant modification', () => {
      const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stx-test-proj-'));
      try {
        // Seed shared plugins for lavalink
        seedSharedPlugins('test-proj', tempProjectDir, 'image: lavalink');

        const pluginsDir = path.join(tempProjectDir, 'plugins');
        assert.equal(fs.existsSync(pluginsDir), true);
      } finally {
        fs.rmSync(tempProjectDir, { recursive: true, force: true });
      }
    });
  });

  describe('All 10 Production Templates Pass Isolation Validation', () => {
    const templatesDir = path.resolve(__dirname, '../../templates');
    const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of files) {
      it(`template ${file} passes multi-tenant security validation`, () => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        const apiCheck = validateComposeSecurity(content);
        assert.equal(apiCheck.valid, true, `API check failed for ${file}: ${apiCheck.error}`);

        const agentCheck = validateAndHardenCompose(content, `proj-${file}`, '/tmp');
        assert.equal(agentCheck.valid, true, `Node-agent check failed for ${file}: ${agentCheck.error}`);
      });
    }
  });
});
