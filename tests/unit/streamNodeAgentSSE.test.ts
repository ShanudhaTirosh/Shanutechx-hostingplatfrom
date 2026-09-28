import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

const CI_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db', FIREBASE_PROJECT_ID: 'x', FIREBASE_CLIENT_EMAIL: 'x@x.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: 'k',
  WHATSAPP_INTERNAL_SECRET: 'x'.repeat(32), CLOUDFLARE_API_TOKEN: 'x'.repeat(20), CLOUDFLARE_ZONE_ID: 'x'.repeat(20), ROOT_DOMAIN: 'shanutechx.com',
  NODE_AGENT_SECRET: 'x'.repeat(32), SMS_WEBHOOK_SECRET: 'x'.repeat(32), DISCORD_INTERNAL_SECRET: 'x'.repeat(32),
  SECRETS_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', PROJECT_AUTH_JWT_SECRET: 'x'.repeat(32), BILLING_CRON_SECRET: 'x'.repeat(32),
};
for (const [k, v] of Object.entries(CI_ENV)) process.env[k] ??= v;

/**
 * streamNodeAgentSSE proxies a Server-Sent-Events stream from the node agent to the browser. Tested end to end with
 * a real fake "node agent" HTTP server and a real Express app wrapping the function, since the interesting behaviour
 * (forwarding chunks as they arrive, cleaning up on disconnect, turning a bad upstream into a clean SSE error
 * instead of a crash) only shows up with real sockets, not by inspecting the function in isolation.
 */

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = http.createServer().listen(0, '127.0.0.1', () => {
      const port = (s.address() as AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

async function startExpressWrapper(streamNodeAgentSSE: any) {
  // agentUrl() inside the module always targets env.nodeAgentPort (fixed once, read at module load), never a
  // per-call port -- so every fake "node agent" in this file must listen on FIXED_AGENT_PORT, one at a time.
  const express = (await import('express')).default;
  const app = express();
  const node = { id: 'n1', ip: '127.0.0.1' } as any;
  app.get('/proxy', async (req, res) => {
    await streamNodeAgentSSE(node, '/agent/whatever', req, res);
  });
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ url: `http://127.0.0.1:${port}/proxy`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

test('streamNodeAgentSSE', async (t) => {
  const FIXED_AGENT_PORT = await freePort();
  process.env.NODE_AGENT_PORT = String(FIXED_AGENT_PORT);
  const { streamNodeAgentSSE } = await import('../../apps/api/src/lib/nodeAgentClient');


  await t.test('forwards SSE chunks from the node agent verbatim and ends when the upstream ends', async (t) => {
    let receivedByAgent: http.IncomingMessage | null = null;
    const agent = http.createServer((req, res) => {
      receivedByAgent = req;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"type":"line","text":"hello"}\n\n');
      setTimeout(() => {
        res.write('data: {"type":"line","text":"world"}\n\n');
        res.end();
      }, 30);
    });
    await new Promise<void>((r) => agent.listen(FIXED_AGENT_PORT, '127.0.0.1', () => r()));
    t.after(() => agent.close());

    const wrap = await startExpressWrapper(streamNodeAgentSSE);
    t.after(() => wrap.close());

    const res = await fetch(wrap.url, { signal: AbortSignal.timeout(5000) });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const body = await res.text();
    assert.match(body, /"text":"hello"/);
    assert.match(body, /"text":"world"/);
    assert.ok((receivedByAgent as any)?.headers['x-agent-secret'], 'the agent auth header was sent upstream');
  });

  await t.test('a non-200 from the agent becomes a clean SSE error event, not a crash', async (t) => {
    const agent = http.createServer((_req, res) => {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('down for maintenance');
    });
    await new Promise<void>((r) => agent.listen(FIXED_AGENT_PORT, '127.0.0.1', () => r()));
    t.after(() => agent.close());

    const wrap = await startExpressWrapper(streamNodeAgentSSE);
    t.after(() => wrap.close());

    const res = await fetch(wrap.url, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    assert.match(body, /"type":"error"/);
    assert.match(body, /503/);
  });

  await t.test('an unreachable agent (connection refused) becomes a clean SSE error, not an unhandled rejection', async (t) => {
    // Nothing listens on FIXED_AGENT_PORT for this one subtest -- that IS the unreachable-agent scenario.
    const wrap = await startExpressWrapper(streamNodeAgentSSE);
    t.after(() => wrap.close());

    const res = await fetch(wrap.url, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    assert.match(body, /"type":"error"/);
  });

  await t.test('when the browser disconnects mid-stream, the upstream request to the agent is cancelled', async (t) => {
    let agentSawClose = false;
    const agent = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"type":"line","text":"first"}\n\n');
      req.on('close', () => { agentSawClose = true; });
      // Never ends on its own -- only a client abort should stop this.
    });
    await new Promise<void>((r) => agent.listen(FIXED_AGENT_PORT, '127.0.0.1', () => r()));
    t.after(() => agent.close());

    const wrap = await startExpressWrapper(streamNodeAgentSSE);
    t.after(() => wrap.close());

    const controller = new AbortController();
    const res = await fetch(wrap.url, { signal: controller.signal });
    const reader = res.body!.getReader();
    await reader.read(); // read the first chunk so the connection is definitely established
    controller.abort();
    await reader.cancel().catch(() => {});

    await new Promise((r) => setTimeout(r, 300));
    assert.equal(agentSawClose, true, 'aborting the browser request must close the upstream connection to the node, not leak it');
  });
});
