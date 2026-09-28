import test from 'node:test';
import assert from 'node:assert/strict';
import { streamAuthedEvents, logLineFromEvent } from '../../apps/dashboard/lib/sse';

/**
 * streamAuthedEvents exists because native EventSource cannot send the Authorization header this app's auth
 * requires -- confirmed by reading apps/api/src/middleware/auth.ts, which only ever reads that header or an
 * x-api-key, with no cookie fallback. This is what the deployment console's "stream logs" toggle was silently
 * missing (it used `new EventSource(url)`, which got a 401 on every single connection).
 */

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

function withFetch(impl: typeof fetch, run: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = real;
  });
}

test('streamAuthedEvents', async (t) => {
  await t.test('sends the token as a Bearer header (never as a query param) -- this is the whole reason it exists', async () => {
    const seen: Record<string, string> = {};
    await withFetch(
      (async (url: string, init: RequestInit) => {
        seen.url = url;
        seen.auth = (init.headers as Record<string, string>).Authorization;
        return new Response(sseBody(['data: hello\n\n']), { status: 200 });
      }) as typeof fetch,
      async () => {
        const messages: string[] = [];
        const h = streamAuthedEvents('/api/whatever', (m) => messages.push(m), () => {}, { baseUrl: 'https://api.example.com', getToken: async () => 'the-token' });
        await new Promise((r) => setTimeout(r, 20));
        h.close();
        assert.equal(seen.url, 'https://api.example.com/api/whatever');
        assert.equal(seen.auth, 'Bearer the-token');
        assert.deepEqual(messages, ['hello']);
      }
    );
  });

  await t.test('parses multi-line data fields, multiple frames in one chunk, and frames split across chunks', async () => {
    await withFetch(
      (async () => new Response(sseBody(['data: line1\ndata: line2\n\ndata: seco', 'nd\n\n']), { status: 200 })) as typeof fetch,
      async () => {
        const messages: string[] = [];
        const h = streamAuthedEvents('/x', (m) => messages.push(m), () => {}, { getToken: async () => 't' });
        await new Promise((r) => setTimeout(r, 20));
        h.close();
        assert.deepEqual(messages, ['line1\nline2', 'second']);
      }
    );
  });

  await t.test('a non-ok response calls onError, not onMessage', async () => {
    await withFetch(
      (async () => new Response('nope', { status: 503 })) as typeof fetch,
      async () => {
        let error: Error | null = null;
        const h = streamAuthedEvents('/x', () => {}, (e) => (error = e), { getToken: async () => 't' });
        await new Promise((r) => setTimeout(r, 20));
        h.close();
        assert.match(error?.message ?? '', /503/);
      }
    );
  });

  await t.test('a failure getting the token calls onError and never calls fetch at all', async () => {
    let fetchCalled = false;
    await withFetch(
      (async () => {
        fetchCalled = true;
        return new Response('', { status: 200 });
      }) as typeof fetch,
      async () => {
        let error: Error | null = null;
        const h = streamAuthedEvents('/x', () => {}, (e) => (error = e), { getToken: async () => { throw new Error('not signed in'); } });
        await new Promise((r) => setTimeout(r, 20));
        h.close();
        assert.equal(error?.message, 'not signed in');
        assert.equal(fetchCalled, false);
      }
    );
  });

  await t.test('close() aborts the underlying request and suppresses further callbacks', async () => {
    let aborted = false;
    await withFetch(
      (async (_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        return new Promise<Response>((resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      }) as typeof fetch,
      async () => {
        let errorCalls = 0;
        const h = streamAuthedEvents('/x', () => {}, () => errorCalls++, { getToken: async () => 't' });
        await new Promise((r) => setTimeout(r, 10));
        h.close();
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(aborted, true);
        assert.equal(errorCalls, 0, 'an abort triggered by close() must not be reported as an error');
      }
    );
  });

  await t.test('close() called before a REJECTED token lookup arrives suppresses the error (no toast after the user already navigated away)', async () => {
    let rejectToken!: (e: Error) => void;
    const tokenPromise = new Promise<string>((_r, rej) => (rejectToken = rej));
    let errorCalls = 0;
    const h = streamAuthedEvents('/x', () => {}, () => errorCalls++, { getToken: () => tokenPromise });
    h.close();
    rejectToken(new Error('token expired'));
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(errorCalls, 0);
  });

  await t.test('close() before the token promise resolves prevents fetch from ever being called', async () => {
    let fetchCalled = false;
    await withFetch(
      (async () => {
        fetchCalled = true;
        return new Response('', { status: 200 });
      }) as typeof fetch,
      async () => {
        let resolveToken!: (t: string) => void;
        const tokenPromise = new Promise<string>((r) => (resolveToken = r));
        const h = streamAuthedEvents('/x', () => {}, () => {}, { getToken: () => tokenPromise });
        h.close();
        resolveToken('late-token');
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(fetchCalled, false);
      }
    );
  });
});

test('logLineFromEvent understands the node agent\'s JSON log events', () => {
  assert.deepEqual(logLineFromEvent('{"type":"log","data":"GET / 200","timestamp":"t"}'), { line: 'GET / 200' });
  assert.deepEqual(logLineFromEvent('{"type":"connected","message":"Log stream connected"}'), { line: null }, 'the connect notice adds nothing to the log');
  assert.deepEqual(logLineFromEvent('{"type":"error","message":"Node returned 503"}'), { line: null, error: 'Node returned 503' });
  assert.deepEqual(logLineFromEvent('plain text line'), { line: 'plain text line' }, 'non-JSON is shown as-is rather than dropped');
  assert.deepEqual(logLineFromEvent('42'), { line: '42' }, 'a JSON scalar is not an event');
});
