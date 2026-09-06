import type {
  ManagedDatabase,
  ManagedDatabaseCreateInput,
} from '@shanutechx/types';
import { BaseClient } from './base.js';

export class DatabasesResource extends BaseClient {
  async list(): Promise<ManagedDatabase[]> {
    const res = await this.httpGet<{ databases: ManagedDatabase[] }>('/api/managed-databases');
    return res.databases;
  }

  async get(id: string): Promise<ManagedDatabase> {
    const list = await this.list();
    const found = list.find((db) => db.id === id);
    if (!found) {
      throw new Error(`Managed database ${id} not found`);
    }
    return found;
  }

  async create(input: ManagedDatabaseCreateInput): Promise<ManagedDatabase> {
    const res = await this.httpPost<{ database: ManagedDatabase }>('/api/managed-databases', input);
    return res.database;
  }

  async delete(id: string): Promise<void> {
    return this.httpDelete(`/api/managed-databases/${id}`);
  }

  async getConnectionString(id: string): Promise<string> {
    const res = await this.httpGet<{ connectionString: string }>(`/api/managed-databases/${id}/connection`);
    return res.connectionString ?? '';
  }

  async migrate(id: string, targetNodeId?: string): Promise<{ ok: boolean; message: string; database: ManagedDatabase }> {
    return this.httpPost<{ ok: boolean; message: string; database: ManagedDatabase }>(`/api/managed-databases/${id}/migrate`, { targetNodeId });
  }

  async scale(
    id: string,
    params: { cpuLimit?: number; memoryLimitMb?: number; storageLimitGb?: number; maxConnections?: number; dbVersion?: string }
  ): Promise<{ ok: boolean; message: string; database: ManagedDatabase }> {
    return this.httpPost<{ ok: boolean; message: string; database: ManagedDatabase }>(`/api/managed-databases/${id}/scale`, params);
  }
}

