import http from 'http';
import https from 'https';

export interface LokiLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  metadata?: Record<string, string>;
}

export interface LokiQueryResult {
  isConfigured: boolean;
  status: 'connected' | 'disconnected' | 'unconfigured' | 'active_platform_telemetry';
  totalLines: number;
  entries: LokiLogEntry[];
}

function makeLokiRequest(url: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const transport = isHttps ? https : http;

    const req = transport.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode} from Loki`));
      }
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error('Invalid JSON from Loki'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Loki request timeout'));
    });
  });
}

export class LokiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  public async queryLogs(queryLogQL = '{app=~".+"}', limit = 50): Promise<LokiQueryResult> {
    if (!this.baseUrl) {
      return {
        isConfigured: false,
        status: 'unconfigured',
        totalLines: 0,
        entries: [],
      };
    }

    try {
      const nowNs = Date.now() * 1000000;
      const startNs = (Date.now() - 3600 * 1000 * 24) * 1000000; // 24h
      const encodedQuery = encodeURIComponent(queryLogQL);
      const url = `${this.baseUrl}/loki/api/v1/query_range?query=${encodedQuery}&limit=${limit}&start=${startNs}&end=${nowNs}`;

      const res = await makeLokiRequest(url);
      const streams = res?.data?.result || [];
      const entries: LokiLogEntry[] = [];

      let idCounter = 0;
      for (const streamObj of streams) {
        const streamLabels = streamObj.stream || {};
        const sourceName = streamLabels.app || streamLabels.container_name || streamLabels.filename || 'system';

        for (const val of streamObj.values || []) {
          const rawTimeNs = val[0];
          const lineStr = val[1] || '';

          const timestamp = new Date(Number(BigInt(rawTimeNs) / BigInt(1000000))).toISOString();
          let level: LokiLogEntry['level'] = 'info';
          if (lineStr.toLowerCase().includes('error') || lineStr.toLowerCase().includes('err')) level = 'error';
          else if (lineStr.toLowerCase().includes('warn')) level = 'warn';
          else if (lineStr.toLowerCase().includes('debug')) level = 'debug';

          entries.push({
            id: `loki-${Date.now()}-${idCounter++}`,
            timestamp,
            level,
            source: sourceName,
            message: lineStr,
            metadata: streamLabels,
          });
        }
      }

      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        isConfigured: true,
        status: 'connected',
        totalLines: entries.length,
        entries: entries.slice(0, limit),
      };
    } catch (err) {
      return {
        isConfigured: true,
        status: 'disconnected',
        totalLines: 0,
        entries: [],
      };
    }
  }
}

