import Constants from 'expo-constants';
import { auth } from './firebase';

export const API_BASE: string = Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://api.shanutechx.com';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Same pattern as apps/dashboard/lib/useAuth.ts's apiFetch — attaches the
 * current Firebase ID token as a Bearer header. The API server (see
 * apps/api/src/middleware/auth.ts) doesn't care whether the token came from
 * the web app or this one; a valid Firebase ID token is a valid Firebase ID
 * token.
 */
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.error ?? body;
    } catch {
      // body wasn't JSON — use as-is
    }
    throw new ApiError(typeof message === 'string' ? message : JSON.stringify(message), res.status);
  }

  return res;
}

async function asJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ── Types (mirrored from apps/dashboard/lib/types.ts for the fields this app uses) ──

export interface Payment {
  id: string;
  orderId: string;
  method: string;
  proofUrl: string | null;
  extractedJson?: Record<string, any> | null;
  confidenceScore?: number | null;
  status: string;
  createdAt: string;
  reviewedById: string | null;
  reviewedBy?: { id: string; email: string; displayName?: string | null } | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  order?: {
    id: string;
    totalLkr: number;
    total?: number;
    currency: string;
    user?: { email: string; displayName?: string | null };
    items?: Array<{ id: string; quantity: number; service?: { name: string }; plan?: { name: string } }>;
  };
}

export interface Deployment {
  id: string;
  name: string;
  status: 'building' | 'running' | 'failed' | 'stopped' | 'terminated';
  image: string;
  tag: string;
  nodeId: string | null;
  customSubdomain: string | null;
  publicUrl: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: { email: string; displayName?: string | null };
  node?: { label: string; ip: string };
  envVars?: Array<{ key: string }>;
}

export interface DeploymentLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
}

export interface Node {
  id: string;
  label: string;
  ip: string;
  region: string | null;
  status: 'online' | 'offline' | 'degraded';
  cpuUsedPct: number | null;
  ramUsedPct: number | null;
  diskUsedPct: number | null;
  totalRamGb: number | null;
  totalDiskGb: number | null;
  deploymentCount: number;
  createdAt: string;
}

export interface ManagedDatabase {
  id: string;
  name: string;
  engine: 'postgres' | 'mysql' | 'redis' | 'mongodb';
  status: 'running' | 'stopped' | 'failed';
  nodeId: string | null;
  userId: string;
  user?: { email: string };
  node?: { label: string };
  createdAt: string;
}

export interface Ticket {
  id: string;
  userId: string;
  orderId: string | null;
  subject: string;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  user?: { email: string; displayName?: string | null };
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'customer' | 'admin';
  body: string;
  createdAt: string;
  sender?: { email: string; displayName?: string | null };
}

export interface AnalyticsSummary {
  revenueLast30dLkr: number;
  revenueByMonth: Record<string, number>;
  activeSubscriptions: number;
  cancelledSubscriptionsLast30d: number;
  totalCustomers: number;
  nodeUtilization: Array<{ label: string; cpuUsedPct: number | null; ramUsedPct: number | null; diskUsedPct: number | null }>;
  topServicesByOrderCount: Array<{ serviceId: string; name: string; type: string; count: number }>;
}

export interface ApiUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'customer' | 'admin' | 'support' | 'dev';
}

// ── API surface actually used by this app ───────────────────────────────────

