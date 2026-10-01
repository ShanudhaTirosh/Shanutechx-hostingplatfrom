import { prisma } from './prisma';
import { decryptSecret } from './secretsVault';
import { env } from '../env';
import { logger } from './logger';

export class WildDuckError extends Error {
  constructor(message: string, public status?: number, public details?: unknown) {
    super(message);
    this.name = 'WildDuckError';
  }
}

export interface MailHostTarget {
  apiUrl: string;
  apiKey: string;
}

export interface WildDuckUser {
  id: string;
  username: string;
  name?: string;
  quota?: number; // Quota in bytes
  usage?: number; // Used storage in bytes
  createdAt?: string;
}

export interface WildDuckAddress {
  id: string;
  address: string;
  name?: string;
  main?: boolean;
}

export interface WildDuckMailbox {
  id: string;
  path: string; // e.g. "INBOX", "Sent", "Trash", "Drafts", "Junk"
  name: string;
  total: number;
  unread: number;
}

export interface WildDuckMessageSummary {
  id: string;
  mailbox: string;
  from: { name?: string; address: string };
  to: { name?: string; address: string }[];
  subject: string;
  intro?: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  draft: boolean;
  attachments?: { filename: string; contentType: string; size: number }[];
}

export interface WildDuckMessageDetails extends WildDuckMessageSummary {
  text?: string;
  html?: string;
}

export interface SendMailOptions {
  from: string; // e.g. "John Doe <john@domain.com>" or "john@domain.com"
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}

export interface DkimRecordResult {
  domain: string;
  selector: string;
  publicKey: string;
  txtRecord: string;
}

import { getCached } from './redis';

export async function getMailHostTarget(mailHostId?: string | null): Promise<MailHostTarget> {
  const cacheKey = `mailhost:target:${mailHostId || 'default'}`;

  return getCached<MailHostTarget>(cacheKey, 120, async () => {
    if (mailHostId) {
      try {
        const host = await prisma.mailHost.findUnique({ where: { id: mailHostId } });
        if (host) {
          const apiKey = decryptSecret(host.apiKeyEnc, env.secretsEncryptionKey);
          return { apiUrl: host.apiUrl, apiKey };
        }
      } catch (_) {}
    }

    // Fallback to default MailHost in DB
    try {
      const defaultHost = await prisma.mailHost.findFirst({ where: { isDefault: true, status: 'healthy' } });
      if (defaultHost) {
        const apiKey = decryptSecret(defaultHost.apiKeyEnc, env.secretsEncryptionKey);
        return { apiUrl: defaultHost.apiUrl, apiKey };
      }
    } catch (_) {}

    // Fallback to environment variables
    return {
      apiUrl: (env.wildduckApiUrl || 'http://localhost:8080').replace(/\/$/, ''),
      apiKey: env.wildduckApiKey || '',
    };
  });
}

