/**
 * Reads a Server-Sent-Events endpoint that requires this app's normal auth. Every route in this API is gated by
 * `requireAuth`, which only ever reads the `Authorization: Bearer <token>` header (see apps/api/src/middleware/auth.ts)
 * -- there is no cookie fallback. The browser's native `EventSource` cannot set custom headers, so `new
 * EventSource(url)` against any of these routes sends no credential at all and gets a 401 on the very first request,
 * every time. That is not a hypothetical: it is exactly what the deployment console's own "stream logs" toggle was
 * doing before this file existed, so it never worked -- it just looked like a flaky connection (an immediate "Log
 * stream disconnected" toast) instead of a fully broken one.
 *
 * This reads the stream with `fetch` (which can set the header) and a manual `ReadableStream` reader instead,
 * parsing `data: ...\n\n` frames the same way EventSource does. Use it anywhere a live stream needs this app's auth.
 */

export interface StreamHandle {
  /** Stops reading and releases the connection. Safe to call more than once. */
  close(): void;
}

export function streamAuthedEvents(
  path: string,
  onMessage: (data: string) => void,
  onError: (err: Error) => void,
  opts: { baseUrl?: string; getToken?: () => Promise<string> } = {}
): StreamHandle {
  const { baseUrl = '', getToken = async () => (await import('./useAuth')).getAuthToken() } = opts;
  const controller = new AbortController();
  let closed = false;

  (async () => {
    let token: string;
    try {
      token = await getToken();
    } catch (err) {
      if (!closed) onError(err instanceof Error ? err : new Error('Not signed in'));
      return;
    }
    if (closed) return;

    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    } catch (err) {
      if (!closed) onError(err instanceof Error ? err : new Error('Could not connect'));
      return;
    }
    if (!res.ok || !res.body) {
      if (!closed) onError(new Error(`Stream request failed (${res.status})`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line; each frame's payload is the text after "data: " on each line.
        let sepIndex: number;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          const dataLines = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, ''));
          if (dataLines.length > 0) onMessage(dataLines.join('\n'));
        }
      }
    } catch (err) {
      if (!closed && (err as Error).name !== 'AbortError') onError(err instanceof Error ? err : new Error('Stream read failed'));
    }
  })();

  return {
    close() {
      if (closed) return;
      closed = true;
      controller.abort();
    },
  };
}

/**
 * The node agent's log stream sends JSON events ({type: 'connected' | 'log' | 'error', data?, message?}) rather than
 * bare text lines. Returns the text to append to a log view, or null for events that carry none (the initial
 * "connected" notice). Anything that is not valid JSON is treated as a plain line, so a differently-shaped stream
 * still shows something instead of nothing.
 */
export function logLineFromEvent(raw: string): { line: string | null; error?: string } {
  try {
    const ev = JSON.parse(raw);
    if (ev && typeof ev === 'object') {
      if (ev.type === 'log') return { line: typeof ev.data === 'string' ? ev.data : null };
      if (ev.type === 'error') return { line: null, error: String(ev.message ?? ev.data ?? 'Stream error') };
      return { line: null };
    }
  } catch {
    /* not JSON */
  }
  return { line: raw };
}
