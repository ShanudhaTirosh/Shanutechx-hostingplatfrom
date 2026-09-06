import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { parseDotEnvText } from '../../apps/dashboard/components/BulkEnvImportModal';

const createDeploymentSchema = z.object({
  serviceType: z.enum([
    'web_hosting',
    'node_hosting',
    'python_hosting',
    'discordbot_python',
    'discordbot_node',
    'whatsapp_baileys',
    'lavalink',
    'n8n',
    'livekit',
    'wordpress',
    'supabase_stack',
    'custom_docker',
  ]),
  templateId: z.string().optional(),
  repoUrl: z.string().url().optional(),
  branch: z.string().regex(/^[a-zA-Z0-9_\-\/\.]+$/).max(100).optional(),
  preferredName: z.string().min(1),
  customSubdomain: z.string().min(2).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  internalPort: z.number().int().positive().optional(),
  envVars: z.record(z.string()).optional(),
  startCommand: z.string().max(500).optional(),
  entryFile: z.string().max(255).optional(),
  frameworkPreset: z.enum(['auto', 'nextjs', 'react_vite', 'nodejs_bot', 'whatsapp_baileys', 'python_bot', 'lavalink_java', 'static_html', 'custom']).optional(),
  exposureMode: z.enum(['ssl_with_proxy', 'ssl_direct', 'no_ssl', 'internal_only', 'raw_tcp']).optional(),
  publishedPort: z.number().int().min(1).max(65535).optional(),
}).refine((data) => data.templateId || (data.repoUrl && data.internalPort), {
  message: 'Either templateId, or both repoUrl and internalPort, are required',
});

function parseTemplateCommentMeta(content: string) {
  const lines = content.split('\n');
  const meta: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^#\s+(\w+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
    if (!line.startsWith('#') && line.trim()) break;
  }
  const reqPort = meta.requiresExposedPort ? meta.requiresExposedPort.toLowerCase() === 'true' : false;
  const parsedPort = meta.defaultInternalPort ? parseInt(meta.defaultInternalPort, 10) : (meta.port ? parseInt(meta.port, 10) : null);
  const recMode = (meta.recommendedExposureMode as any) || (reqPort ? 'ssl_with_proxy' : 'internal_only');

  return {
    requiresExposedPort: reqPort,
    defaultInternalPort: parsedPort,
    recommendedExposureMode: recMode,
  };
}

function resolveIsPublic(exposureMode?: string, serviceType?: string) {
  const PUBLIC_SERVICE_TYPES = new Set(['web_hosting', 'node_hosting', 'python_hosting']);
  return exposureMode
    ? exposureMode !== 'internal_only'
    : PUBLIC_SERVICE_TYPES.has(serviceType || '');
}

function isMailHostService(serviceName: string): boolean {
  return serviceName === 'webmail' || serviceName === 'smtp_imap_gateway';
}

test('Unified Opt-In Port Exposure & Bot Hosting Spec', async (t) => {
  await t.test('accepts internal_only and raw_tcp exposure modes in deployment schema', () => {
    const internalBot = createDeploymentSchema.safeParse({
      serviceType: 'discordbot_node',
      repoUrl: 'https://github.com/example/discord-bot.git',
      preferredName: 'my-discord-bot',
      internalPort: 3000,
      exposureMode: 'internal_only',
    });
    assert.equal(internalBot.success, true);
    if (internalBot.success) {
      assert.equal(internalBot.data.exposureMode, 'internal_only');
    }

    const tcpBot = createDeploymentSchema.safeParse({
      serviceType: 'custom_docker',
      repoUrl: 'https://github.com/example/game-server.git',
      preferredName: 'game-server',
      internalPort: 25565,
      exposureMode: 'raw_tcp',
    });
    assert.equal(tcpBot.success, true);
    if (tcpBot.success) {
      assert.equal(tcpBot.data.exposureMode, 'raw_tcp');
    }
  });

  await t.test('resolves isPublic to false when exposureMode is internal_only', () => {
    assert.equal(resolveIsPublic('internal_only', 'web_hosting'), false);
    assert.equal(resolveIsPublic('internal_only', 'discordbot_node'), false);
    assert.equal(resolveIsPublic('ssl_with_proxy', 'discordbot_node'), true);
    assert.equal(resolveIsPublic('raw_tcp', 'custom_docker'), true);
  });

  await t.test('parses bulk .env text correctly stripping quotes and comments', () => {
    const rawEnv = `
# Telegram Bot Config
BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
PORT=8080
# Database connection
DATABASE_URL='postgresql://user:pass@localhost:5432/botdb'
export SECRET_KEY="topsecret"
`;
    const parsed = parseDotEnvText(rawEnv);
    assert.equal(parsed.BOT_TOKEN, '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    assert.equal(parsed.PORT, '8080');
    assert.equal(parsed.DATABASE_URL, 'postgresql://user:pass@localhost:5432/botdb');
    assert.equal(parsed.SECRET_KEY, 'topsecret');
    assert.equal(Object.keys(parsed).length, 4);
  });

  await t.test('extracts comment header metadata from Coolify template YAML', () => {
    const yamlHeader = `
# slogan: Telegram Webhook Bot Template
# requiresExposedPort: true
# defaultInternalPort: 3000
# recommendedExposureMode: ssl_with_proxy
# category: messaging
services:
  telegram-bot:
    image: node:20-alpine
`;
    const meta = parseTemplateCommentMeta(yamlHeader);
    assert.equal(meta.requiresExposedPort, true);
    assert.equal(meta.defaultInternalPort, 3000);
    assert.equal(meta.recommendedExposureMode, 'ssl_with_proxy');
  });

  await t.test('excludes mail host services from zero-port defaults', () => {
    assert.equal(isMailHostService('webmail'), true);
    assert.equal(isMailHostService('smtp_imap_gateway'), true);
    assert.equal(isMailHostService('discordbot_node'), false);
    assert.equal(isMailHostService('n8n'), false);
  });
});
