import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

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
  exposureMode: z.enum(['ssl_with_proxy', 'ssl_direct', 'no_ssl']).optional(),
  publishedPort: z.number().int().min(1).max(65535).optional(),
}).refine((data) => data.templateId || (data.repoUrl && data.internalPort), {
  message: 'Either templateId, or both repoUrl and internalPort, are required',
});

function resolveContainerRouting(exposureMode?: string, routingMode?: string) {
  const effectiveMode = exposureMode || (routingMode === 'direct' ? 'no_ssl' : 'ssl_with_proxy');
  return {
    isDirectPort: effectiveMode === 'no_ssl' || routingMode === 'direct',
    useSslProxy: effectiveMode === 'ssl_with_proxy',
    useSslDirect: effectiveMode === 'ssl_direct',
  };
}

test('Bot & Application Hosting Engine Unit Suite', async (t) => {
  await t.test('parses WhatsApp Baileys bot deployment with custom start command', () => {
    const input = {
      serviceType: 'whatsapp_baileys',
      repoUrl: 'https://github.com/shanutechx/knightbot-md.git',
      preferredName: 'knightbot-md',
      internalPort: 3000,
      startCommand: 'node index.js',
      entryFile: 'index.js',
      exposureMode: 'ssl_with_proxy',
    };

    const parsed = createDeploymentSchema.safeParse(input);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.serviceType, 'whatsapp_baileys');
      assert.equal(parsed.data.startCommand, 'node index.js');
      assert.equal(parsed.data.exposureMode, 'ssl_with_proxy');
    }
  });

  await t.test('parses Lavalink Audio Node deployment with application.yml and no_ssl TCP exposure', () => {
    const input = {
      serviceType: 'lavalink',
      repoUrl: 'https://github.com/lavalink-devs/Lavalink.git',
      preferredName: 'my-lavalink-node',
      internalPort: 2333,
      startCommand: 'java -jar Lavalink.jar',
      entryFile: 'application.yml',
      exposureMode: 'no_ssl',
      publishedPort: 2333,
    };

    const parsed = createDeploymentSchema.safeParse(input);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.serviceType, 'lavalink');
      assert.equal(parsed.data.internalPort, 2333);
      assert.equal(parsed.data.startCommand, 'java -jar Lavalink.jar');
      assert.equal(parsed.data.entryFile, 'application.yml');
      assert.equal(parsed.data.exposureMode, 'no_ssl');
    }
  });

  await t.test('resolves container routing mode correctly for direct TCP host binding', () => {
    const res1 = resolveContainerRouting('no_ssl');
    assert.equal(res1.isDirectPort, true);
    assert.equal(res1.useSslProxy, false);

    const res2 = resolveContainerRouting('ssl_with_proxy');
    assert.equal(res2.isDirectPort, false);
    assert.equal(res2.useSslProxy, true);

    const res3 = resolveContainerRouting('ssl_direct');
    assert.equal(res3.isDirectPort, false);
    assert.equal(res3.useSslDirect, true);
  });
});
