import { apiFetch } from './useAuth';

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? (typeof body.error === 'string' ? body.error : JSON.stringify(body.error)) : `Request failed (${res.status})`);
  }
  return res.json();
}

export interface SupabaseHealth {
  status: 'healthy' | 'degraded';
  services: {
    kong: string;
    gotrue: string;
    postgrest: string;
    postgres: string;
    storage: string;
    realtime: string;
    functions: string;
    studio: string;
  };
  urls: {
    kong: string;
    studio: string;
    meta: string;
  };
  timestamp: string;
}

export interface SupabaseAuthUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  user_metadata?: Record<string, any>;
}

export interface SupabaseDbTable {
  name: string;
  schema: string;
  rows_count?: number;
  bytes?: number;
}

export interface SupabaseStorageBucket {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
}

export interface SupabaseEdgeFunction {
  id: string;
  name: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/** Matches the full `ClientProject` interface returned by the API's `serializeProject()` */
export interface ClientSupabaseProject {
  id: string;
  name: string;
  clientEmail: string;
  dbName: string;
  region: string;
  status: 'ACTIVE' | 'PROVISIONING' | 'STOPPED' | 'FAILED' | 'SUSPENDED';
  errorMessage?: string | null;
  anonKey: string;
  serviceKey: string;
  hasServiceKey: boolean;
  smtpConfigured: boolean;
  studioPort?: number;
  apiPort?: number;
  dbPort?: number;
  storageLimitMb?: number;
  extensions?: string[];
  authSettingsJson?: Record<string, any>;
  poolerSettingsJson?: Record<string, any>;
  nodeId?: string | null;
  nodeIp?: string | null;
  nodeLabel?: string | null;
  subdomain?: string;
  studioUrl?: string;
  apiUrl?: string;
  metaUrl?: string;
  dbUrl?: string;
  resourceUsage?: {
    cpuPct: number;
    ramMb: number;
    diskMb: number;
    dbSizeMb: number;
  };
  createdAt: string;
}

export interface SupabaseSmtpConfig {
  host: string;
  port: number;
  user: string;
  senderEmail: string;
  senderName: string;
  enableEmailSignup: boolean;
  enableAutoconfirm: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
}

export interface SmtpDeliveryLog {
  id: string;
  recipient: string;
  subject: string;
  templateId?: string;
  status: 'DELIVERED' | 'FAILED';
  messageId?: string;
  smtpHost: string;
  errorMessage?: string;
  timestamp: string;
}

export interface ProjectStats {
  cpuPct: number;
  ramMb: number;
  diskMb: number;
  dbSizeMb: number;
}

export function getCentralStudioUrl(project?: ClientSupabaseProject | null, subpath?: string): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'shanutechx.com';
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const base = isLocal ? 'http://localhost:8000' : `https://studio.${rootDomain}`;

  if (project?.studioUrl) {
    const projectUrl = project.studioUrl;
    if (!subpath) return projectUrl;
    const cleanSubpath = subpath.startsWith('/') ? subpath : `/${subpath}`;
    return `${projectUrl.replace(/\/+$/, '')}${cleanSubpath}`;
  }

  if (!project) return base;
  const cleanSubpath = subpath ? (subpath.startsWith('/') ? subpath : `/${subpath}`) : '';
  return `${base}/project/${project.id}${cleanSubpath}`;
}

