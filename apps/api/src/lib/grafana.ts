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

function makeGrafanaRequest(url: string, apiKey?: string, timeoutMs = 4000): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const transport = isHttps ? https : http;

    const parsedUrl = new URL(url);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey) {
      headers.Authorization = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    }

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
          return reject(new Error(`HTTP ${res.statusCode} from Grafana`));
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error('Invalid JSON from Grafana'));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Grafana request timeout'));
    });
  });
}

export class GrafanaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.apiKey = apiKey || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  public async fetchHealth(): Promise<{ database: string; version: string; commit: string } | null> {
    if (!this.baseUrl) return null;
    try {
      return await makeGrafanaRequest(`${this.baseUrl}/api/health`, this.apiKey);
    } catch (err) {
      return null;
    }
  }

  public async getClusterMetrics(): Promise<GrafanaClusterMetrics> {
    if (!this.baseUrl) {
      return {
        isConfigured: false,
        status: 'unconfigured',
        version: 'N/A',
        databaseStatus: 'N/A',
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
        version: 'N/A',
        databaseStatus: 'disconnected',
        cpuUsagePct: 0,
        memoryUsagePct: 0,
        activeContainersCount: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        throughputRps: 0,
        metricsHistory: [],
      };
    }

    return {
      isConfigured: true,
      status: 'connected',
      version: health.version || 'v10.4.0',
      databaseStatus: health.database || 'ok',
      cpuUsagePct: 0,
      memoryUsagePct: 0,
      activeContainersCount: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      throughputRps: 0,
      metricsHistory: [],
    };
  }

  public async fetchDashboards(): Promise<Array<{ id: number; uid: string; title: string; url: string; tags: string[] }>> {
    if (!this.baseUrl) return [];
    try {
      const res = await makeGrafanaRequest(`${this.baseUrl}/api/search?type=dash-db`, this.apiKey);
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return [];
    }
  }

  public async getNodeTelemetry(_nodeIp: string): Promise<{ cpuUsagePct: number; memoryUsedMb: number; diskUsagePct: number; networkRxKbps: number; networkTxKbps: number }> {
    return {
      cpuUsagePct: 0,
      memoryUsedMb: 0,
      diskUsagePct: 0,
      networkRxKbps: 0,
      networkTxKbps: 0,
    };
  }
}

