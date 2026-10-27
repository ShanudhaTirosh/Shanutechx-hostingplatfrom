import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { auth } from './firebase';
import { normalizeServerUrl } from './serverUrl';

export const DEFAULT_API_BASE: string =
  Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://api.shanutechx.com';

const STORAGE_KEY_API_BASE = '@shanutechx_api_base';
// The admin/dev API key used to be kept in plaintext AsyncStorage under this key. It now lives in the
// platform keychain/keystore (expo-secure-store); the legacy entry is migrated once and then deleted.
const LEGACY_STORAGE_KEY_ADMIN_KEY = '@shanutechx_admin_key';
const SECURE_KEY_ADMIN_KEY = 'shanutechx_admin_key'; // SecureStore keys: alphanumerics, ".", "-", "_" only

// Plain http:// is only acceptable for a local dev server (see serverUrl.ts).
const ALLOW_INSECURE_LOOPBACK = typeof __DEV__ !== 'undefined' && __DEV__;

let cachedApiBase = DEFAULT_API_BASE;
let cachedApiKey: string | null = null;
let storageInitialized = false;

async function readSecureApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SECURE_KEY_ADMIN_KEY);
  } catch {
    return null;
  }
}

export async function initApiConfig(): Promise<string> {
  try {
    const [storedBase, legacyKey] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_API_BASE),
      AsyncStorage.getItem(LEGACY_STORAGE_KEY_ADMIN_KEY),
    ]);

    // Ignore (and forget) a stored server URL that would not pass today's validation, e.g. plain http://.
    if (storedBase && storedBase.trim()) {
      const checked = normalizeServerUrl(storedBase, { allowInsecureLoopback: ALLOW_INSECURE_LOOPBACK });
      if (checked.ok) cachedApiBase = checked.url;
      else await AsyncStorage.removeItem(STORAGE_KEY_API_BASE).catch(() => {});
    }

    let storedKey = await readSecureApiKey();
    if (!storedKey && legacyKey && legacyKey.trim()) {
      // One-time migration out of plaintext storage. If SecureStore is unavailable the key is kept in
      // memory for this session only; it is never written back to AsyncStorage.
      storedKey = legacyKey.trim();
      await SecureStore.setItemAsync(SECURE_KEY_ADMIN_KEY, storedKey).catch(() => {});
    }
    if (legacyKey !== null) await AsyncStorage.removeItem(LEGACY_STORAGE_KEY_ADMIN_KEY).catch(() => {});

    if (storedKey && storedKey.trim()) {
      cachedApiKey = storedKey.trim();
    }
  } catch {
    // fallback to defaults
  }
  storageInitialized = true;
  return cachedApiBase;
}

export function getEffectiveApiBase(): string {
  return cachedApiBase;
}

export const API_BASE = cachedApiBase;

/** Throws an Error with a user-facing message when the URL is not acceptable (credentials are sent to it). */
export async function setApiBaseUrl(url: string): Promise<void> {
  if (!url.trim()) {
    cachedApiBase = DEFAULT_API_BASE;
  } else {
    const checked = normalizeServerUrl(url, { allowInsecureLoopback: ALLOW_INSECURE_LOOPBACK });
    if (!checked.ok) throw new Error(checked.error);
    cachedApiBase = checked.url;
  }
  await AsyncStorage.setItem(STORAGE_KEY_API_BASE, cachedApiBase);
}

export async function getStoredApiKey(): Promise<string | null> {
  if (!storageInitialized) {
    await initApiConfig();
  }
  return cachedApiKey;
}

