import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { autoDetectExposureMode } from '../../apps/api/src/lib/exposureDefaults';

describe('Auto Exposure Mode Detection & LiveKit App Catalog Integration', () => {
  describe('autoDetectExposureMode', () => {
    it('auto-detects ssl_with_proxy for standard web HTTP ports', () => {
      assert.equal(autoDetectExposureMode({ port: 80 }), 'ssl_with_proxy');
      assert.equal(autoDetectExposureMode({ port: 443 }), 'ssl_with_proxy');
      assert.equal(autoDetectExposureMode({ port: 3000 }), 'ssl_with_proxy');
      assert.equal(autoDetectExposureMode({ port: 5678 }), 'ssl_with_proxy');
      assert.equal(autoDetectExposureMode({ port: 7880 }), 'ssl_with_proxy'); // LiveKit default port
      assert.equal(autoDetectExposureMode({ port: 8080 }), 'ssl_with_proxy');
    });

    it('auto-detects no_ssl for raw game and non-HTTP ports', () => {
      assert.equal(autoDetectExposureMode({ port: 25565 }), 'no_ssl'); // Minecraft
      assert.equal(autoDetectExposureMode({ port: 27015 }), 'no_ssl'); // Steam / Source
      assert.equal(autoDetectExposureMode({ port: 7777 }), 'no_ssl');
    });

    it('auto-detects ssl_with_proxy from compose YAML with Traefik annotations', () => {
      const composeYaml = `
version: '3.8'
services:
  app:
    image: custom/app:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.entrypoints=websecure"
`;
      assert.equal(autoDetectExposureMode({ composeYaml }), 'ssl_with_proxy');
    });

    it('maps raw_tcp explicit mode to no_ssl', () => {
      assert.equal(autoDetectExposureMode({ explicitMode: 'raw_tcp', port: 80 }), 'no_ssl');
    });

    it('honors valid explicit modes over auto-detection when specified', () => {
      assert.equal(autoDetectExposureMode({ explicitMode: 'internal_only', port: 7880 }), 'internal_only');
      assert.equal(autoDetectExposureMode({ explicitMode: 'ssl_direct', port: 80 }), 'ssl_direct');
      assert.equal(autoDetectExposureMode({ explicitMode: 'no_ssl', port: 3000 }), 'no_ssl');
    });

    it('falls back to auto-detection when explicit mode is auto or omitted', () => {
      assert.equal(autoDetectExposureMode({ explicitMode: 'auto', port: 7880 }), 'ssl_with_proxy');
      assert.equal(autoDetectExposureMode({ explicitMode: null, port: 7880 }), 'ssl_with_proxy');
    });

    it('auto-detects internal_only when port is 0 or negative', () => {
      assert.equal(autoDetectExposureMode({ port: 0 }), 'internal_only');
      assert.equal(autoDetectExposureMode({ port: -1 }), 'internal_only');
    });
  });

  describe('LiveKit Catalog Template (templates/livekit.yaml)', () => {
    const templatePath = path.resolve(__dirname, '../../templates/livekit.yaml');

    it('exists and has catalog metadata comments', () => {
      assert.equal(fs.existsSync(templatePath), true);
      const content = fs.readFileSync(templatePath, 'utf8');
      assert.match(content, /# name: LiveKit WebRTC Server/i);
      assert.match(content, /# port: 7880/);
      assert.match(content, /# recommendedExposureMode: ssl_with_proxy/);
    });

    it('mounts the configuration file into /etc/livekit.yaml', () => {
      const content = fs.readFileSync(templatePath, 'utf8');
      assert.match(content, /\.\/livekit\.yaml:\/etc\/livekit\.yaml:ro/);
      assert.match(content, /command:\s*--config \/etc\/livekit\.yaml/);
    });

    it('routes dynamically via Traefik without static host port collisions', () => {
      const content = fs.readFileSync(templatePath, 'utf8');
      // Must not bind fixed host ports 7880:7880
      assert.doesNotMatch(content, /"7880:7880"/);
      // Must declare Traefik labels
      assert.match(content, /traefik\.enable=true/);
      assert.match(content, /traefik\.docker\.network=shanutechx-public/);
      assert.match(content, /traefik\.http\.services\.\$\{COMPOSE_PROJECT_NAME\}\.loadbalancer\.server\.port=7880/);
      assert.match(content, /shanutechx-public:\s*\n\s*external:\s*true/);
    });
  });

  describe('Full Catalog Templates Suite (templates/*)', () => {
    const templatesDir = path.resolve(__dirname, '../../templates');
    const webTemplates = [
      { file: 'lavalink.yaml', port: 2333, configFile: './application.yml:/opt/Lavalink/application.yml:ro' },
      { file: 'grafana.yaml', port: 3000 },
      { file: 'uptime-kuma.yaml', port: 3001 },
      { file: 'wordpress.yaml', port: 80 },
      { file: 'n8n.yaml', port: 5678 },
      { file: 'hermes-agent.yaml', port: 8080 },
      { file: 'supabase-lite.yaml', port: 3000 },
    ];

    it('all 10 templates exist in the templates directory', () => {
      const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
      assert.equal(files.length, 10);
    });

    for (const t of webTemplates) {
      it(`${t.file} adheres to zero-collision Traefik proxy and non-conflicting container/port rules`, () => {
        const filePath = path.join(templatesDir, t.file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Must recommend ssl_with_proxy
        assert.match(content, /# recommendedExposureMode: ssl_with_proxy/);
        // Must declare external shanutechx-public network
        assert.match(content, /shanutechx-public:\s*\n\s*external:\s*true/);
        // Must have Traefik labels
        assert.match(content, /traefik\.enable=true/);
        assert.match(content, /traefik\.docker\.network=shanutechx-public/);
        assert.match(content, new RegExp(`loadbalancer\\.server\\.port=${t.port}`));
        // Must not have fixed host port collision (e.g. "port:port")
        assert.doesNotMatch(content, new RegExp(`"${t.port}:${t.port}"`));
        // Must not have static container_name
        assert.doesNotMatch(content, /container_name:\s*\$\{?[A-Z0-9_]+:-[a-z0-9_-]+\}?/);

        if (t.configFile) {
          assert.match(content, new RegExp(t.configFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
      });
    }

    it('redis.yaml has authenticated healthcheck and configurable port', () => {
      const content = fs.readFileSync(path.join(templatesDir, 'redis.yaml'), 'utf8');
      assert.match(content, /# recommendedExposureMode: raw_tcp/);
      assert.match(content, /redis-cli -a \\"\$REDIS_PASSWORD\\" ping/);
      assert.match(content, /volumes:\s*\n\s*redis_data:/);
    });

    it('mongodb.yaml has persistent volume and configurable port', () => {
      const content = fs.readFileSync(path.join(templatesDir, 'mongodb.yaml'), 'utf8');
      assert.match(content, /# recommendedExposureMode: raw_tcp/);
      assert.match(content, /volumes:\s*\n\s*mongodb_data:/);
    });
  });

  describe('Node Stack Docker Compose Hygiene (infra/node-stack/docker-compose.yml)', () => {
    const nodeStackPath = path.resolve(__dirname, '../../infra/node-stack/docker-compose.yml');

    it('has no hardcoded livekit-server service or livekit-config volume', () => {
      assert.equal(fs.existsSync(nodeStackPath), true);
      const content = fs.readFileSync(nodeStackPath, 'utf8');
      assert.doesNotMatch(content, /livekit-server:/);
      assert.doesNotMatch(content, /livekit-config:/);
    });
  });
});
