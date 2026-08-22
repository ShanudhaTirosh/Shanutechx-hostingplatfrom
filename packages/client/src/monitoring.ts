import { BaseClient } from './base.js';

export interface Monitor {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'dns' | 'ssl';
  target: string;
  interval: number;
  status: 'up' | 'down' | 'pending';
  lastCheckedAt: string | null;
  uptimePercent: number;
}

export interface MonitorCreateInput {
  name: string;
  type: 'http' | 'tcp' | 'dns' | 'ssl';
  target: string;
  interval?: number;
  discordWebhookUrl?: string;
}

export class MonitoringResource extends BaseClient {
  async list(): Promise<Monitor[]> {
    const res = await this.httpGet<{ monitors: Monitor[] }>('/api/monitoring');
    return res.monitors;
  }

  async get(id: string): Promise<Monitor> {
    return this.httpGet<Monitor>(`/api/monitoring/${id}`);
  }

  async create(input: MonitorCreateInput): Promise<Monitor> {
    return this.httpPost<Monitor>('/api/monitoring', input);
  }

  async delete(id: string): Promise<void> {
    return this.httpDelete(`/api/monitoring/${id}`);
  }
}
