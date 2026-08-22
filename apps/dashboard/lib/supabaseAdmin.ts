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

export interface ClientSupabaseProject {
  id: string;
  name: string;
  clientEmail: string;
  dbName: string;
  region: string;
  status: 'ACTIVE' | 'PROVISIONING' | 'SUSPENDED';
  anonKey: string;
  serviceKey: string;
  smtpConfigured: boolean;
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

export const supabaseAdmin = {
  health: () => apiFetch('/api/supabase/health').then((r) => asJson<SupabaseHealth>(r)),

  projects: {
    list: () => apiFetch('/api/supabase/projects').then((r) => asJson<{ projects: ClientSupabaseProject[]; total: number }>(r)),
    create: (data: { name: string; clientEmail: string; region?: string }) =>
      apiFetch('/api/supabase/projects', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ project: ClientSupabaseProject }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),
  },

  smtp: {
    getConfig: () => apiFetch('/api/supabase/smtp/config').then((r) => asJson<{ smtpConfig: SupabaseSmtpConfig; hasPassword: boolean }>(r)),
    saveConfig: (data: Partial<SupabaseSmtpConfig & { pass?: string }>) =>
      apiFetch('/api/supabase/smtp/config', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; smtpConfig: SupabaseSmtpConfig }>(r)
      ),
    verifyConnection: () =>
      apiFetch('/api/supabase/smtp/verify', { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; message: string; latencyMs: number }>(r)
      ),
    sendTestEmail: (recipientEmail?: string, templateId?: string) =>
      apiFetch('/api/supabase/smtp/test-email', { method: 'POST', body: JSON.stringify({ recipientEmail, templateId }) }).then((r) =>
        asJson<{ ok: boolean; delivered: boolean; recipient: string; messageId: string; response: string; timestamp: string }>(r)
      ),
    getTemplates: () => apiFetch('/api/supabase/smtp/templates').then((r) => asJson<{ templates: EmailTemplate[] }>(r)),
    saveTemplate: (id: string, data: { subject: string; html: string }) =>
      apiFetch('/api/supabase/smtp/templates', { method: 'POST', body: JSON.stringify({ id, ...data }) }).then((r) =>
        asJson<{ ok: boolean; template: EmailTemplate }>(r)
      ),
    getLogs: () => apiFetch('/api/supabase/smtp/logs').then((r) => asJson<{ logs: SmtpDeliveryLog[] }>(r)),
  },

  auth: {
    users: () => apiFetch('/api/supabase/auth/users').then((r) => asJson<{ users: SupabaseAuthUser[]; total: number }>(r)),
    createUser: (data: { email: string; password: string; user_metadata?: Record<string, any> }) =>
      apiFetch('/api/supabase/auth/users', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<SupabaseAuthUser>(r)
      ),
    deleteUser: (id: string) =>
      apiFetch(`/api/supabase/auth/users/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),
  },

  db: {
    schemas: () => apiFetch('/api/supabase/db/schemas').then((r) => asJson<{ schemas: Array<{ name: string; owner: string }> }>(r)),
    tables: () => apiFetch('/api/supabase/db/tables').then((r) => asJson<{ tables: SupabaseDbTable[] }>(r)),
    query: (sql: string) =>
      apiFetch('/api/supabase/db/query', { method: 'POST', body: JSON.stringify({ sql }) }).then((r) =>
        asJson<{ rows: Record<string, any>[]; rowCount: number }>(r)
      ),
  },

  storage: {
    buckets: () => apiFetch('/api/supabase/storage/buckets').then((r) => asJson<{ buckets: SupabaseStorageBucket[] }>(r)),
    createBucket: (data: { id: string; name: string; isPublic: boolean }) =>
      apiFetch('/api/supabase/storage/buckets', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<SupabaseStorageBucket>(r)
      ),
  },

  functions: {
    list: () => apiFetch('/api/supabase/functions').then((r) => asJson<{ functions: SupabaseEdgeFunction[] }>(r)),
  },

  config: () =>
    apiFetch('/api/supabase/config').then((r) =>
      asJson<{ supabaseUrl: string; anonKey: string; serviceRoleKey: string; studioUrl: string; smtpConfigured: boolean }>(r)
    ),
};