export const api = {
  auth: {
    me: () => apiFetch('/api/me').then((r) => asJson<{ user: ApiUser }>(r)),
  },

  payments: {
    reviewQueue: (status?: string) =>
      apiFetch(`/api/payments/review-queue${status ? `?status=${encodeURIComponent(status)}` : ''}`).then((r) =>
        asJson<{ payments: Payment[]; total: number; statusFilter: string }>(r)
      ),
    review: (id: string, approve: boolean, reason?: string) =>
      apiFetch(`/api/payments/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve, reason }),
      }).then((r) => asJson<{ payment: Payment }>(r)),
  },

  tickets: {
    list: (status?: string) =>
      apiFetch(`/api/tickets${status ? `?status=${status}` : ''}`).then((r) => asJson<{ tickets: Ticket[] }>(r)),
    get: (id: string) => apiFetch(`/api/tickets/${id}`).then((r) => asJson<{ ticket: Ticket }>(r)),
    reply: (id: string, body: string) =>
      apiFetch(`/api/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }).then((r) =>
        asJson<{ message: TicketMessage }>(r)
      ),
    updateStatus: (id: string, status: Ticket['status']) =>
      apiFetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }).then((r) =>
        asJson<{ ticket: Ticket }>(r)
      ),
    claim: (id: string, force?: boolean) =>
      apiFetch('/api/internal/claim-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId: id, force }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    unclaim: (id: string) =>
      apiFetch('/api/internal/unclaim-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId: id }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    close: (id: string, reason?: string) =>
      apiFetch('/api/internal/close-ticket', {
        method: 'POST',
        body: JSON.stringify({ ticketId: id, reason }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
  },

  analytics: {
    summary: () => apiFetch('/api/admin/analytics').then((r) => asJson<AnalyticsSummary>(r)),
  },

  discordWebhooks: {
    // Reused here for the "test notification" flow on the Notifications
    // screen — dev-only on the backend, same as the web Dev Dashboard.
    list: () =>
      apiFetch('/api/discord-webhooks').then((r) =>
        asJson<{ configs: Array<{ id: string; event: string; isActive: boolean }> }>(r)
      ),
  },

  /**
   * There is no separate "notifications feed" endpoint on the backend —
   * real-time alerts go out via push/email/Discord at the moment something
   * happens (see apps/api/src/lib/notifications.ts and discordWebhooks.ts),
   * not into a queryable inbox. Rather than invent a fake feed with made-up
   * data, the Notifications screen in this app is wired to the real,
   * already-populated admin audit log instead — genuine recent activity
   * (payment approvals/declines, staff changes, node changes, secret
   * reveals), not a mockup.
   */
  auditLog: {
    recent: () =>
      apiFetch('/api/admin/audit-log?take=30').then((r) =>
        asJson<{
          entries: Array<{ id: string; action: string; target: string | null; createdAt: string; admin: { email: string } }>;
          total: number;
        }>(r)
      ),
  },

  pushTokens: {
    register: (expoToken: string, platform: 'ios' | 'android') =>
      apiFetch('/api/push-tokens', {
        method: 'POST',
        body: JSON.stringify({ expoToken, platform }),
      }).then((r) => asJson<{ token: { id: string; platform: string } }>(r)),
    unregister: (expoToken: string) =>
      apiFetch('/api/push-tokens', { method: 'DELETE', body: JSON.stringify({ expoToken }) }),
  },

  deployments: {
    /** Admin: list all deployments across all users */
    list: (params?: { status?: string; userId?: string; take?: number; skip?: number }) => {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.fromEntries(
              Object.entries({ ...params, take: params.take ?? 20, skip: params.skip ?? 0 })
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : '';
      return apiFetch(`/api/deployments${qs}`).then((r) =>
        asJson<{ deployments: Deployment[]; total: number }>(r)
      );
    },
    get: (id: string) =>
      apiFetch(`/api/deployments/${id}`).then((r) => asJson<{ deployment: Deployment }>(r)),
    restart: (id: string) =>
      apiFetch(`/api/deployments/${id}/restart`, { method: 'POST' }).then((r) =>
        asJson<{ deployment: Deployment }>(r)
      ),
    stop: (id: string) =>
      apiFetch(`/api/deployments/${id}/stop`, { method: 'POST' }).then((r) =>
        asJson<{ deployment: Deployment }>(r)
      ),
    updateSubdomain: (id: string, subdomain: string) =>
      apiFetch(`/api/deployments/${id}/subdomain`, {
        method: 'PATCH',
        body: JSON.stringify({ subdomain }),
      }).then((r) => asJson<{ deployment: Deployment }>(r)),
    logs: (id: string, tail?: number) =>
      apiFetch(`/api/deployments/${id}/logs${tail ? `?tail=${tail}` : ''}`).then((r) =>
        asJson<{ logs: string | DeploymentLog[] }>(r)
      ),
  },

  nodes: {
    list: () =>
      apiFetch('/api/nodes').then((r) => asJson<{ nodes: Node[] }>(r)),
    get: (id: string) =>
      apiFetch(`/api/nodes/${id}`).then((r) => asJson<{ node: Node }>(r)),
    toggleActive: (id: string, isActive: boolean) =>
      apiFetch(`/api/nodes/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }).then((r) => asJson<{ node: Node }>(r)),
    engineMonitoring: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/monitoring`).then((r) => asJson<any>(r)),
  },

  databases: {
    list: (params?: { userId?: string; take?: number; skip?: number }) => {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.fromEntries(
              Object.entries({ take: 20, skip: 0, ...params })
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : '';
      return apiFetch(`/api/managed-databases${qs}`).then((r) =>
        asJson<{ databases: ManagedDatabase[]; total: number }>(r)
      );
    },
    get: (id: string) =>
      apiFetch(`/api/managed-databases/${id}`).then((r) => asJson<{ database: ManagedDatabase }>(r)),
  },
};

export { ApiError };
