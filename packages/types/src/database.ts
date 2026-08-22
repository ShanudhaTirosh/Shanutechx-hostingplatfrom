// ─── Managed Database Types ───────────────────────────────────────────────

export type DbEngine = 'postgresql' | 'mysql' | 'mongodb' | 'redis';

export type DbStatus = 'provisioning' | 'running' | 'stopped' | 'error';

export interface ManagedDatabase {
  id: string;
  userId: string;
  nodeId: string;
  engine: DbEngine;
  name: string;
  status: DbStatus;
  host: string | null;
  port: number | null;
  databaseName: string;
  username: string;
  /** Connection string (may be masked) */
  connectionString: string | null;
  version: string | null;
  storageGb: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedDatabaseCreateInput {
  engine: DbEngine;
  name: string;
  nodeId: string;
  databaseName?: string;
  username?: string;
  password?: string;
  storageGb?: number;
  version?: string;
}
