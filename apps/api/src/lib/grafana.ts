import http from 'http';
import https from 'https';

export interface GrafanaClusterMetrics {
  isConfigured: boolean;
  status: 'connected' | 'disconnected' | 'unconfigured';
  version?: string;
  databaseStatus?: string;
  cpuUsagePct: number;
  memoryUsagePct: number;
  activeContainersCount: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputRps: number;
  metricsHistory: Array<{ time: string; cpu: number; ram: number; latency: number }>;
}

// ── Low-level HTTP helper ──────────────────────────────────────────────────────

function makeRequest(url: string, authHeader?: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const transport = isHttps ? https : http;
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authHeader) headers.Authorization = authHeader;

    const req = transport.get(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode} from ${parsedUrl.hostname}`));
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ── Prometheus query helpers ───────────────────────────────────────────────────

/**
 * Execute an instant PromQL query against Prometheus (direct HTTP API, port 9090).
 * Returns the numeric scalar value, or 0 on any error — never throws.
 */
async function promInstant(prometheusBaseUrl: string, promql: string): Promise<number> {
  try {
    const url = `${prometheusBaseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;
    const res = await makeRequest(url, undefined, 4000);
    if (res?.status === 'success') {
      const results: any[] = res?.data?.result ?? [];
      if (results.length > 0) {
        const val = parseFloat(results[0]?.value?.[1] ?? 'NaN');
        return isFinite(val) ? val : 0;
      }
    }
  } catch {
    // Prometheus unreachable — return 0 gracefully
  }
  return 0;
}

/**
 * Execute a range PromQL query and return an array of { time, value } points.
 * Falls back to [] on any error — never throws.
 */
async function promRange(
  prometheusBaseUrl: string,
  promql: string,
  rangeMinutes = 60,
  stepSeconds = 300
): Promise<Array<{ time: string; value: number }>> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const start = now - rangeMinutes * 60;
    const url =
      `${prometheusBaseUrl}/api/v1/query_range` +
      `?query=${encodeURIComponent(promql)}` +
      `&start=${start}&end=${now}&step=${stepSeconds}`;

    const res = await makeRequest(url, undefined, 5000);
    if (res?.status === 'success') {
      const results: any[] = res?.data?.result ?? [];
      if (results.length > 0) {
        const values: [number, string][] = results[0]?.values ?? [];
        return values.map(([ts, val]) => ({
          time: new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: Math.round(parseFloat(val) * 10) / 10 || 0,
        }));
      }
    }
  } catch {
    // Prometheus unreachable
  }
  return [];
}

// ── GrafanaClient ─────────────────────────────────────────────────────────────

export class GrafanaClient {
  private baseUrl: string;
  private apiKey: string;
  /**
   * Prometheus HTTP API base URL. In production docker-compose this is always
   * http://prometheus:9090. Derived automatically from the Grafana URL if not
   * overridden — when Grafana is on the same internal network as Prometheus we
   * can reach Prometheus directly, which avoids needing a Grafana service-account
   * token for the data-source proxy endpoints.
   */
  private prometheusUrl: string;

  constructor(baseUrl?: string, apiKey?: string, prometheusUrl?: string) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.apiKey = apiKey || '';
    this.prometheusUrl = (prometheusUrl || 'http://prometheus:9090').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  public async fetchHealth(): Promise<{ database: string; version: string; commit: string } | null> {
    if (!this.baseUrl) return null;
    try {
      const authHeader = this.apiKey
        ? this.apiKey.startsWith('Bearer ')
          ? this.apiKey
          : `Bearer ${this.apiKey}`
        : undefined;
      return await makeRequest(`${this.baseUrl}/api/health`, authHeader);
    } catch {
      return null;
    }
  }

