import { apiFetch } from './useAuth';

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? (typeof body.error === 'string' ? body.error : JSON.stringify(body.error)) : `Request failed (${res.status})`);
  }
  return res.json();
}

export interface SecretItem {
  id: string;
  key: string;
  value: string;
  comment?: string;
  updatedAt: string;
}

export interface SecretProjectSummary {
  id: string;
  name: string;
  environment: 'development' | 'staging' | 'production';
  secretCount: number;
  createdAt: string;
}

export interface SecretProject {
  id: string;
  name: string;
  environment: 'development' | 'staging' | 'production';
  secrets: SecretItem[];
  createdAt: string;
}

export interface SecretAuditEntry {
  id: string;
  projectId: string;
  projectName: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT';
  actorEmail: string;
  timestamp: string;
}

export const secretsApi = {
  projects: {
    list: () => apiFetch('/api/secrets/projects').then((r) => asJson<{ projects: SecretProjectSummary[] }>(r)),
    get: (id: string) => apiFetch(`/api/secrets/projects/${id}`).then((r) => asJson<{ project: SecretProject }>(r)),
    create: (data: { name: string; environment?: 'development' | 'staging' | 'production' }) =>
      apiFetch('/api/secrets/projects', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ project: SecretProject }>(r)
      ),
  },

  secrets: {
    save: (projectId: string, data: { key: string; value: string; comment?: string }) =>
      apiFetch(`/api/secrets/projects/${projectId}/secrets`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ project: SecretProject }>(r)
      ),
    bulkImport: (projectId: string, items: Array<{ key: string; value: string; comment?: string }>) =>
      apiFetch(`/api/secrets/projects/${projectId}/bulk-secrets`, { method: 'POST', body: JSON.stringify({ items }) }).then((r) =>
        asJson<{ ok: boolean; project: SecretProject; countAdded: number; countUpdated: number; total: number }>(r)
      ),
    delete: (projectId: string, key: string) =>
      apiFetch(`/api/secrets/projects/${projectId}/secrets/${encodeURIComponent(key)}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedKey: string }>(r)
      ),
  },

  audit: {
    logs: () => apiFetch('/api/secrets/audit').then((r) => asJson<{ auditLogs: SecretAuditEntry[] }>(r)),
  },
};