async function wildDuckRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    mailHostId?: string | null;
    hostTarget?: MailHostTarget;
  } = {}
): Promise<T> {
  const target = options.hostTarget || (await getMailHostTarget(options.mailHostId));
  const baseUrl = target.apiUrl.replace(/\/$/, '');
  const apiKey = target.apiKey;

  if (!apiKey) {
    throw new WildDuckError('WildDuck API Key (WILDDUCK_API_KEY) is not configured.');
  }

  let urlStr = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  if (options.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) params.append(k, String(v));
    }
    const q = params.toString();
    if (q) urlStr += `?${q}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Access-Token': apiKey,
  };

  const maxRetries = (options.method || 'GET') === 'GET' ? 3 : 1;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(urlStr, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = (data as any)?.error || (data as any)?.message || `HTTP ${res.status}`;
        throw new WildDuckError(`WildDuck API Error: ${errorMsg}`, res.status, data);
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof WildDuckError && err.status && err.status < 500) {
        throw err;
      }
      lastError = err;
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 200;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  logger.error({ err: lastError?.message, path, baseUrl }, 'WildDuck API connection failed after retries');
  throw new WildDuckError(`WildDuck connection error: ${lastError?.message || 'Request failed'}`);
}

export const wildduckClient = {
  // ── MAIL HOST CONNECTION VERIFICATION ─────────────────────────────────
  async testHostConnection(apiUrl: string, apiKey: string): Promise<{ success: boolean; status?: string; message?: string }> {
    try {
      const res = await wildDuckRequest<any>('/health', {
        hostTarget: { apiUrl, apiKey },
      });
      return { success: true, status: res.status || 'healthy' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to connect to WildDuck host node' };
    }
  },

  // ── USER MANAGEMENT ──────────────────────────────────────────────────
  async createUser(
    params: { username: string; password: string; name?: string; quotaGb?: number },
    mailHostId?: string | null
  ): Promise<WildDuckUser> {
    const quotaBytes = (params.quotaGb || 1) * 1024 * 1024 * 1024;
    const res = await wildDuckRequest<{ success: boolean; id: string }>('/users', {
      method: 'POST',
      mailHostId,
      body: {
        username: params.username.toLowerCase(),
        password: params.password,
        name: params.name || params.username,
        quota: quotaBytes,
      },
    });
    return { id: res.id, username: params.username, name: params.name, quota: quotaBytes };
  },

  async getUser(userId: string, mailHostId?: string | null): Promise<WildDuckUser> {
    const res = await wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}`, { mailHostId });
    return {
      id: res.id || userId,
      username: res.username,
      name: res.name,
      quota: res.quota,
      usage: res.quotaUsage || res.usage,
    };
  },

  async updateUser(
    userId: string,
    data: { password?: string; quotaGb?: number; name?: string },
    mailHostId?: string | null
  ): Promise<boolean> {
    const body: Record<string, unknown> = {};
    if (data.password) body.password = data.password;
    if (data.name) body.name = data.name;
    if (data.quotaGb) body.quota = data.quotaGb * 1024 * 1024 * 1024;

    const res = await wildDuckRequest<{ success: boolean }>(`/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      mailHostId,
      body,
    });
    return !!res.success;
  },

  async deleteUser(userId: string, mailHostId?: string | null): Promise<boolean> {
    const res = await wildDuckRequest<{ success: boolean }>(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      mailHostId,
    });
    return !!res.success;
  },

  // ── ADDRESS & ALIAS MANAGEMENT ─────────────────────────────────────
  async createAddress(userId: string, address: string, name?: string, mailHostId?: string | null): Promise<WildDuckAddress> {
    const res = await wildDuckRequest<{ success: boolean; id: string }>(`/users/${encodeURIComponent(userId)}/addresses`, {
      method: 'POST',
      mailHostId,
      body: { address: address.toLowerCase(), name },
    });
    return { id: res.id, address, name };
  },

  async listAddresses(userId: string, mailHostId?: string | null): Promise<WildDuckAddress[]> {
    const res = await wildDuckRequest<{ results: any[] }>(`/users/${encodeURIComponent(userId)}/addresses`, {
      mailHostId,
    });
    return (res.results || []).map((a) => ({
      id: a.id,
      address: a.address,
      name: a.name,
      main: a.main,
    }));
  },

  async deleteAddress(userId: string, addressId: string, mailHostId?: string | null): Promise<boolean> {
    const res = await wildDuckRequest<{ success: boolean }>(
      `/users/${encodeURIComponent(userId)}/addresses/${encodeURIComponent(addressId)}`,
      { method: 'DELETE', mailHostId }
    );
    return !!res.success;
  },

  // ── MAILBOX & MESSAGES ──────────────────────────────────────────────
  async listMailboxes(userId: string, mailHostId?: string | null): Promise<WildDuckMailbox[]> {
    const res = await wildDuckRequest<{ results: any[] }>(`/users/${encodeURIComponent(userId)}/mailboxes`, {
      mailHostId,
    });
    return (res.results || []).map((m) => ({
      id: m.id,
      path: m.path,
      name: m.name || m.path,
      total: m.total || 0,
      unread: m.unread || 0,
    }));
  },

  async listMessages(
    userId: string,
    options: { folder?: string; query?: string; page?: number; limit?: number } = {}
  ): Promise<{ messages: WildDuckMessageSummary[]; total: number }> {
    const queryParams: Record<string, string | number | undefined> = {
      page: options.page || 1,
      limit: options.limit || 50,
      query: options.query,
    };
    if (options.folder) {
      queryParams.mailbox = options.folder;
    }

    const res = await wildDuckRequest<{ total: number; results: any[] }>(
      `/users/${encodeURIComponent(userId)}/messages`,
      { query: queryParams }
    );

    const messages: WildDuckMessageSummary[] = (res.results || []).map((m) => ({
      id: m.id,
      mailbox: m.mailbox,
      from: { name: m.from?.name, address: m.from?.address || m.from },
      to: Array.isArray(m.to) ? m.to.map((t: any) => ({ name: t.name, address: t.address || t })) : [],
      subject: m.subject || '(No subject)',
      intro: m.intro || m.textSnippet || '',
      date: m.date || m.createdAt || new Date().toISOString(),
      seen: !!m.seen,
      flagged: !!m.flagged,
      draft: !!m.draft,
      attachments: m.attachments,
    }));

    return { messages, total: res.total || messages.length };
  },

  async getMessage(userId: string, messageId: string): Promise<WildDuckMessageDetails> {
    const res = await wildDuckRequest<any>(
      `/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}`
    );

    return {
      id: res.id,
      mailbox: res.mailbox,
      from: { name: res.from?.name, address: res.from?.address || res.from },
      to: Array.isArray(res.to) ? res.to.map((t: any) => ({ name: t.name, address: t.address || t })) : [],
      subject: res.subject || '(No subject)',
      intro: res.intro || '',
      text: res.text || res.bodyText,
      html: res.html || res.bodyHtml,
      date: res.date || new Date().toISOString(),
      seen: !!res.seen,
      flagged: !!res.flagged,
      draft: !!res.draft,
      attachments: res.attachments,
    };
  },

  async submitMessage(userId: string, options: SendMailOptions): Promise<{ success: boolean; messageId: string }> {
    const res = await wildDuckRequest<{ success: boolean; id: string }>(
      `/users/${encodeURIComponent(userId)}/submit`,
      {
        method: 'POST',
        body: {
          from: options.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: options.attachments,
        },
      }
    );
    return { success: !!res.success, messageId: res.id };
  },

  async updateMessageFlags(userId: string, messageId: string, flags: { seen?: boolean; flagged?: boolean }): Promise<boolean> {
    const res = await wildDuckRequest<{ success: boolean }>(
      `/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PUT',
        body: flags,
      }
    );
    return !!res.success;
  },

  async deleteMessage(userId: string, messageId: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success: boolean }>(
      `/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' }
    );
    return !!res.success;
  },

  // ── DKIM & DOMAIN MANAGEMENT ─────────────────────────────────────────
  async getOrCreateDkim(domain: string, selector = 'wildduck'): Promise<DkimRecordResult> {
    try {
      const existing = await wildDuckRequest<any>(`/dkim/${encodeURIComponent(domain)}`);
      if (existing && existing.publicKey) {
        return {
          domain,
          selector: existing.selector || selector,
          publicKey: existing.publicKey,
          txtRecord: `v=DKIM1; k=rsa; p=${existing.publicKey}`,
        };
      }
    } catch (_) {}

    const res = await wildDuckRequest<any>('/dkim', {
      method: 'POST',
      body: { domain, selector },
    });

    const pubKey = res.publicKey || res.key || '';
    return {
      domain,
      selector,
      publicKey: pubKey,
      txtRecord: `v=DKIM1; k=rsa; p=${pubKey}`,
    };
  },

  async listDomains(): Promise<any[]> {
    const res = await wildDuckRequest<{ results?: any[] }>('/domains').catch(() => ({ results: [] }));
    return res.results || [];
  },

  async createDomain(domain: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>('/domains', {
      method: 'POST',
      body: { domain: domain.toLowerCase() },
    }).catch(() => ({ success: false }));
    return !!res.success;
  },

  async deleteDomain(domain: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(`/domains/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
    }).catch(() => ({ success: false }));
    return !!res.success;
  },

  // ── HEALTH, QUEUES & SYSTEM SYSTEM ──────────────────────────────────
  async getHealth(): Promise<any> {
    return wildDuckRequest<any>('/health').catch(() => ({ status: 'yellow', services: {} }));
  },

  async getMetrics(): Promise<string> {
    const baseUrl = (env.wildduckApiUrl || 'http://localhost:8080').replace(/\/$/, '');
    const apiKey = env.wildduckApiKey;
    if (!apiKey) return '';
    try {
      const res = await fetch(`${baseUrl}/metrics`, { headers: { 'X-Access-Token': apiKey } });
      return await res.text();
    } catch {
      return '';
    }
  },

  async listTasks(): Promise<any[]> {
    const res = await wildDuckRequest<{ results?: any[] }>('/tasks').catch(() => ({ results: [] }));
    return res.results || [];
  },

  async getTask(taskId: string): Promise<any> {
    return wildDuckRequest<any>(`/tasks/${encodeURIComponent(taskId)}`).catch(() => null);
  },

  async requeueTask(taskId: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(`/tasks/${encodeURIComponent(taskId)}/requeue`, {
      method: 'POST',
    }).catch(() => ({ success: false }));
    return !!res.success;
  },

  async getAuditLog(query: Record<string, string | number> = {}): Promise<any[]> {
    const res = await wildDuckRequest<{ results?: any[] }>('/audit', { query }).catch(() => ({ results: [] }));
    return res.results || [];
  },

  // ── MAILBOXES, FILTERS, AUTOREPLIES & SECURITY ─────────────────────
  async createMailbox(userId: string, path: string, name?: string): Promise<WildDuckMailbox> {
    const res = await wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}/mailboxes`, {
      method: 'POST',
      body: { path, name: name || path },
    });
    return { id: res.id || path, path, name: name || path, total: 0, unread: 0 };
  },

  async deleteMailbox(userId: string, mailboxId: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(
      `/users/${encodeURIComponent(userId)}/mailboxes/${encodeURIComponent(mailboxId)}`,
      { method: 'DELETE' }
    );
    return !!res.success;
  },

  async listFilters(userId: string): Promise<any[]> {
    const res = await wildDuckRequest<{ results?: any[] }>(`/users/${encodeURIComponent(userId)}/filters`).catch(() => ({ results: [] }));
    return res.results || [];
  },

  async createFilter(userId: string, filter: any): Promise<any> {
    return wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}/filters`, {
      method: 'POST',
      body: filter,
    });
  },

  async deleteFilter(userId: string, filterId: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(
      `/users/${encodeURIComponent(userId)}/filters/${encodeURIComponent(filterId)}`,
      { method: 'DELETE' }
    ).catch(() => ({ success: false }));
    return !!res.success;
  },

  async getAutoreply(userId: string): Promise<any> {
    return wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}/autoreplies`).catch(() => null);
  },

  async setAutoreply(userId: string, options: { enabled: boolean; name?: string; subject?: string; message?: string }): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(`/users/${encodeURIComponent(userId)}/autoreplies`, {
      method: 'POST',
      body: options,
    }).catch(() => ({ success: false }));
    return !!res.success;
  },

  async listApplicationPasswords(userId: string): Promise<any[]> {
    const res = await wildDuckRequest<{ results?: any[] }>(`/users/${encodeURIComponent(userId)}/application-passwords`).catch(() => ({ results: [] }));
    return res.results || [];
  },

  async createApplicationPassword(userId: string, name: string): Promise<any> {
    return wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}/application-passwords`, {
      method: 'POST',
      body: { name },
    });
  },

  async deleteApplicationPassword(userId: string, id: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(
      `/users/${encodeURIComponent(userId)}/application-passwords/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    ).catch(() => ({ success: false }));
    return !!res.success;
  },

  async listMcpTokens(userId: string): Promise<any[]> {
    const res = await wildDuckRequest<{ results?: any[] }>(`/users/${encodeURIComponent(userId)}/mcp-tokens`).catch(() => ({ results: [] }));
    return res.results || [];
  },

  async createMcpToken(userId: string, name: string, scopes: string[]): Promise<any> {
    return wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}/mcp-tokens`, {
      method: 'POST',
      body: { name, scopes },
    });
  },

  async deleteMcpToken(userId: string, id: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(
      `/users/${encodeURIComponent(userId)}/mcp-tokens/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    ).catch(() => ({ success: false }));
    return !!res.success;
  },

  async get2faStatus(userId: string): Promise<any> {
    return wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}/two-factor-auth`).catch(() => ({ enabled: false }));
  },

  async disable2fa(userId: string, reason?: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success?: boolean }>(`/users/${encodeURIComponent(userId)}/two-factor-auth`, {
      method: 'DELETE',
      body: { reason },
    }).catch(() => ({ success: false }));
    return !!res.success;
  },

  async getDkimKey(domain: string, mailHostId?: string | null): Promise<DkimRecordResult | null> {
    return wildDuckRequest<DkimRecordResult>(`/dkim/${encodeURIComponent(domain)}`, { mailHostId }).catch(() => null);
  },

  async createDkimKey(domain: string, selector = 'wildduck', mailHostId?: string | null): Promise<DkimRecordResult | null> {
    return wildDuckRequest<DkimRecordResult>(`/dkim`, {
      method: 'POST',
      body: { domain, selector },
      mailHostId,
    }).catch(() => null);
  },
};