  /**
   * Returns cluster-wide metrics sourced from real Prometheus PromQL queries.
   * Falls back to zeros (never throws) when Grafana or Prometheus is unreachable.
   */
  public async getClusterMetrics(): Promise<GrafanaClusterMetrics> {
    if (!this.baseUrl) {
      return {
        isConfigured: false,
        status: 'unconfigured',
        cpuUsagePct: 0,
        memoryUsagePct: 0,
        activeContainersCount: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        throughputRps: 0,
        metricsHistory: [],
      };
    }

    const health = await this.fetchHealth();
    if (!health) {
      return {
        isConfigured: true,
        status: 'disconnected',
        cpuUsagePct: 0,
        memoryUsagePct: 0,
        activeContainersCount: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        throughputRps: 0,
        metricsHistory: [],
      };
    }

    // ── Instant scalars ────────────────────────────────────────────────────────
    const [cpuPct, memPct, containers, rps, p95, p99] = await Promise.all([
      // Host CPU usage — average idle subtracted from 100 across all cores
      promInstant(
        this.prometheusUrl,
        '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)'
      ),
      // Host memory usage %
      promInstant(
        this.prometheusUrl,
        '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'
      ),
      // Running Docker containers visible to cAdvisor (exclude empty image/name)
      promInstant(
        this.prometheusUrl,
        'count(container_last_seen{image!="",name!=""}) or vector(0)'
      ),
      // API HTTP throughput (requests/s) over last 5 minutes
      promInstant(
        this.prometheusUrl,
        'sum(rate(shanutechx_http_requests_total[5m])) or vector(0)'
      ),
      // p95 API request latency in ms
      promInstant(
        this.prometheusUrl,
        'histogram_quantile(0.95, sum(rate(shanutechx_http_request_duration_seconds_bucket[5m])) by (le)) * 1000 or vector(0)'
      ),
      // p99 API request latency in ms
      promInstant(
        this.prometheusUrl,
        'histogram_quantile(0.99, sum(rate(shanutechx_http_request_duration_seconds_bucket[5m])) by (le)) * 1000 or vector(0)'
      ),
    ]);

    // ── Range series (last 60 min, 5-min steps → 12 points) ──────────────────
    const [cpuSeries, ramSeries, latSeries] = await Promise.all([
      promRange(
        this.prometheusUrl,
        '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
        60,
        300
      ),
      promRange(
        this.prometheusUrl,
        '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
        60,
        300
      ),
      promRange(
        this.prometheusUrl,
        'histogram_quantile(0.95, sum(rate(shanutechx_http_request_duration_seconds_bucket[5m])) by (le)) * 1000',
        60,
        300
      ),
    ]);

    // Zip series into a unified metricsHistory (all three share the same timestamps)
    const length = Math.max(cpuSeries.length, ramSeries.length, latSeries.length);
    const metricsHistory = Array.from({ length }, (_, i) => ({
      time: cpuSeries[i]?.time ?? ramSeries[i]?.time ?? latSeries[i]?.time ?? '',
      cpu: cpuSeries[i]?.value ?? 0,
      ram: ramSeries[i]?.value ?? 0,
      latency: latSeries[i]?.value ?? 0,
    }));

    return {
      isConfigured: true,
      status: 'connected',
      version: health.version || 'v11.1.0',
      databaseStatus: health.database || 'ok',
      cpuUsagePct: Math.round(cpuPct * 10) / 10,
      memoryUsagePct: Math.round(memPct * 10) / 10,
      activeContainersCount: Math.round(containers),
      p95LatencyMs: Math.round(p95),
      p99LatencyMs: Math.round(p99),
      throughputRps: Math.round(rps * 10) / 10,
      metricsHistory,
    };
  }

  public async fetchDashboards(): Promise<
    Array<{ id: number; uid: string; title: string; url: string; tags: string[] }>
  > {
    if (!this.baseUrl) return [];
    try {
      const authHeader = this.apiKey
        ? this.apiKey.startsWith('Bearer ')
          ? this.apiKey
          : `Bearer ${this.apiKey}`
        : undefined;
      const res = await makeRequest(`${this.baseUrl}/api/search?type=dash-db`, authHeader);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch real per-node telemetry from Prometheus node_exporter metrics,
   * filtered to the specific node IP via the `instance` label.
   * Falls back to zeros gracefully when Prometheus has no data for that node.
   *
   * node_exporter is expected to be scraped at <nodeIp>:9100.
   */
  public async getNodeTelemetry(nodeIp: string): Promise<{
    cpuUsagePct: number;
    memoryUsedMb: number;
    diskUsagePct: number;
    networkRxKbps: number;
    networkTxKbps: number;
  }> {
    // The `instance` label in Prometheus is <host>:<port>; node_exporter default port is 9100
    const instance = nodeIp.includes(':') ? nodeIp : `${nodeIp}:9100`;

    const [cpuPct, memAvail, memTotal, diskAvail, diskSize, netRx, netTx] = await Promise.all([
      // CPU usage % for this specific node
      promInstant(
        this.prometheusUrl,
        `100 - (avg(rate(node_cpu_seconds_total{mode="idle",instance="${instance}"}[5m])) * 100)`
      ),
      // Memory available bytes
      promInstant(
        this.prometheusUrl,
        `node_memory_MemAvailable_bytes{instance="${instance}"}`
      ),
      // Memory total bytes
      promInstant(
        this.prometheusUrl,
        `node_memory_MemTotal_bytes{instance="${instance}"}`
      ),
      // Root filesystem available bytes
      promInstant(
        this.prometheusUrl,
        `node_filesystem_avail_bytes{instance="${instance}",mountpoint="/"}`
      ),
      // Root filesystem total bytes
      promInstant(
        this.prometheusUrl,
        `node_filesystem_size_bytes{instance="${instance}",mountpoint="/"}`
      ),
      // Network receive kbps (bits/s → kbps via /1024)
      promInstant(
        this.prometheusUrl,
        `sum(rate(node_network_receive_bytes_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])) * 8 / 1024`
      ),
      // Network transmit kbps
      promInstant(
        this.prometheusUrl,
        `sum(rate(node_network_transmit_bytes_total{instance="${instance}",device!~"lo|veth.*|docker.*|br-.*"}[5m])) * 8 / 1024`
      ),
    ]);

    const memoryUsedMb = memTotal > 0 ? Math.round((memTotal - memAvail) / (1024 * 1024)) : 0;
    const diskUsagePct =
      diskSize > 0 ? Math.round(((diskSize - diskAvail) / diskSize) * 1000) / 10 : 0;

    return {
      cpuUsagePct: Math.round(cpuPct * 10) / 10,
      memoryUsedMb,
      diskUsagePct,
      networkRxKbps: Math.round(netRx),
      networkTxKbps: Math.round(netTx),
    };
  }
}