export async function setStoredApiKey(key: string | null): Promise<void> {
  cachedApiKey = key ? key.trim() : null;
  // Never persist the key in AsyncStorage (unencrypted). If the keychain is unavailable it stays in
  // memory for this session only.
  if (cachedApiKey) {
    await SecureStore.setItemAsync(SECURE_KEY_ADMIN_KEY, cachedApiKey).catch(() => {});
  } else {
    await SecureStore.deleteItemAsync(SECURE_KEY_ADMIN_KEY).catch(() => {});
  }
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY_ADMIN_KEY).catch(() => {});
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Attaches either the active Firebase ID token OR a configured Admin/Dev API key.
 * Dynamically resolves against the active API_BASE.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!storageInitialized) {
    await initApiConfig();
  }

  const user = auth.currentUser;
  let token = user ? await user.getIdToken().catch(() => null) : null;
  if (!token && cachedApiKey) {
    token = cachedApiKey;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(token && token.startsWith('shx_') ? { 'x-api-key': token } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = `${cachedApiBase}${path.startsWith('/') ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(
      `Cannot connect to API server at ${cachedApiBase}. Please check your internet or change server URL in settings. (${netErr.message || 'Network request failed'})`,
      0
    );
  }

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.error ?? parsed.message ?? body;
    } catch {
      // body wasn't JSON
    }
    throw new ApiError(typeof message === 'string' ? message : JSON.stringify(message), res.status);
  }

  return res;
}

async function asJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

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
  subdomain?: string | null;
  customSubdomain?: string | null;
  customDomain?: string | null;
  status: 'building' | 'running' | 'failed' | 'stopped' | 'terminated' | 'pending' | 'pending_configuration';
  repoUrl?: string | null;
  branch?: string | null;
  image: string;
  tag: string;
  runtime?: string | null;
  frameworkPreset?: string | null;
  exposureMode?: string | null;
  nodeId: string | null;
  publicUrl: string | null;
  port?: number | null;
  internalPort?: number | null;
  cpuLimit?: number | null;
  memoryLimit?: number | null;
  createdAt: string;
  updatedAt: string;
  lastDeployAt?: string | null;
  userId: string;
  user?: { email: string; displayName?: string | null };
  node?: { label: string; ip?: string };
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
  isActive: boolean;
  isGlobal?: boolean;
  cpuCores?: number;
  ramMb?: number;
  diskGb?: number;
  cpuUsedPct: number | null;
  ramUsedMb?: number | null;
  ramUsedPct: number | null;
  diskUsedGb?: number | null;
  diskUsedPct: number | null;
  totalRamGb: number | null;
  totalDiskGb: number | null;
  lastSeenAt?: string | null;
  deploymentCount: number;
  _count?: { deployments: number };
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
  revenueInWindowLkr?: number;
  revenueAllTimeLkr?: number;
  revenueGrowthPct?: number;
  mrrLkr?: number;
  mrrUsd?: number;
  arrLkr?: number;
  averageOrderValueLkr?: number;
  revenueByMonth: Record<string, number>;
  activeSubscriptions: number;
  cancelledSubscriptionsLast30d: number;
  cancelledSubscriptions?: number;
  totalCustomers: number;
  nodeUtilization: Array<{
    id?: string;
    label: string;
    status?: string;
    cpuUsedPct: number | null;
    ramUsedPct: number | null;
    diskUsedPct: number | null;
  }>;
  topServices?: Array<{ title?: string; name?: string; category?: string; type?: string; count: number; revenue?: number }>;
  topServicesByOrderCount: Array<{ serviceId: string; name: string; type: string; count: number; revenue?: number }>;
  fleetSummary?: {
    totalNodes: number;
    activeNodes: number;
    healthyNodes: number;
    warningNodes?: number;
    criticalNodes?: number;
    totalCpuCores: number;
    totalRamGb: number;
    totalDiskGb: number;
  };
  deploymentsSummary?: {
    running: number;
    building: number;
    failed: number;
  };
  uptimePct?: number;
}

export interface ApiUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'customer' | 'admin' | 'support' | 'dev';
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  discordUserId?: string | null;
  isBanned?: boolean;
}

/** Resolves receipt proof or uploaded media URLs with Windows backslash fixes and data: URI preservation */
export function resolveProofUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  const normalized = url.replace(/\\/g, '/');
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  const base = getEffectiveApiBase().replace(/\/+$/, '');
  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${base}${cleanPath}`;
}

// ── Normalizers ────────────────────────────────────────────────────────────

function normalizeDeployment(d: any): Deployment {
  if (!d) {
    return {
      id: '',
      name: 'Unknown',
      status: 'stopped',
      image: 'docker',
      tag: 'latest',
      nodeId: null,
      publicUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: '',
    };
  }
  const repoName = d.repoUrl ? d.repoUrl.split('/').pop()?.replace('.git', '') : undefined;
  const name =
    d.name ||
    d.preferredName ||
    d.subdomain ||
    repoName ||
    `Deployment #${String(d.id || '').slice(0, 8)}`;

  const cleanSubdomain = d.subdomain || d.customSubdomain || null;
  const publicUrl =
    d.publicUrl ||
    (d.customDomain
      ? `https://${d.customDomain}`
      : cleanSubdomain
      ? `https://${cleanSubdomain}.shanutechx.com`
      : null);

  return {
    ...d,
    id: d.id,
    name,
    subdomain: cleanSubdomain,
    customSubdomain: cleanSubdomain,
    publicUrl,
    image: d.image || d.runtime || d.frameworkPreset || 'docker',
    tag: d.tag || d.branch || 'latest',
    status: d.status || 'running',
    createdAt: d.createdAt || new Date().toISOString(),
    updatedAt: d.updatedAt || d.lastDeployAt || d.createdAt || new Date().toISOString(),
    userId: d.userId || '',
  };
}

function normalizeNode(n: any): Node {
  const ramMb = n.ramMb || 1024;
  const diskGb = n.diskGb || 20;

  const ramUsedPct =
    n.ramUsedPct ?? (n.ramUsedMb ? Math.round(((n.ramUsedMb || 0) / ramMb) * 100) : null);
  const diskUsedPct =
    n.diskUsedPct ?? (n.diskUsedGb ? Math.round(((n.diskUsedGb || 0) / diskGb) * 100) : null);
  const totalRamGb = n.totalRamGb ?? (n.ramMb ? Math.round(n.ramMb / 1024) : null);
  const totalDiskGb = n.totalDiskGb ?? n.diskGb ?? null;
  const deploymentCount = n._count?.deployments ?? n.deploymentCount ?? 0;

  let status: 'online' | 'offline' | 'degraded' = n.status;
  if (!status) {
    if (n.isActive === false) {
      status = 'offline';
    } else if (n.lastSeenAt && Date.now() - new Date(n.lastSeenAt).getTime() > 5 * 60 * 1000) {
      status = 'offline';
    } else if ((n.cpuUsedPct ?? 0) > 85 || (ramUsedPct ?? 0) > 85 || (diskUsedPct ?? 0) > 85) {
      status = 'degraded';
    } else {
      status = 'online';
    }
  }

  return {
    ...n,
    id: n.id,
    label: n.label || 'Compute Node',
    ip: n.ip || '0.0.0.0',
    region: n.region || null,
    status,
    isActive: n.isActive ?? true,
    cpuUsedPct: n.cpuUsedPct ?? null,
    ramUsedPct,
    diskUsedPct,
    totalRamGb,
    totalDiskGb,
    deploymentCount,
    createdAt: n.createdAt || new Date().toISOString(),
  };
}

function normalizeAnalytics(data: any): AnalyticsSummary {
  const revLkr =
    data.revenueInWindowLkr ??
    data.revenueLast30dLkr ??
    data.revenueAllTimeLkr ??
    0;

  const cancelled =
    data.cancelledSubscriptions ??
    data.cancelledSubscriptionsLast30d ??
    0;

  const topServices = Array.isArray(data.topServices) ? data.topServices : [];
  const topServicesByOrderCount =
    topServices.length > 0
      ? topServices.map((s: any, idx: number) => ({
          serviceId: s.serviceId || s.id || `srv-${idx}`,
          name: s.title || s.name || 'Hosting Service',
          type: s.category || s.type || 'hosting',
          count: s.count || 0,
          revenue: s.revenue || 0,
        }))
      : Array.isArray(data.topServicesByOrderCount)
      ? data.topServicesByOrderCount
      : [];

  return {
    ...data,
    revenueLast30dLkr: revLkr,
    revenueInWindowLkr: revLkr,
    revenueAllTimeLkr: data.revenueAllTimeLkr,
    revenueGrowthPct: data.revenueGrowthPct ?? 0,
    mrrLkr: data.mrrLkr ?? 0,
    mrrUsd: data.mrrUsd ?? 0,
    arrLkr: data.arrLkr ?? 0,
    averageOrderValueLkr: data.averageOrderValueLkr ?? 0,
    revenueByMonth: data.revenueByMonth || {},
    activeSubscriptions: data.activeSubscriptions ?? 0,
    cancelledSubscriptionsLast30d: cancelled,
    cancelledSubscriptions: cancelled,
    totalCustomers: data.totalCustomers ?? 0,
    topServices,
    topServicesByOrderCount,
    nodeUtilization: Array.isArray(data.nodeUtilization) ? data.nodeUtilization : [],
    fleetSummary: data.fleetSummary,
    deploymentsSummary: data.deploymentsSummary,
    uptimePct: data.uptimePct ?? 99.9,
  };
}

// ── API Surface ────────────────────────────────────────────────────────────

export const api = {
  health: () =>
    apiFetch('/api/health').then((r) => asJson<{ ok: boolean; status?: string }>(r)),

  auth: {
    me: () => apiFetch('/api/me').then((r) => asJson<{ user: ApiUser }>(r)),
    login: (idToken: string, provider?: string) =>
      apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ idToken, provider }),
      }).then((r) => asJson<{ user: ApiUser; token?: string }>(r)),
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
      apiFetch(`/api/tickets${status ? `?status=${encodeURIComponent(status)}` : ''}`).then((r) =>
        asJson<{ tickets: Ticket[]; total?: number }>(r)
      ),
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
      apiFetch(`/api/tickets/${id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ force }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    unclaim: (id: string) =>
      apiFetch(`/api/tickets/${id}/unclaim`, {
        method: 'POST',
      }).then((r) => asJson<{ ok: boolean }>(r)),
    close: (id: string, reason?: string) =>
      apiFetch(`/api/tickets/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
  },

  analytics: {
    summary: (range: string = '30d') =>
      apiFetch(`/api/admin/analytics?range=${encodeURIComponent(range)}`)
        .then((r) => asJson<any>(r))
        .then(normalizeAnalytics),
  },

  discordWebhooks: {
    list: () =>
      apiFetch('/api/discord-webhooks').then((r) =>
        asJson<{ configs: Array<{ id: string; event: string; isActive: boolean }> }>(r)
      ),
  },

  auditLog: {
    recent: (take: number = 40) =>
      apiFetch(`/api/admin/audit-log?take=${take}`).then((r) =>
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
    list: (params?: { status?: string; userId?: string; take?: number; skip?: number }) => {
      const qs = params
        ? '?' +
          new URLSearchParams(
            Object.fromEntries(
              Object.entries({ ...params, take: params.take ?? 50, skip: params.skip ?? 0 })
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : '';
      return apiFetch(`/api/deployments${qs}`)
        .then((r) => asJson<{ deployments: any[]; total: number }>(r))
        .then(({ deployments, total }) => ({
          deployments: deployments.map(normalizeDeployment),
          total,
        }));
    },
    get: (id: string) =>
      apiFetch(`/api/deployments/${id}`)
        .then((r) => asJson<{ deployment: any }>(r))
        .then(({ deployment }) => ({ deployment: normalizeDeployment(deployment) })),
    restart: (id: string) =>
      apiFetch(`/api/deployments/${id}/restart`, { method: 'POST' })
        .then(() => api.deployments.get(id)),
    stop: (id: string) =>
      apiFetch(`/api/deployments/${id}/stop`, { method: 'POST' })
        .then(() => api.deployments.get(id)),
    start: (id: string) =>
      apiFetch(`/api/deployments/${id}/start`, { method: 'POST' })
        .then(() => api.deployments.get(id)),
    redeploy: (id: string) =>
      apiFetch(`/api/deployments/${id}/redeploy`, { method: 'POST' })
        .then(() => api.deployments.get(id)),
    updateSubdomain: (id: string, subdomain: string) =>
      apiFetch(`/api/deployments/${id}/subdomain`, {
        method: 'PATCH',
        body: JSON.stringify({ subdomain }),
      })
        .then(() => api.deployments.get(id)),
    logs: (id: string, tail?: number) =>
      apiFetch(`/api/deployments/${id}/logs${tail ? `?tail=${tail}` : ''}`).then((r) =>
        asJson<{ logs: string | DeploymentLog[] }>(r)
      ),
  },

  nodes: {
    list: () =>
      apiFetch('/api/nodes')
        .then((r) => asJson<{ nodes: any[] }>(r))
        .then(({ nodes }) => ({ nodes: nodes.map(normalizeNode) })),
    get: (id: string) =>
      apiFetch(`/api/nodes/${id}`)
        .then((r) => asJson<{ node: any }>(r))
        .then(({ node }) => ({ node: normalizeNode(node) })),
    toggleActive: (id: string, isActive: boolean) =>
      apiFetch(`/api/nodes/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) })
        .then((r) => asJson<{ node: any }>(r))
        .then(({ node }) => ({ node: normalizeNode(node) })),
    failover: (id: string, targetNodeId?: string) =>
      apiFetch(`/api/nodes/${id}/failover`, {
        method: 'POST',
        body: JSON.stringify({ targetNodeId }),
      }).then((r) => asJson<{ ok: boolean; message?: string }>(r)),
    engineMonitoring: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/monitoring`).then((r) => asJson<any>(r)),
  },

  databases: {
    list: (params?: { userId?: string; take?: number; skip?: number }) => {
      const qs = params
        ? '?' +
          new URLSearchParams(
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
