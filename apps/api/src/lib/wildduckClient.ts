import { env } from '../env';
import { logger } from './logger';

export class WildDuckError extends Error {
  constructor(message: string, public status?: number, public details?: unknown) {
    super(message);
    this.name = 'WildDuckError';
  }
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

async function wildDuckRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const baseUrl = (env.wildduckApiUrl || 'http://localhost:8080').replace(/\/$/, '');
  const apiKey = env.wildduckApiKey || '';

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

  try {
    const res = await fetch(urlStr, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = (data as any)?.error || (data as any)?.message || `HTTP ${res.status}`;
      throw new WildDuckError(`WildDuck API Error: ${errorMsg}`, res.status, data);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof WildDuckError) throw err;
    logger.error({ err: err.message, path }, 'WildDuck API connection failed');
    throw new WildDuckError(`WildDuck connection error: ${err.message}`);
  }
}

export const wildduckClient = {
  // ── USER MANAGEMENT ──────────────────────────────────────────────────
  async createUser(params: { username: string; password: string; name?: string; quotaGb?: number }): Promise<WildDuckUser> {
    const quotaBytes = (params.quotaGb || 1) * 1024 * 1024 * 1024;
    const res = await wildDuckRequest<{ success: boolean; id: string }>('/users', {
      method: 'POST',
      body: {
        username: params.username.toLowerCase(),
        password: params.password,
        name: params.name || params.username,
        quota: quotaBytes,
      },
    });
    return { id: res.id, username: params.username, name: params.name, quota: quotaBytes };
  },

  async getUser(userId: string): Promise<WildDuckUser> {
    const res = await wildDuckRequest<any>(`/users/${encodeURIComponent(userId)}`);
    return {
      id: res.id || userId,
      username: res.username,
      name: res.name,
      quota: res.quota,
      usage: res.quotaUsage || res.usage,
    };
  },

  async updateUser(userId: string, data: { password?: string; quotaGb?: number; name?: string }): Promise<boolean> {
    const body: Record<string, unknown> = {};
    if (data.password) body.password = data.password;
    if (data.name) body.name = data.name;
    if (data.quotaGb) body.quota = data.quotaGb * 1024 * 1024 * 1024;

    const res = await wildDuckRequest<{ success: boolean }>(`/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body,
    });
    return !!res.success;
  },

  async deleteUser(userId: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success: boolean }>(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    return !!res.success;
  },

  // ── ADDRESS & ALIAS MANAGEMENT ─────────────────────────────────────
  async createAddress(userId: string, address: string, name?: string): Promise<WildDuckAddress> {
    const res = await wildDuckRequest<{ success: boolean; id: string }>(`/users/${encodeURIComponent(userId)}/addresses`, {
      method: 'POST',
      body: { address: address.toLowerCase(), name },
    });
    return { id: res.id, address, name };
  },

  async listAddresses(userId: string): Promise<WildDuckAddress[]> {
    const res = await wildDuckRequest<{ results: any[] }>(`/users/${encodeURIComponent(userId)}/addresses`);
    return (res.results || []).map((a) => ({
      id: a.id,
      address: a.address,
      name: a.name,
      main: a.main,
    }));
  },

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const res = await wildDuckRequest<{ success: boolean }>(
      `/users/${encodeURIComponent(userId)}/addresses/${encodeURIComponent(addressId)}`,
      { method: 'DELETE' }
    );
    return !!res.success;
  },

  // ── MAILBOX & MESSAGES ──────────────────────────────────────────────
  async listMailboxes(userId: string): Promise<WildDuckMailbox[]> {
    const res = await wildDuckRequest<{ results: any[] }>(`/users/${encodeURIComponent(userId)}/mailboxes`);
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
};
