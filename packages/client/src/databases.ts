import type {
  ManagedDatabase,
  ManagedDatabaseCreateInput,
} from '@shanutechx/types';
import { BaseClient } from './base.js';

export class DatabasesResource extends BaseClient {
  async list(): Promise<ManagedDatabase[]> {
    const res = await this.httpGet<{ databases: ManagedDatabase[] }>('/api/databases');
    return res.databases;
  }

  async get(id: string): Promise<ManagedDatabase> {
    return this.httpGet<ManagedDatabase>(`/api/databases/${id}`);
  }

  async create(input: ManagedDatabaseCreateInput): Promise<ManagedDatabase> {
    return this.httpPost<ManagedDatabase>('/api/databases', input);
  }

  async delete(id: string): Promise<void> {
    return this.httpDelete(`/api/databases/${id}`);
  }

  async getConnectionString(id: string): Promise<string> {
    const db = await this.get(id);
    return db.connectionString ?? '';
  }
}
