import net from "net";
import http from "http";
import https from "https";
import dns from "dns";
import { execFile } from "child_process";
import { dbOps, MonitorRow } from "@/lib/db";
import { sendAlert } from "@/features/notifications/server/notifications";

if (typeof dns.setDefaultResultOrder === "function") {
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch {}
}

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 30,
  family: 4,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 30,
  family: 4,
});

export interface CheckResult {
  ok: boolean;
  latency: number | null;
  statusCode: number | null;
  error: string | null;
}

/** Human-readable target for alerts/logging, independent of monitor type. */
export function monitorTarget(m: MonitorRow): string {
  if (m.type === "tcp") return `${m.host ?? ""}:${m.port ?? ""}`;
  if (m.type === "ping") return m.host ?? "";
  return m.url ?? "";
}

// ---------- Check executors ----------

async function checkHttp(
  m: MonitorRow,
  redirectUrl?: string,
  redirectCount = 0
): Promise<CheckResult> {
  if (redirectCount > 5) {
    return {
      ok: false,
      latency: null,
      statusCode: null,
      error: "Too many redirects",
    };
  }

  const targetUrl = redirectUrl || m.url || "";
  const timeoutMs = Math.max(m.timeout_ms || 8000, 15000);
  const started = Date.now();

  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;
      const agent = isHttps ? httpsAgent : httpAgent;

      const req = client.request(
        parsed,
        {
          method: m.method || "GET",
          agent,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
          },
          family: 4,
          timeout: timeoutMs,
        },
        async (res) => {
          const statusCode = res.statusCode ?? null;

          // Follow redirects automatically
          if (
            statusCode &&
            [301, 302, 303, 307, 308].includes(statusCode) &&
            res.headers.location
          ) {
            const nextUrl = new URL(res.headers.location, targetUrl).toString();
            res.resume();
            const redirectedResult = await checkHttp(m, nextUrl, redirectCount + 1);
            resolve(redirectedResult);
            return;
          }

          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            if (body.length < 500000) body += chunk;
          });

          res.on("end", () => {
            const latency = Date.now() - started;
            const isVercelChallenge =
              statusCode === 403 &&
              (res.headers["x-vercel-mitigated"] === "challenge" ||
                Boolean(res.headers["x-vercel-id"]) ||
                body.includes("Vercel Security Checkpoint"));

            const isCloudflareChallenge =
              statusCode === 403 &&
              (res.headers["cf-mitigated"] === "challenge" ||
                Boolean(res.headers["cf-ray"]) ||
                body.includes("Just a moment...") ||
                body.includes("Cloudflare"));

            let ok =
              m.expected_status != null
                ? statusCode === m.expected_status
                : isVercelChallenge ||
                  isCloudflareChallenge ||
                  (statusCode != null && statusCode >= 200 && statusCode < 400);

            let error: string | null = ok ? null : `HTTP ${statusCode}`;

            if (ok && m.keyword) {
              if (!body.includes(m.keyword)) {
                ok = false;
                error = `Keyword "${m.keyword}" not found`;
              }
            }

            resolve({ ok, latency, statusCode, error });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy(new Error("Timeout"));
      });

      req.on("error", (err: any) => {
        const isTimeout =
          err.message === "Timeout" ||
          err.code === "ETIMEDOUT" ||
          err.name === "AbortError";
        resolve({
          ok: false,
          latency: null,
          statusCode: null,
          error: isTimeout ? "Timeout" : err.message,
        });
      });

      req.end();
    } catch (err: any) {
      resolve({
        ok: false,
        latency: null,
        statusCode: null,
        error: err.message || "Invalid URL",
      });
    }
  });
}

function checkTcp(m: MonitorRow): Promise<CheckResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const done = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(m.timeout_ms);
    socket.once("connect", () =>
      done({ ok: true, latency: Date.now() - started, statusCode: null, error: null })
    );
    socket.once("timeout", () =>
      done({ ok: false, latency: null, statusCode: null, error: "Timeout" })
    );
    socket.once("error", (err) =>
      done({ ok: false, latency: null, statusCode: null, error: err.message })
    );

    socket.connect(m.port ?? 0, m.host ?? "");
  });
}

function checkPing(m: MonitorRow): Promise<CheckResult> {
  return new Promise((resolve) => {
    const waitSec = Math.max(1, Math.ceil(m.timeout_ms / 1000));
    const started = Date.now();
    execFile(
      "ping",
      ["-c", "1", "-W", String(waitSec), m.host ?? ""],
      { timeout: m.timeout_ms + 1000 },
      (err, stdout) => {
        if (err) {
          resolve({ ok: false, latency: null, statusCode: null, error: "Host unreachable" });
          return;
        }
        const match = /time[=<]([\d.]+)/.exec(stdout);
        const latency = match ? Math.round(parseFloat(match[1])) : Date.now() - started;
        resolve({ ok: true, latency, statusCode: null, error: null });
      }
    );
  });
}

async function runCheck(m: MonitorRow): Promise<CheckResult> {
  switch (m.type) {
    case "tcp":
      return checkTcp(m);
    case "ping":
      return checkPing(m);
    case "http":
    default:
      return checkHttp(m);
  }
}

// ---------- Ping a monitor: check, detect state change, store ----------

export async function pingMonitor(m: MonitorRow): Promise<void> {
  const previous = await dbOps.getLatest(m.id);

  let result = await runCheck(m);
  if (!result.ok) {
    // Grace pause before marking down: retry once after 1s
    await new Promise((r) => setTimeout(r, 1000));
    const retry = await runCheck(m);
    if (retry.ok) {
      result = retry;
    }
  }

  if (previous && previous.ok !== (result.ok ? 1 : 0)) {
    const isUp = result.ok;
    console.log(`State change detected for ${m.name}: ${isUp ? "UP" : "DOWN"}`);
    sendAlert(
      { name: m.name, url: monitorTarget(m) },
      isUp,
      result.latency,
      result.error
    );
  }

  await dbOps.insertCheck({
    siteId: m.id,
    ts: Date.now(),
    ok: result.ok,
    latency: result.latency,
    statusCode: result.statusCode,
    error: result.error,
  });
}