export const supabaseAdmin = {
  health: () => apiFetch('/api/supabase/health').then((r) => asJson<SupabaseHealth>(r)),

  projects: {
    list: () =>
      apiFetch('/api/supabase/projects').then((r) =>
        asJson<{ projects: ClientSupabaseProject[]; total: number }>(r)
      ),

    get: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}`).then((r) =>
        asJson<{ project: ClientSupabaseProject }>(r)
      ),

    create: (data: { name: string; clientEmail: string; region?: string; nodeId?: string }) =>
      apiFetch('/api/supabase/projects', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ project: ClientSupabaseProject }>(r)
      ),

    delete: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),

    start: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/start`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: ClientSupabaseProject }>(r)
      ),

    stop: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/stop`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: ClientSupabaseProject }>(r)
      ),

    restart: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/restart`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: ClientSupabaseProject }>(r)
      ),

    retry: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/retry`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: ClientSupabaseProject }>(r)
      ),

    getStats: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/stats`).then((r) =>
        asJson<{ ok: boolean; stats: ProjectStats }>(r)
      ),

    updateConfig: (id: string, config: Record<string, any>) =>
      apiFetch(`/api/supabase/projects/${id}/config`, {
        method: 'PATCH',
        body: JSON.stringify(config),
      }).then((r) => asJson<{ ok: boolean; project: ClientSupabaseProject }>(r)),
  },

  smtp: {
    getConfig: () =>
      apiFetch('/api/supabase/smtp/config').then((r) =>
        asJson<{ smtpConfig: SupabaseSmtpConfig; hasPassword: boolean }>(r)
      ),
    saveConfig: (data: Partial<SupabaseSmtpConfig & { pass?: string }>) =>
      apiFetch('/api/supabase/smtp/config', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; smtpConfig: SupabaseSmtpConfig }>(r)
      ),
    verifyConnection: () =>
      apiFetch('/api/supabase/smtp/verify', { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; message: string; latencyMs: number }>(r)
      ),
    sendTestEmail: (recipientEmail?: string, templateId?: string) =>
      apiFetch('/api/supabase/smtp/test-email', {
        method: 'POST',
        body: JSON.stringify({ recipientEmail, templateId }),
      }).then((r) =>
        asJson<{ ok: boolean; delivered: boolean; recipient: string; messageId: string; response: string; timestamp: string }>(r)
      ),
    getTemplates: () =>
      apiFetch('/api/supabase/smtp/templates').then((r) =>
        asJson<{ templates: EmailTemplate[] }>(r)
      ),
    saveTemplate: (id: string, data: { subject: string; html: string }) =>
      apiFetch('/api/supabase/smtp/templates', {
        method: 'POST',
        body: JSON.stringify({ id, ...data }),
      }).then((r) => asJson<{ ok: boolean; template: EmailTemplate }>(r)),
    getLogs: () =>
      apiFetch('/api/supabase/smtp/logs').then((r) => asJson<{ logs: SmtpDeliveryLog[] }>(r)),
  },

  auth: {
    users: (projectId?: string) => {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      return apiFetch(`/api/supabase/auth/users${q}`).then((r) =>
        asJson<{ users: SupabaseAuthUser[]; total: number }>(r)
      );
    },
    createUser: (
      data: { email: string; password: string; user_metadata?: Record<string, any>; projectId?: string },
      projectId?: string
    ) => {
      const payload = { ...data, projectId: projectId || data.projectId };
      return apiFetch('/api/supabase/auth/users', { method: 'POST', body: JSON.stringify(payload) }).then((r) =>
        asJson<SupabaseAuthUser>(r)
      );
    },
    sendResetPassword: (id: string, email?: string, projectId?: string) =>
      apiFetch(`/api/supabase/auth/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ email, projectId }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    updateUser: (
      id: string,
      data: { banned?: boolean; role?: string; user_metadata?: Record<string, any>; projectId?: string },
      projectId?: string
    ) => {
      const payload = { ...data, projectId: projectId || data.projectId };
      return apiFetch(`/api/supabase/auth/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }).then((r) => asJson<{ ok: boolean; user?: SupabaseAuthUser }>(r));
    },
    deleteUser: (id: string, projectId?: string) => {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      return apiFetch(`/api/supabase/auth/users/${id}${q}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      );
    },
  },

  db: {
    schemas: (projectId?: string) => {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      return apiFetch(`/api/supabase/db/schemas${q}`).then((r) =>
        asJson<{ schemas: Array<{ name: string; owner: string }> }>(r)
      );
    },
    tables: (projectId?: string) => {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      return apiFetch(`/api/supabase/db/tables${q}`).then((r) =>
        asJson<{ tables: SupabaseDbTable[] }>(r)
      );
    },
    query: (sql: string, projectId?: string) =>
      apiFetch('/api/supabase/db/query', { method: 'POST', body: JSON.stringify({ sql, projectId }) }).then((r) =>
        asJson<{ rows: Record<string, any>[]; rowCount: number }>(r)
      ),
  },

  storage: {
    buckets: (projectId?: string) => {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      return apiFetch(`/api/supabase/storage/buckets${q}`).then((r) =>
        asJson<{ buckets: SupabaseStorageBucket[] }>(r)
      );
    },
    createBucket: (
      data: { id: string; name: string; isPublic: boolean; projectId?: string },
      projectId?: string
    ) => {
      const payload = { ...data, projectId: projectId || data.projectId };
      return apiFetch('/api/supabase/storage/buckets', { method: 'POST', body: JSON.stringify(payload) }).then((r) =>
        asJson<SupabaseStorageBucket>(r)
      );
    },
  },

  functions: {
    list: () =>
      apiFetch('/api/supabase/functions').then((r) =>
        asJson<{ functions: SupabaseEdgeFunction[] }>(r)
      ),
    create: (data: { name: string; code?: string }) =>
      apiFetch('/api/supabase/functions', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ function: SupabaseEdgeFunction }>(r)
      ),
    invoke: (name: string, payload: any) =>
      apiFetch(`/api/supabase/functions/${name}/invoke`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((r) =>
        asJson<{ status: number; ok: boolean; executionTimeMs: number; response: any }>(r)
      ),
  },

  realtime: {
    broadcast: (data: { channel: string; event: string; payload: any }) =>
      apiFetch('/api/supabase/realtime/broadcast', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; channel: string; event: string; dispatchedAt: string }>(r)
      ),
  },

  advisors: () =>
    apiFetch('/api/supabase/advisors').then((r) =>
      asJson<{
        security: Array<{ id: string; title: string; category: string; severity: string; description: string; remediation: string }>;
        performance: Array<{ id: string; title: string; category: string; severity: string; description: string; remediation: string }>;
        scannedAt: string;
      }>(r)
    ),

  observability: () =>
    apiFetch('/api/supabase/observability').then((r) =>
      asJson<{
        metrics: {
          cpuUsagePercent: number;
          memoryUsedMb: number;
          memoryTotalMb: number;
          activeConnections: number;
          maxConnections: number;
          diskIops: number;
          avgQueryLatencyMs: number;
          cacheHitRatePercent: number;
        };
        timestamp: string;
      }>(r)
    ),

  logs: (service = 'all') =>
    apiFetch(`/api/supabase/logs?service=${service}`).then((r) =>
      asJson<{ logs: Array<{ id: string; timestamp: string; service: string; level: string; message: string }> }>(r)
    ),

  integrations: () =>
    apiFetch('/api/supabase/integrations').then((r) =>
      asJson<{
        webhooks: Array<{ id: string; name: string; table: string; events: string[]; url: string; status: string }>;
        vaultSecrets: Array<{ id: string; name: string; keyName: string; description: string; updatedAt: string }>;
        fdw: Array<{ id: string; name: string; wrapper: string; serverName: string; status: string }>;
      }>(r)
    ),

  config: () =>
    apiFetch('/api/supabase/config').then((r) =>
      asJson<{ supabaseUrl: string; anonKey: string; serviceRoleKey: string; studioUrl: string; smtpConfigured: boolean }>(r)
    ),
};
