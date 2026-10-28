import { apiFetch } from './useAuth';
import {
  ApiUser,
  Service,
  ServiceType,
  Product,
  Plan,
  ProductCategory,
  PlanBillingType,
  Order,
  OrderItem,
  Payment,
  Deployment,
  Node,
  BuildEvent,
  SmtpAccount,
  LiveKitProject,
  VpsProvision,
  Ticket,
  TicketMessage,
  TicketStatus,
  TicketPriority,
  Customer,
  CustomerDetails,
  Subscription,
  Project,
  ProjectMember,
  ProjectTable,
  SqlResult,
  CatalogTemplate,
  VpsPlan,
  ManagedDatabase,
  ManagedDatabaseUser,
  SupabaseClientProject,
  NixpacksConfig,
  WebHostingDeployInput,
  BotHostingDeployInput,
} from './types';

import { getSettingsUnlockToken } from './settingsUnlockToken';
async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return res.json();
}

/** Error that keeps the server's machine-readable `code` (asJson drops it and shows string errors with quote marks). */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function asJsonWithCode<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = typeof body.error === 'string' ? body.error : body.error ? JSON.stringify(body.error) : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, typeof body.code === 'string' ? body.code : undefined);
  }
  return res.json();
}

export type ExposureModeUi = 'proxied' | 'direct_port' | 'internal';
export interface PortIssueUi {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  deploymentId?: string;
  exposureId?: string;
}
export interface DeploymentExposure {
  mode: ExposureModeUi;
  storedMode: string | null;
  publishedPort: number | null;
  hostPort: number | null;
  internalPort: number | null;
  url: string | null;
  status: string;
  requiresConfirm: boolean;
  confirmName: string;
  issues: PortIssueUi[];
}
export type BackupTriggerUi = 'manual' | 'schedule' | 'pre-restore';
export interface BackupItem {
  id: string;
  trigger: BackupTriggerUi;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  phase: string | null;
  repoFullName: string | null;
  releaseUrl: string | null;
  releaseTag: string | null;
  components: Array<{ kind: 'workspace' | 'volume'; name: string; sizeBytes: number }>;
  sizeBytes: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  restore: { status: 'in_progress' | 'completed' | 'failed'; phase: string | null; error: string | null; startedAt: string | null; finishedAt: string | null } | null;
}
export interface BackupPolicyUi {
  enabled: boolean;
  intervalHours: number;
  retention: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  consecutiveFailures: number;
}

export interface PortsOverview {
  nodes: Array<{
    node: { id: string; label: string; ip: string; isActive: boolean };
    deployments: Array<{
      id: string; userId: string; subdomain: string | null; status: string; mode: ExposureModeUi; storedMode: string | null;
      internalPort: number | null; publishedPort: number | null; hostPort: number | null; url: string | null; isPreview: boolean; issues: PortIssueUi[];
    }>;
    exposures: Array<{ id: string; port: number; protocol: string; subdomain: string; domain: string; label: string | null; routed: boolean; note: string; issues: PortIssueUi[] }>;
    issues: PortIssueUi[];
  }>;
  summary: { nodes: number; deployments: number; directPorts: number; nodeExposures: number; errors: number; warnings: number };
  reservedPorts: number[];
}

export const api = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  get: <T = any>(path: string) => apiFetch(path).then((r) => asJson<T>(r)),
  post: <T = any>(path: string, body?: any) =>
    apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }).then((r) => asJson<T>(r)),
  put: <T = any>(path: string, body?: any) =>
    apiFetch(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }).then((r) => asJson<T>(r)),
  delete: <T = any>(path: string) => apiFetch(path, { method: 'DELETE' }).then((r) => asJson<T>(r)),
  patch: <T = any>(path: string, body?: any) =>
    apiFetch(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }).then((r) => asJson<T>(r)),
  /** Exposure of one deployment, and the validated way to change it. A change is stored, not applied: redeploy to apply. */
  exposure: {
    get: (id: string) => apiFetch(`/api/deployments/${id}/exposure`).then((r) => asJsonWithCode<{ exposure: DeploymentExposure; canEdit: boolean; minPublishedPort: number }>(r)),
    update: (id: string, body: { mode: ExposureModeUi; publishedPort?: number | null; confirm?: string }) =>
      apiFetch(`/api/deployments/${id}/exposure`, { method: 'PUT', body: JSON.stringify(body) }).then((r) =>
        asJsonWithCode<{ changed: boolean; requiresRedeploy: boolean }>(r)
      ),
  },
  /** Per-deployment backups to GitHub. Backup and restore run in the background: start one, then poll `list`/`get`. */
  deploymentBackups: {
    list: (id: string) =>
      apiFetch(`/api/deployments/${id}/backups`).then((r) => asJsonWithCode<{ configured: boolean; maxComponentMb: number; policy: BackupPolicyUi; backups: BackupItem[] }>(r)),
    create: (id: string) => apiFetch(`/api/deployments/${id}/backups`, { method: 'POST' }).then((r) => asJsonWithCode<{ backup: BackupItem }>(r)),
    restore: (id: string, backupId: string, body: { confirm: string; components?: string[]; skipSafetyBackup?: boolean }) =>
      apiFetch(`/api/deployments/${id}/backups/${backupId}/restore`, { method: 'POST', body: JSON.stringify(body) }).then((r) => asJsonWithCode<{ backup: BackupItem }>(r)),
    remove: (id: string, backupId: string) => apiFetch(`/api/deployments/${id}/backups/${backupId}`, { method: 'DELETE' }).then((r) => asJsonWithCode<{ ok: boolean }>(r)),
    setPolicy: (id: string, body: { enabled: boolean; intervalHours: number; retention: number }) =>
      apiFetch(`/api/deployments/${id}/backup-policy`, { method: 'PUT', body: JSON.stringify(body) }).then((r) => asJsonWithCode<{ policy: BackupPolicyUi }>(r)),
  },
  portsOverview: () => apiFetch('/api/ports/overview').then((r) => asJsonWithCode<PortsOverview>(r)),
  me: () => apiFetch('/api/me').then((r) => asJson<{ user: ApiUser; rootDomain: string }>(r)),
  auth: {
    me: () => apiFetch('/api/me').then((r) => asJson<{ user: ApiUser; rootDomain: string }>(r)),
  },


  updateProfile: (data: { displayName?: string; avatarUrl?: string | null; phoneNumber?: string | null; discordUserId?: string | null }) =>
    apiFetch('/api/me', { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      asJson<{ user: any }>(r)
    ),

  updateRole: (role: 'customer' | 'support' | 'dev' | 'admin') =>
    apiFetch('/api/me/role', { method: 'PATCH', body: JSON.stringify({ role }) }).then((r) =>
      asJson<{ user: ApiUser; rootDomain: string }>(r)
    ),

  admin: {
    customers: (
      takeOrOptions?: number | string | { take?: number; skip?: number; search?: string; role?: string; scoped?: boolean },
      skip = 0,
      search?: string,
      role?: string,
      scoped?: boolean
    ) => {
      let takeVal = 50;
      let skipVal = skip;
      let searchVal = search;
      let roleVal = role;
      let scopedVal = scoped;

      if (typeof takeOrOptions === 'object' && takeOrOptions !== null) {
        takeVal = takeOrOptions.take ?? 50;
        skipVal = takeOrOptions.skip ?? 0;
        searchVal = takeOrOptions.search;
        roleVal = takeOrOptions.role;
        scopedVal = takeOrOptions.scoped;
      } else if (typeof takeOrOptions === 'string') {
        searchVal = takeOrOptions;
      } else if (typeof takeOrOptions === 'number') {
        takeVal = takeOrOptions;
      }

      const params = new URLSearchParams();
      params.set('take', String(takeVal));
      params.set('skip', String(skipVal));
      if (searchVal) params.set('search', searchVal);
      if (roleVal && roleVal !== 'all') params.set('role', roleVal);
      if (scopedVal) params.set('scoped', 'true');

      return apiFetch(`/api/admin/customers?${params.toString()}`).then(
        (r) => asJson<{ customers: Customer[]; total: number; isScoped?: boolean }>(r)
      );
    },
    customerDetails: (userId: string) =>
      apiFetch(`/api/admin/customers/${userId}`).then((r) =>
        asJson<{ customer: CustomerDetails }>(r)
      ),
    assignCustomer: (userId: string, adminId: string | null) =>
      apiFetch(`/api/admin/customers/${userId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ adminId }),
      }).then((r) =>
        asJson<{ user: { id: string; email: string; assignedAdminId: string | null; assignedAdmin: any } }>(r)
      ),
    setUserRole: (userId: string, role: string) =>
      apiFetch(`/api/admin/customers/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }).then((r) =>
        asJson<{ user: { id: string; email: string; role: string } }>(r)
      ),
    createUser: (data: { email: string; displayName?: string; role?: string }) =>
      apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }).then(
        (r) => asJson<{ user: any }>(r)
      ),
    customerByFirebaseUid: (uid: string) =>
      apiFetch(`/api/admin/customers/by-firebase-uid/${uid}`).then((r) =>
        asJson<{ customer: { id: string; email: string; displayName: string | null; firebaseUid: string } }>(r)
      ),
    banUser: (userId: string, reason?: string) =>
      apiFetch(`/api/admin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }).then((r) =>
        asJson<{ ok: boolean; message: string }>(r)
      ),
    impersonateUser: (userId: string) =>
      apiFetch(`/api/admin/impersonate/${userId}`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; user: { id: string; email: string; displayName: string | null }; message: string }>(r)
      ),
    unbanUser: (userId: string) =>
      apiFetch(`/api/admin/users/${userId}/unban`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; message: string }>(r)
      ),
    staff: () =>
      apiFetch('/api/admin/staff').then((r) =>
        asJson<{ staff: Array<{ id: string; email: string; displayName: string | null; role: string; createdAt: string }> }>(r)
      ),
    setRole: (userId: string, role: string) =>
      apiFetch(`/api/admin/staff/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }).then(
        (r) => asJson<{ user: { id: string; email: string; role: string } }>(r)
      ),
    setStaffRole: (userId: string, role: 'customer' | 'support' | 'dev' | 'admin') =>
      apiFetch(`/api/admin/staff/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }).then(
        (r) => asJson<{ user: { id: string; email: string; role: string } }>(r)
      ),
    auditLog: (skip = 0) =>
      apiFetch(`/api/admin/audit-log?skip=${skip}`).then((r) =>
        asJson<{
          entries: Array<{ id: string; action: string; target: string | null; createdAt: string; admin: { email: string } }>;
          total: number;
          take: number;
          skip: number;
        }>(r)
      ),
    allUsers: (search?: string) =>
      apiFetch(`/api/admin/all-users${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((r) =>
        asJson<{ users: Array<{ id: string; email: string; displayName: string | null; role: string }> }>(r)
      ),
    bots: {
      whatsappStatus: () => apiFetch('/api/admin/bots/whatsapp/status').then((r) => asJson<{ state: string; qr?: string | null; qrDataUrl?: string | null; pairingCode?: string | null; updatedAt: string }>(r)),
      whatsappPairingCode: (phoneNumber: string) => apiFetch('/api/admin/bots/whatsapp/pairing-code', { method: 'POST', body: JSON.stringify({ phoneNumber }) }).then((r) => asJson<{ ok: boolean; pairingCode: string }>(r)),
      whatsappResetSession: () => apiFetch('/api/admin/bots/whatsapp/reset-session', { method: 'POST' }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
      whatsappReconnect: () => apiFetch('/api/admin/bots/whatsapp/reconnect', { method: 'POST' }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
      whatsappSendTest: (phoneNumber: string, message: string) => apiFetch('/api/admin/bots/whatsapp/send-test', { method: 'POST', body: JSON.stringify({ phoneNumber, message }) }).then((r) => asJson<{ ok: boolean }>(r)),
      discordStatus: () => apiFetch('/api/admin/bots/discord/status').then((r) => asJson<{ status: string; botTag?: string; guildsCount?: number; guilds?: any[]; activeTicketChannels?: number; staffRoleId?: string | null }>(r)),
      discordReconnect: () => apiFetch('/api/admin/bots/discord/reconnect', { method: 'POST' }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
      discordSendTest: (message: string, channelId?: string, discordUserId?: string) => apiFetch('/api/admin/bots/discord/send-test', { method: 'POST', body: JSON.stringify({ message, channelId, discordUserId }) }).then((r) => asJson<{ ok: boolean }>(r)),
    },
    monitoring: {
      getStatus: () => apiFetch('/api/admin/monitoring/status').then((r) => asJson<{ config: any; uptimeKuma: any; grafana: any }>(r)),
      saveConfig: (data: { uptimeKumaUrl?: string; uptimeKumaSlug?: string; uptimeKumaApiKey?: string; grafanaUrl?: string; grafanaApiKey?: string; grafanaDashboardUid?: string }) =>
        apiFetch('/api/admin/monitoring/config', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; config: any }>(r)),
      triggerSync: () => apiFetch('/api/admin/monitoring/sync', { method: 'POST' }).then((r) => asJson<{ ok: boolean; syncedCount: number; monitors: any[] }>(r)),
    },
    observability: {
      queryLogs: (q?: string, limit = 50) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (q) params.append('q', q);
        return apiFetch(`/api/admin/observability/loki/logs?${params.toString()}`).then((r) => asJson<{ isConfigured: boolean; status: string; totalLines: number; entries: any[] }>(r));
      },
      getDashboards: () => apiFetch('/api/admin/observability/grafana/dashboards').then((r) => asJson<{ isConfigured: boolean; dashboards: any[] }>(r)),
      getNodeTelemetry: (nodeId: string) => apiFetch(`/api/admin/observability/nodes/${nodeId}/telemetry`).then((r) => asJson<{ nodeId: string; label: string; ip: string; telemetry: any }>(r)),
    },
  },

  email: {
    mailboxes: () => apiFetch('/api/email/mailboxes').then((r) => asJson<{ mailboxes: any[]; total: number }>(r)),
    credentials: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/credentials`).then((r) =>
        asJson<{ smtpHost: string; smtpPort: number; username: string; password?: string; imapHost: string; imapPort: number }>(r)
      ),
    websiteConnect: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/website-connect`).then((r) => asJson<any>(r)),
    planQuotas: () => apiFetch('/api/email/plan-quotas').then((r) => asJson<any>(r)),
    plans: () => apiFetch('/api/email/plans').then((r) => asJson<{ ok: boolean; plans: any[] }>(r)),
    getMailboxAccess: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/access`).then((r) =>
        asJson<{ ok: boolean; mailboxAcl: any[]; allowedAdminIds: string[]; staffUsers: any[] }>(r)
      ),
    grantMailboxAccess: (id: string, data: { userId: string; permissions: ('read' | 'write' | 'manage')[] }) =>
      apiFetch(`/api/email/mailboxes/${id}/access`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; message: string; mailboxAcl: any[]; allowedAdminIds: string[] }>(r)
      ),
    revokeMailboxAccess: (id: string, userId: string) =>
      apiFetch(`/api/email/mailboxes/${id}/access/${userId}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; message: string; mailboxAcl: any[]; allowedAdminIds: string[] }>(r)
      ),
    getMailboxProfile: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/profile`).then((r) =>
        asJson<{ ok: boolean; profile: any }>(r)
      ),
    updateMailboxProfile: (id: string, data: { avatarUrl?: string | null; displayName?: string | null; jobTitle?: string | null; company?: string | null; phone?: string | null; bio?: string | null; website?: string | null }) =>
      apiFetch(`/api/email/mailboxes/${id}/profile`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; message: string; profile: any }>(r)
      ),
    uploadMailboxAvatar: (id: string, file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return apiFetch(`/api/email/mailboxes/${id}/avatar`, { method: 'POST', body: formData }).then((r) =>
        asJson<{ ok: boolean; message: string; avatarUrl: string; profile: any }>(r)
      );
    },
    removeMailboxAvatar: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/avatar`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; message: string; profile: any }>(r)
      ),
    updateQuota: (id: string, storageQuotaMb: number) =>
      apiFetch(`/api/email/mailboxes/${id}/quota`, { method: 'PATCH', body: JSON.stringify({ storageQuotaMb }) }).then((r) => asJson<any>(r)),
    changePassword: (id: string, password: string) =>
      apiFetch(`/api/email/mailboxes/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    addAlias: (id: string, aliasPrefix: string) =>
      apiFetch(`/api/email/mailboxes/${id}/aliases`, {
        method: 'POST',
        body: JSON.stringify({ aliasPrefix }),
      }).then((r) => asJson<{ ok: boolean; aliases: string[] }>(r)),
    removeAlias: (id: string, prefix: string) =>
      apiFetch(`/api/email/mailboxes/${id}/aliases/${encodeURIComponent(prefix)}`, {
        method: 'DELETE',
      }).then((r) => asJson<{ ok: boolean; aliases: string[] }>(r)),
    dnsRecords: (domain?: string) =>
      apiFetch(`/api/email/dns-records${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`).then((r) => asJson<any>(r)),
    sendTransactional: (data: any) =>
      apiFetch('/api/v1/emails', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<any>(r)),
    renew: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/renew`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; message: string; expiresAt: string }>(r)
      ),
    createMailbox: (data: { email: string; password: string; storageQuotaMb?: number; dailySendLimit?: number; customDomain?: string }) =>
      apiFetch('/api/email/mailboxes', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ mailbox: any }>(r)),
    deleteMailbox: (id: string) => apiFetch(`/api/email/mailboxes/${id}`, { method: 'DELETE' }).then((r) => asJson<{ success: boolean }>(r)),
    domains: () => apiFetch('/api/email/domains').then((r) => asJson<{ domains: any[] }>(r)),
    addDomain: (domain: string) =>
      apiFetch('/api/email/domains', { method: 'POST', body: JSON.stringify({ domain }) }).then((r) => asJson<{ domain: any }>(r)),
    verifyDomain: (id: string) =>
      apiFetch(`/api/email/domains/${id}/verify`, { method: 'POST' }).then((r) =>
        asJson<{
          domain: any;
          verified: boolean;
          message: string;
          mxVerified?: boolean;
          spfVerified?: boolean;
          dkimVerified?: boolean;
          dmarcVerified?: boolean;
        }>(r)
      ),
    deleteDomain: (idOrDomain: string) =>
      apiFetch(`/api/email/domains/${encodeURIComponent(idOrDomain)}`, { method: 'DELETE' }).then((r) =>
        asJson<{ success: boolean; message?: string }>(r)
      ),
    messages: (folder = 'inbox') => apiFetch(`/api/email/messages?folder=${folder}`).then((r) => asJson<{ messages: any[]; total: number }>(r)),
    send: (data: { from: string; to: string; subject: string; body: string }) =>
      apiFetch('/api/email/send', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ message: any; delivered: boolean }>(r)),
    patchMessage: (id: string, data: any) =>
      apiFetch(`/api/email/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean }>(r)),
    deleteMessage: (id: string) =>
      apiFetch(`/api/email/messages/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    contacts: () => apiFetch('/api/email/contacts').then((r) => asJson<{ contacts: any[] }>(r)),
    createContact: (data: { name: string; email: string; phone?: string; company?: string }) =>
      apiFetch('/api/email/contacts', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ contact: any }>(r)),
    todos: () => apiFetch('/api/email/todos').then((r) => asJson<{ todos: any[] }>(r)),
    createTodo: (title: string) =>
      apiFetch('/api/email/todos', { method: 'POST', body: JSON.stringify({ title }) }).then((r) => asJson<{ todo: any }>(r)),
    events: () => apiFetch('/api/email/events').then((r) => asJson<{ events: any[] }>(r)),
    adminStats: () => apiFetch('/api/admin/email/stats').then((r) => asJson<any>(r)),
    adminProvision: (data: {
      targetUserId: string;
      username: string;
      domain?: string;
      password: string;
      storageQuotaMb?: number;
      dailySendLimit?: number;
      isInternal?: boolean;
    }) =>
      apiFetch('/api/admin/email/provision', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ mailbox: any; message: string }>(r)
      ),
    getConfig: () => apiFetch('/api/admin/mail/config').then((r) => asJson<{ config: any; node: any }>(r)),
    saveConfig: (data: {
      mailNodeId?: string;
      s3Endpoint?: string;
      s3BucketName?: string;
      s3Region?: string;
      s3AccessKeyId?: string;
      s3SecretAccessKey?: string;
      autoSyncAttachments?: boolean;
    }) => apiFetch('/api/admin/mail/config', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    verifyS3: (data?: {
      s3Endpoint?: string;
      s3BucketName?: string;
      s3Region?: string;
      s3AccessKeyId?: string;
      s3SecretAccessKey?: string;
    }) => apiFetch('/api/admin/mail/s3/verify', { method: 'POST', body: JSON.stringify(data || {}) }).then((r) => asJson<{ ok: boolean; message: string; latencyMs?: number; error?: string }>(r)),
    getTelemetry: () =>
      apiFetch('/api/admin/mail/telemetry').then((r) =>
        asJson<{
          totalMailboxes: number;
          totalStorageMb: number;
          totalUsedStorageMb: number;
          totalSentToday: number;
          totalDomains: number;
          s3Configured: boolean;
          s3BucketName: string | null;
          assignedNode: any;
        }>(r)
      ),
    getHosts: () => apiFetch('/api/admin/email/hosts').then((r) => asJson<{ hosts: any[] }>(r)),
    addHost: (data: { label: string; hostname: string; apiUrl: string; apiKey: string; isDefault?: boolean }) =>
      apiFetch('/api/admin/email/hosts', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ host: any; message: string }>(r)),
    testHost: (id: string) =>
      apiFetch(`/api/admin/email/hosts/${id}/test`, { method: 'POST' }).then((r) => asJson<{ ok: boolean; status: string; message?: string }>(r)),
    deleteHost: (id: string) =>
      apiFetch(`/api/admin/email/hosts/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    getSystemHealth: () => apiFetch('/api/admin/email/system-health').then((r) => asJson<any>(r)),
    bulkProvision: (data: { targetUserId: string; domain: string; pattern: string; count: number; password: string; storageQuotaMb?: number; mailHostId?: string }) =>
      apiFetch('/api/admin/email/mailboxes/bulk', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ created: any[]; count: number; message: string }>(r)),
    updateMailboxStatus: (id: string, data: { action: 'suspend' | 'unsuspend' | 'reset_password'; newPassword?: string }) =>
      apiFetch(`/api/admin/email/mailboxes/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
  },

  webmail: {
    getSsoTicket: (accountId: string) =>
      apiFetch('/api/webmail/auth/sso-ticket', {
        method: 'POST',
        body: JSON.stringify({ smtpAccountId: accountId, accountId }),
      }).then((r) => asJson<{ ssoToken: string; webmailUrl: string }>(r)),
    // Messages & Threads
    listMessages: (folder = 'inbox', search = '', smtpAccountId?: string) => {
      const params = new URLSearchParams({ folder });
      if (search) params.append('search', search);
      if (smtpAccountId) params.append('smtpAccountId', smtpAccountId);
      return apiFetch(`/api/webmail/messages?${params}`).then((r) => asJson<{ messages: any[]; unreadCount: number; total: number }>(r));
    },
    listThreads: (folder = 'inbox') =>
      apiFetch(`/api/webmail/threads?folder=${folder}`).then((r) => asJson<{ threads: any[]; total: number }>(r)),
    getThread: (threadId: string) =>
      apiFetch(`/api/webmail/threads/${threadId}`).then((r) => asJson<{ threadId: string; messages: any[]; total: number }>(r)),
    getMessage: (id: string) =>
      apiFetch(`/api/webmail/messages/${id}`).then((r) => asJson<{ message: any }>(r)),
    sendMessage: (data: {
      recipientEmail: string;
      subject: string;
      htmlBody: string;
      smtpAccountId?: string;
      threadId?: string;
      inReplyTo?: string;
      scheduledAt?: string;
      readReceipt?: boolean;
      labels?: string[];
      attachments?: { filename: string; sizeStr: string; url?: string }[];
    }) =>
      apiFetch('/api/webmail/send', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; message: any; scheduled: boolean }>(r)
      ),
    saveDraft: (data: { id?: string; recipientEmail?: string; subject?: string; htmlBody?: string }) =>
      apiFetch('/api/webmail/drafts', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ draft: any }>(r)),
    updateMessage: (id: string, data: { isRead?: boolean; isStarred?: boolean; isPinned?: boolean; folder?: string; category?: string; labels?: string[]; snoozedUntil?: string }) =>
      apiFetch(`/api/webmail/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => asJson<{ message: any }>(r)),
    deleteMessage: (id: string) =>
      apiFetch(`/api/webmail/messages/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean; deletedId: string }>(r)),
    bulkAction: (data: { messageIds: string[]; action: string; targetFolder?: string; label?: string; snoozeUntil?: string }) =>
      apiFetch('/api/webmail/bulk', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; count: number }>(r)),

    // Folders
    folders: {
      list: () => apiFetch('/api/webmail/folders').then((r) => asJson<{ folders: any[] }>(r)),
      create: (data: { name: string; icon?: string; color?: string; parentId?: string }) =>
        apiFetch('/api/webmail/folders', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ folder: any }>(r)),
      delete: (id: string) =>
        apiFetch(`/api/webmail/folders/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Labels
    labels: {
      list: () => apiFetch('/api/webmail/labels').then((r) => asJson<{ labels: any[] }>(r)),
      create: (data: { name: string; color?: string }) =>
        apiFetch('/api/webmail/labels', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ label: any }>(r)),
      delete: (id: string) =>
        apiFetch(`/api/webmail/labels/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Filters / Rules
    filters: {
      list: () => apiFetch('/api/webmail/filters').then((r) => asJson<{ filters: any[] }>(r)),
      create: (data: { name: string; conditionsJson: any; actionsJson: any }) =>
        apiFetch('/api/webmail/filters', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ filter: any }>(r)),
      delete: (id: string) =>
        apiFetch(`/api/webmail/filters/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Signatures
    signatures: {
      list: () => apiFetch('/api/webmail/signatures').then((r) => asJson<{ signatures: any[] }>(r)),
      create: (data: { name: string; htmlContent: string; isDefault?: boolean; smtpAccountId?: string }) =>
        apiFetch('/api/webmail/signatures', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ signature: any }>(r)),
      delete: (id: string) =>
        apiFetch(`/api/webmail/signatures/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Templates / Canned Responses
    templates: {
      list: () => apiFetch('/api/webmail/templates').then((r) => asJson<{ templates: any[] }>(r)),
      create: (data: { name: string; subject?: string; body: string }) =>
        apiFetch('/api/webmail/templates', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ template: any }>(r)),
      delete: (id: string) =>
        apiFetch(`/api/webmail/templates/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Vacation Auto-Reply
    autoReply: {
      get: () => apiFetch('/api/webmail/auto-reply').then((r) => asJson<{ autoReply: any | null }>(r)),
      save: (data: { enabled: boolean; subject?: string; body?: string; startDate?: string; endDate?: string }) =>
        apiFetch('/api/webmail/auto-reply', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ autoReply: any }>(r)),
    },

    // Blocked Senders
    blockedSenders: {
      list: () => apiFetch('/api/webmail/blocked-senders').then((r) => asJson<{ blockedSenders: any[] }>(r)),
      add: (data: { emailOrDomain: string; reason?: string }) =>
        apiFetch('/api/webmail/blocked-senders', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ blocked: any }>(r)),
      delete: (id: string) =>
        apiFetch(`/api/webmail/blocked-senders/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Calendar Sync
    calendarSync: {
      list: () => apiFetch('/api/webmail/calendar/sync').then((r) => asJson<{ syncs: any[] }>(r)),
      add: (data: { provider?: string; name: string; calendarUrl?: string }) =>
        apiFetch('/api/webmail/calendar/sync', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ sync: any; message: string }>(r)),
      delete: (id: string) =>
        apiFetch(`/api/webmail/calendar/sync/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // AI Features
    ai: {
      summarize: (data: { threadBody?: string; subject?: string }) =>
        apiFetch('/api/webmail/ai/summarize', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ summary: any }>(r)),
      replySuggestions: (data: { messageBody?: string; senderName?: string }) =>
        apiFetch('/api/webmail/ai/reply-suggestions', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ suggestions: string[] }>(r)),
      draft: (data: { prompt: string; tone?: string; recipientName?: string }) =>
        apiFetch('/api/webmail/ai/draft', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ draft: { subject: string; body: string } }>(r)),
      threatCheck: (data: { senderEmail?: string; subject?: string; body?: string }) =>
        apiFetch('/api/webmail/ai/threat-check', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ assessment: any }>(r)),
      translate: (data: { text: string; targetLanguage?: string }) =>
        apiFetch('/api/webmail/ai/translate', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ translatedText: string; sourceLanguage: string }>(r)),
    },

    // Delegations (dev/admin)
    delegations: {
      list: () => apiFetch('/api/webmail/delegations').then((r) => asJson<{ accounts: any[] }>(r)),
      grant: (data: { smtpAccountId: string; adminUserId: string }) =>
        apiFetch('/api/webmail/delegations', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; message: string; account: any }>(r)),
    },

    // Core & Advanced features
    snoozeMessage: (id: string, snoozedUntil: string, returnFolder?: string) =>
      apiFetch(`/api/webmail/messages/${id}/snooze`, { method: 'POST', body: JSON.stringify({ snoozedUntil, returnFolder }) }).then((r) => asJson<{ ok: boolean; snooze: any }>(r)),
    listSnoozed: () =>
      apiFetch('/api/webmail/messages/snoozed').then((r) => asJson<{ snoozed: any[] }>(r)),
    assignLabels: (id: string, labels: string[]) =>
      apiFetch(`/api/webmail/messages/${id}/labels`, { method: 'POST', body: JSON.stringify({ labels }) }).then((r) => asJson<{ ok: boolean; labels: string[] }>(r)),

    // Business & Scheduling
    scheduleSend: (data: { recipientTo: string; subject: string; body: string; scheduledFor: string; attachments?: any[] }) =>
      apiFetch('/api/webmail/messages/schedule', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; item: any }>(r)),
    listScheduled: () =>
      apiFetch('/api/webmail/messages/scheduled').then((r) => asJson<{ scheduled: any[] }>(r)),
    cancelScheduled: (id: string) =>
      apiFetch(`/api/webmail/messages/scheduled/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    getAnalytics: () =>
      apiFetch('/api/webmail/business/analytics').then((r) => asJson<{ analytics: any }>(r)),
    mailMerge: (data: { recipients: Array<{ email: string; variables?: Record<string, string> }>; subject: string; bodyTemplate: string }) =>
      apiFetch('/api/webmail/business/mail-merge', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; dispatchedCount: number }>(r)),

    // Account & Credentials
    getAccountDelegations: () =>
      apiFetch('/api/webmail/account/delegation').then((r) => asJson<{ delegations: any[] }>(r)),
    addAccountDelegate: (data: { delegateEmail: string; permission?: string }) =>
      apiFetch('/api/webmail/account/delegation', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; delegation: any }>(r)),
    revokeAccountDelegate: (id: string) =>
      apiFetch(`/api/webmail/account/delegation/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    getCredentials: (id?: string) =>
      apiFetch(`/api/webmail/account/credentials${id ? `?mailboxId=${encodeURIComponent(id)}` : ''}`).then((r) => asJson<{ credentials: any }>(r)),

    // Security & Audit
    reportThreat: (data: { messageId: string; threatType?: string; comment?: string }) =>
      apiFetch('/api/webmail/security/threat-report', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ ok: boolean; status: string }>(r)),
    getSessions: () =>
      apiFetch('/api/webmail/security/sessions').then((r) => asJson<{ sessions: any[] }>(r)),
    revokeSession: (id: string) =>
      apiFetch(`/api/webmail/security/sessions/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    getAuditLogs: () =>
      apiFetch('/api/webmail/security/audit-log').then((r) => asJson<{ auditLogs: any[] }>(r)),

    // Admin telemetry & ops
    adminStats: () =>
      apiFetch('/api/webmail/admin/stats').then((r) => asJson<{ stats: any }>(r)),
    adminSystemStats: () =>
      apiFetch('/api/webmail/admin/system').then((r) => asJson<{ system: any }>(r)),
    adminDnsCheck: () =>
      apiFetch('/api/webmail/admin/dns-check', { method: 'POST' }).then((r) => asJson<{ checks: Record<string, boolean> }>(r)),
    adminFlushQueue: () =>
      apiFetch('/api/webmail/admin/flush-queue', { method: 'POST' }).then((r) => asJson<{ ok: boolean; flushed: number }>(r)),
  },

  billing: {
    subscriptions: () => apiFetch('/api/subscriptions').then((r) => asJson<{ subscriptions: Subscription[] }>(r)),
    runChecks: () =>
      apiFetch('/api/billing/run-checks', { method: 'POST' }).then((r) =>
        asJson<{ markedPastDue: number; cancelled: number }>(r)
      ),
    renew: (subscriptionId: string) =>
      apiFetch(`/api/subscriptions/${subscriptionId}/renew`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; renewalOrderId: string; paymentId: string; message: string }>(r)
      ),
    uploadRenewalProof: (orderId: string, file: File) => {
      const fd = new FormData();
      fd.append('proof', file);
      return apiFetch(`/api/orders/${orderId}/payments/proof`, { method: 'POST', body: fd }).then((r) =>
        asJson<{ payment: Payment; reasons: string[] }>(r)
      );
    },
  },

  cms: {
    get: (page: string) => apiFetch(`/api/cms/${page}`).then((r) => asJson<{ page: string; content: Record<string, any> }>(r)),
    update: (page: string, blocks: Array<{ key: string; value: unknown }>) =>
      apiFetch(`/api/cms/${page}`, { method: 'PUT', body: JSON.stringify({ blocks }) }).then((r) =>
        asJson<{ page: string; content: Record<string, any> }>(r)
      ),
    getContactInfo: () => apiFetch('/api/cms/contact-info').then((r) => asJson<Record<string, any>>(r)),
    getSubmissions: () => apiFetch('/api/admin/cms/submissions').then((r) => asJson<{ submissions: any[] }>(r)),
    deleteSubmission: (key: string) => apiFetch(`/api/admin/cms/submissions/${key}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
  },

  analytics: {
    get: (range: string = '30d') => apiFetch(`/api/admin/analytics?range=${range}`).then((r) => asJson<any>(r)),
  },

  services: {
    list: () => apiFetch('/api/services').then((r) => asJson<{ services: Service[] }>(r)),
    create: (data: { type: ServiceType; name: string; price: number }) =>
      apiFetch('/api/services', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ service: Service }>(r)
      ),
    update: (id: string, data: { type: ServiceType; name: string; price: number }) =>
      apiFetch(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ service: Service }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/services/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
  },


  knowledgebase: {
    list: (category?: string, query?: string, targetRole?: string, includeDrafts?: boolean) => {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (query && query.trim()) params.append('q', query.trim());
      if (targetRole && targetRole !== 'all') params.append('targetRole', targetRole);
      if (includeDrafts) params.append('includeDrafts', 'true');
      const qs = params.toString() ? `?${params.toString()}` : '';
      return apiFetch(`/api/knowledgebase${qs}`).then((r) =>
        asJson<{ categories: import('./types').KbCategory[]; articles: import('./types').KbArticle[]; total: number }>(r)
      );
    },
    getArticle: (id: string) =>
      apiFetch(`/api/knowledgebase/articles/${id}`).then((r) => asJson<{ article: import('./types').KbArticle }>(r)),
    voteHelpful: (id: string) =>
      apiFetch(`/api/knowledgebase/articles/${id}/helpful`, { method: 'POST' }).then((r) =>
        asJson<{ article: import('./types').KbArticle }>(r)
      ),
    createArticle: (data: { title: string; category: string; summary: string; content: string; targetRole?: string; published: boolean }) =>
      apiFetch('/api/knowledgebase/articles', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ article: import('./types').KbArticle }>(r)
      ),
    updateArticle: (id: string, data: Partial<{ title: string; category: string; summary: string; content: string; targetRole?: string; published: boolean }>) =>
      apiFetch(`/api/knowledgebase/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ article: import('./types').KbArticle }>(r)
      ),
    deleteArticle: (id: string) =>
      apiFetch(`/api/knowledgebase/articles/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ success: boolean }>(r)
      ),
  },

  discordWebhooks: {
    list: () =>
      apiFetch('/api/discord-webhooks').then((r) =>
        asJson<{ configs: Array<{ id: string; event: string; isActive: boolean; createdAt: string }> }>(r)
      ),
    create: (event: string, webhookUrl: string) =>
      apiFetch('/api/discord-webhooks', { method: 'POST', body: JSON.stringify({ event, webhookUrl }) }).then((r) =>
        asJson<{ config: { id: string; event: string; isActive: boolean } }>(r)
      ),
    toggle: (id: string, isActive: boolean) =>
      apiFetch(`/api/discord-webhooks/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }).then((r) =>
        asJson<{ config: { id: string; event: string; isActive: boolean } }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/discord-webhooks/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    test: (webhookUrl: string) =>
      apiFetch('/api/discord-webhooks/test', { method: 'POST', body: JSON.stringify({ webhookUrl }) }).then((r) =>
        asJson<{ ok: boolean; status?: number; error?: string }>(r)
      ),
  },


  cart: {
    get: () => apiFetch('/api/cart').then((r) => asJson<{ order: Order; items: OrderItem[] }>(r)),
    addItem: (idOrPlan: { serviceId: string } | { planId: string }, quantity = 1) =>
      apiFetch('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ ...idOrPlan, quantity }),
      }).then((r) => asJson<{ item: OrderItem; total: number }>(r)),
    removeItem: (itemId: string) =>
      apiFetch(`/api/cart/items/${itemId}`, { method: 'DELETE' }).then((r) =>
        asJson<{ total: number }>(r)
      ),
    clearCart: () =>
      apiFetch('/api/cart', { method: 'DELETE' }).then((r) =>
        asJson<{ message: string; total: number; currency: string | null }>(r)
      ),
    checkout: (idempotencyKey?: string) =>
      apiFetch('/api/cart/checkout', {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }).then((r) =>
        asJson<{
          order: Order;
          total: number;
          currency: string;
          free: boolean;
        }>(r)
      ),
  },

  subscriptions: {
    list: () => apiFetch('/api/subscriptions').then((r) => asJson<{ subscriptions: any[] }>(r)),
  },

  orders: {
    list: () => apiFetch('/api/orders').then((r) => asJson<{ orders: Order[] }>(r)),
    uploadProof: (
      orderId: string,
      file: File,
      options?: { paymentMethod?: string; reference?: string; notes?: string },
      idempotencyKey?: string
    ) => {
      const formData = new FormData();
      formData.append('proof', file);
      if (options?.paymentMethod) formData.append('paymentMethod', options.paymentMethod);
      if (options?.reference) formData.append('reference', options.reference);
      if (options?.notes) formData.append('notes', options.notes);
      return apiFetch(`/api/orders/${orderId}/payments/proof`, {
        method: 'POST',
        body: formData,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }).then((r) => asJson<{ payment: Payment; reasons: string[] }>(r));
    },
    invoiceUrl: (orderId: string) => `/api/orders/${orderId}/invoice`,
  },


  invoices: {
    list: () => apiFetch('/api/invoices').then((r) => asJson<{ invoices: any[] }>(r)),
    get: (id: string) => apiFetch(`/api/invoices/${id}`).then((r) => asJson<{ invoice: any }>(r)),
    downloadPdfUrl: (id: string) => `/api/invoices/${id}/pdf`,
  },

  deployments: {
    list: () => apiFetch('/api/deployments').then((r) => asJson<{ deployments: Deployment[] }>(r)),
    get: (id: string) => apiFetch(`/api/deployments/${id}`).then((r) => asJson<{ 
      deployment: {
        id: string;
        userId: string;
        nodeId: string;
        repoUrl: string | null;
        subdomain: string | null;
        internalPort: number;
        status: 'pending' | 'building' | 'running' | 'failed' | 'stopped';
        cpuLimit: number | null;
        memoryLimit: number | null;
        storageLimit: number | null;
        createdAt: string;
        lastDeployAt: string | null;
      };
      envVars: Record<string, string> | null;
      resourceUsage: {
        cpuUsagePercent: number;
        memoryUsedMb: number;
        memoryLimitMb: number | null;
        memoryUsagePercent: number;
        storageUsedGb: number;
        storageLimitGb: number | null;
        storageUsagePercent: number;
        timestamp: string;
      } | null;
    }>(r)),
    logs: (id: string) => apiFetch(`/api/deployments/${id}/logs`).then((r) => asJson<{ logs: string }>(r)),
    logsStream: (id: string) => `/api/deployments/${id}/logs/stream`,
    stop: (id: string) => apiFetch(`/api/deployments/${id}/stop`, { method: 'POST' }).then((r) => asJson<{ ok: boolean }>(r)),
    start: (id: string) => apiFetch(`/api/deployments/${id}/start`, { method: 'POST' }).then((r) => asJson<{ ok: boolean; status: string }>(r)),
    restart: (id: string) => apiFetch(`/api/deployments/${id}/restart`, { method: 'POST' }).then((r) => asJson<{ ok: boolean; status: string }>(r)),
    updateSubdomain: (id: string, subdomain: string) =>
      apiFetch(`/api/deployments/${id}/subdomain`, {
        method: 'PATCH',
        body: JSON.stringify({ subdomain }),
      }).then((r) => asJson<{ deployment: any }>(r)),

    updateEnv: async (
      id: string, 
      envVars: Record<string, string>,
      onEvent?: (event: { phase: string; message?: string }) => void
    ): Promise<void> => {
      const res = await apiFetch(`/api/deployments/${id}/env`, { 
        method: 'PATCH', 
        body: JSON.stringify({ envVars }) 
      });
      
      // Check if response is streaming (for running deployments)
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/x-ndjson') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffered = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split('\n');
          buffered = lines.pop() ?? '';
          for (const line of lines) {
            if (line.trim() && onEvent) {
              onEvent(JSON.parse(line));
            }
          }
        }
      } else {
        // Non-streaming response for stopped deployments
        await asJson<{ ok: boolean; deployment: any; message: string }>(res);
      }
    },
    updateConfig: (id: string, data: Partial<{
      repoUrl: string;
      branch: string;
      frameworkPreset: string;
      startCommand: string;
      entryFile: string;
      internalPort: number;
      exposureMode: 'ssl_with_proxy' | 'raw_tcp' | 'internal_only';
      subdomain: string;
      envVars: Record<string, string>;
    }>) =>
      apiFetch(`/api/deployments/${id}/config`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ ok: boolean; deployment: any }>(r)),
    renew: (id: string, months: number = 1) =>
      apiFetch(`/api/deployments/${id}/renew`, { method: 'POST', body: JSON.stringify({ months }) }).then((r) =>
        asJson<{ ok: boolean; message: string; orderId: string }>(r)
      ),
    syncGit: (id: string, data?: { gitCommitHash?: string; gitCommitMessage?: string }) =>
      apiFetch(`/api/deployments/${id}/sync-git`, { method: 'POST', body: JSON.stringify(data || {}) }).then((r) =>
        asJson<{ ok: boolean; message: string; gitCommitHash: string; gitCommitMessage: string }>(r)
      ),

    redeploy: async (id: string, onEvent?: (event: BuildEvent) => void): Promise<void> => {
      const res = await apiFetch(`/api/deployments/${id}/redeploy`, { method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('No response stream from server');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim() && onEvent) onEvent(JSON.parse(line));
        }
      }
    },
    launchJob: (id: string, data?: Record<string, any>) =>
      apiFetch(`/api/deployments/${id}/launch-job`, { method: 'POST', body: JSON.stringify(data || {}) }).then((r) =>
        asJson<{ success: boolean; jobId: string; deploymentId: string; status: string }>(r)
      ),
    rollback: (id: string, targetDeploymentId: string) =>
      apiFetch(`/api/deployments/${id}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ targetDeploymentId }),
      }).then((r) => asJson<{ ok: boolean; activeDeploymentId: string; rollbackDurationMs: number }>(r)),
    launch: async (id: string, data?: Record<string, any>, onEvent?: (event: BuildEvent) => void): Promise<void> => {
      const res = await apiFetch(`/api/deployments/${id}/launch`, { method: 'POST', body: JSON.stringify(data || {}) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('No response stream from server');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim() && onEvent) onEvent(JSON.parse(line));
        }
      }
    },
    enableDeployWebhook: (id: string) =>
      apiFetch(`/api/deployments/${id}/webhook-secret`, { method: 'POST' }).then((r) =>
        asJson<{ secret: string; webhookUrl: string; instructions: { github: string; gitlab: string } }>(r)
      ),
    disableDeployWebhook: (id: string) =>
      apiFetch(`/api/deployments/${id}/webhook-secret`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    webhookInfo: (id: string) =>
      apiFetch(`/api/deployments/${id}/webhook-info`).then((r) =>
        asJson<{ webhookUrl: string; hasSecret: boolean; repoUrl: string | null; instructions: { github: string; gitlab: string } }>(r)
      ),
    autoRegisterDeployWebhook: (id: string) =>
      apiFetch(`/api/deployments/${id}/webhook-auto-register`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; message: string; webhookUrl: string; hookId?: number | string }>(r)
      ),
    /**
     * Deployments stream build progress as newline-delimited JSON rather
     * than a single response — onEvent fires for every line as it arrives,
     * so the UI can show live build logs instead of a blank spinner.
     */
    create: async (
      data: {
        serviceType: string;
        repoUrl: string;
        preferredName: string;
        customSubdomain?: string;
        internalPort: number;
        branch?: string;
        gitProvider?: 'github' | 'gitlab' | 'custom';
        gitAccountId?: string;
        gitToken?: string;
        autoDeploy?: boolean;
        startCommand?: string;
        entryFile?: string;
        exposureMode?: string;
        frameworkPreset?: string;
        publishedPort?: number;
        teamId?: string | null;
        nodeId?: string;
        orderItemId?: string;
        builder?: string;
        rootDir?: string;
        nixpacksConfig?: NixpacksConfig;
        envVars?: Record<string, string>;
      },
      onEvent?: (event: BuildEvent) => void
    ): Promise<void> => {
      const res = await apiFetch('/api/deployments', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('No response stream from server');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim() && onEvent) onEvent(JSON.parse(line));
        }
      }
    },

    deployWebHosting: async (
      data: WebHostingDeployInput,
      onEvent?: (event: BuildEvent) => void
    ): Promise<{ deployment?: Deployment; orderItemId?: string }> => {
      const res = await apiFetch('/api/deployments/web-hosting', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/x-ndjson') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffered = '';
        let lastEvent: any = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split('\n');
          buffered = lines.pop() ?? '';
          for (const line of lines) {
            if (line.trim()) {
              const parsed = JSON.parse(line);
              lastEvent = parsed;
              if (onEvent) onEvent(parsed);
            }
          }
        }
        return { deployment: lastEvent?.deployment };
      }
      return res.json();
    },

    deployBotHosting: (data: BotHostingDeployInput) =>
      apiFetch('/api/deployments/bot-hosting', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ deployment: Deployment; message: string; port: number }>(r)),

    deployFromRepo: async (
      data: {
        repoUrl: string;
        preferredName: string;
        branch?: string;
        builder?: 'AUTO' | 'RAILWAYPACK' | 'NIXPACKS' | 'DOCKERFILE';
        rootDir?: string;
        startCommand?: string;
        entryFile?: string;
        internalPort?: number;
        exposureMode?: string;
        envVars?: Record<string, string>;
        nixpacksConfig?: NixpacksConfig;
        teamId?: string | null;
        nodeId?: string;
        orderItemId?: string;
      },
      onEvent?: (event: BuildEvent) => void
    ): Promise<void> => {
      return api.deployments.create(
        {
          serviceType: 'repo',
          repoUrl: data.repoUrl,
          preferredName: data.preferredName,
          branch: data.branch,
          internalPort: data.internalPort || 3000,
          startCommand: data.startCommand,
          entryFile: data.entryFile,
          exposureMode: data.exposureMode,
          envVars: data.envVars,
          builder: data.builder,
          rootDir: data.rootDir,
          nixpacksConfig: data.nixpacksConfig,
          teamId: data.teamId,
          nodeId: data.nodeId,
          orderItemId: data.orderItemId,
        },
        onEvent
      );
    },

    getNixpacksConfig: (id: string) =>
      apiFetch(`/api/deployments/${id}/nixpacks`).then((r) =>
        asJson<{
          deploymentId: string;
          builder: string;
          rootDir: string | null;
          nixpacksConfig: NixpacksConfig;
          effectiveToml: string;
        }>(r)
      ),

    updateNixpacksConfig: (id: string, config: NixpacksConfig) =>
      apiFetch(`/api/deployments/${id}/nixpacks`, {
        method: 'PUT',
        body: JSON.stringify(config),
      }).then((r) =>
        asJson<{
          deploymentId: string;
          builder: string;
          nixpacksConfig: NixpacksConfig;
          effectiveToml: string;
        }>(r)
      ),

    updateGitSettings: (id: string, data: { gitToken?: string; autoDeploy?: boolean }) =>
      apiFetch(`/api/deployments/${id}/git-settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ deployment: Deployment }>(r)),
    downloadZipUrl: (id: string) => `/api/deployments/${id}/download-zip`,
    downloadZip: async (id: string, filename?: string) => {
      const res = await apiFetch(`/api/deployments/${id}/download-zip`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `deployment-${id.slice(0, 8)}-backup.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  },

  domains: {
    list: (deploymentId: string) =>
      apiFetch(`/api/deployments/${deploymentId}/domains`).then((r) =>
        asJson<{ domains: import('./types').CustomDomain[]; total: number }>(r)
      ),
    attach: (deploymentId: string, domain: string, cloudflareApiToken?: string, cloudflareZoneId?: string) =>
      apiFetch('/api/domains/attach', {
        method: 'POST',
        body: JSON.stringify({ deploymentId, domain, cloudflareApiToken, cloudflareZoneId }),
      }).then((r) =>
        asJson<{
          customDomain: import('./types').CustomDomain;
          cnameTarget: string;
          instructions: string;
          autoCreated?: boolean;
        }>(r)
      ),
    verify: (domainId: string) =>
      apiFetch(`/api/domains/${domainId}/verify`, { method: 'POST' }).then((r) =>
        asJson<{
          status: 'verified' | 'failed';
          domain: string;
          verified: boolean;
          resolvedTarget: string;
          expectedTarget?: string;
          sslStatus?: string;
          message: string;
        }>(r)
      ),
    remove: (domainId: string) =>
      apiFetch(`/api/domains/${domainId}`, { method: 'DELETE' }).then((r) =>
        asJson<{ success: boolean; domain: string; message: string }>(r)
      ),
  },

  nodes: {
    list: () => apiFetch('/api/nodes').then((r) => asJson<{ nodes: Node[] }>(r)),
    getClusterSecret: () => apiFetch('/api/nodes/cluster-secret').then((r) => asJson<{ secret: string }>(r)),
    connectSSH: (data: {
      ip: string;
      port?: number;
      username?: string;
      password?: string;
      privateKey?: string;
      label: string;
      roleTags?: string[];
    }) => apiFetch('/api/nodes/connect', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ success: boolean; message: string; node?: Node; logs?: string[] }>(r)),
    /**
     * Open a Server-Sent Events stream for live provisioning progress.
     * The caller is responsible for closing the EventSource when done.
     * Events: { type:'step', message } | { type:'done', node } | { type:'error', error, logs }
     */
    connectSSHStream: (data: {
      ip: string; port?: number; username?: string; password?: string;
      privateKey?: string; label: string; roleTags?: string[];
    }) => {
      // SSE via fetch (EventSource doesn't support POST + body)
      // Returns the raw Response; consumer should iterate the ReadableStream.
      return apiFetch('/api/nodes/connect/stream', { method: 'POST', body: JSON.stringify(data) });
    },
    create: (data: {
      label: string;
      ip: string;
      sshKeyRef: string;
      cpuCores: number;
      ramMb: number;
      diskGb: number;
      roleTags?: string[];
    }) => apiFetch('/api/nodes', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ node: Node; domain?: string }>(r)),
    getPortExposures: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/ports/exposures`).then((r) => asJson<{ exposures: any[] }>(r)),
    exposePort: (nodeId: string, data: { port: number; subdomain?: string; protocol?: string; label?: string }) =>
      apiFetch(`/api/nodes/${nodeId}/ports/expose`, { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ exposure: any }>(r)),
    deletePortExposure: (nodeId: string, exposureId: string) =>
      apiFetch(`/api/nodes/${nodeId}/ports/exposures/${exposureId}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    triggerFailover: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/failover`, { method: 'POST' }).then((r) => asJson<{ success: boolean; message: string; result: any }>(r)),
    getFailoverStatus: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/failover-status`).then((r) => asJson<{ logs: any[] }>(r)),
    update: (nodeId: string, data: { isActive?: boolean; isDraining?: boolean; label?: string; roleTags?: string[]; monthlyBandwidthGb?: number }) =>
      apiFetch(`/api/nodes/${nodeId}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => asJson<{ node: Node }>(r)),
    enrollJob: (data: {
      label: string;
      ip: string;
      sshPort?: number;
      username?: string;
      password?: string;
      privateKey?: string;
      provider?: string;
      region?: string;
      os?: string;
      cpuCores?: number;
      ramMb?: number;
      diskGb?: number;
      roleTags?: string[];
    }) =>
      apiFetch('/api/nodes/enroll-job', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ success: boolean; jobId: string; node: Node; message: string }>(r)
      ),
    cordon: (id: string, reason?: string) =>
      apiFetch(`/api/nodes/${id}/cordon`, { method: 'POST', body: JSON.stringify({ reason }) }).then((r) =>
        asJson<{ success: boolean; node: Node }>(r)
      ),
    uncordon: (id: string) =>
      apiFetch(`/api/nodes/${id}/uncordon`, { method: 'POST' }).then((r) =>
        asJson<{ success: boolean; node: Node }>(r)
      ),
    deleteNode: (id: string, force?: boolean) =>
      apiFetch(`/api/nodes/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' }).then((r) =>
        asJson<{ success: boolean; message: string }>(r)
      ),
  },

  jobs: {
    list: (params?: { type?: string; status?: string; nodeId?: string }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set('type', params.type);
      if (params?.status) q.set('status', params.status);
      if (params?.nodeId) q.set('nodeId', params.nodeId);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return apiFetch(`/api/jobs${qs}`).then((r) => asJson<{ jobs: any[] }>(r));
    },
    get: (id: string) =>
      apiFetch(`/api/jobs/${id}`).then((r) => asJson<{ job: any }>(r)),
    cancel: (id: string) =>
      apiFetch(`/api/jobs/${id}/cancel`, { method: 'POST' }).then((r) => asJson<{ success: boolean; job: any }>(r)),
    streamUrl: (id: string) => `/api/jobs/${id}/stream`,
  },

  containers: {
    list: (nodeId: string) => apiFetch(`/api/nodes/${nodeId}/containers`).then((r) => asJson<{ containers: any[] }>(r)),
    action: (nodeId: string, containerId: string, action: 'start' | 'stop' | 'restart') =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/action`, { method: 'POST', body: JSON.stringify({ action }) }).then((r) => asJson<{ ok: boolean }>(r)),
    pause: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/pause`, { method: 'POST' }).then((r) => asJson<{ ok: boolean }>(r)),
    unpause: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/unpause`, { method: 'POST' }).then((r) => asJson<{ ok: boolean }>(r)),
    rename: (nodeId: string, containerId: string, name: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/rename`, { method: 'PUT', body: JSON.stringify({ name }) }).then((r) => asJson<{ ok: boolean }>(r)),
    top: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/top`).then((r) => asJson<any>(r)),
    changes: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/changes`).then((r) => asJson<{ changes: any[] }>(r)),
    logs: (nodeId: string, containerId: string, tail = 200) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/logs?tail=${tail}`).then((r) => asJson<{ logs: string }>(r)),
    stats: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/stats`).then((r) => asJson<any>(r)),
    logsStreamPath: (nodeId: string, containerId: string) => `/api/nodes/${nodeId}/containers/${containerId}/logs/stream`,
    execTicket: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/exec-ticket`, { method: 'POST' }).then((r) => asJson<any>(r)),
    remove: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
  },

  dockerImages: {
    list: (nodeId: string) => apiFetch(`/api/nodes/${nodeId}/images`).then((r) => asJson<{ images: any[] }>(r)),
    inspect: (nodeId: string, imageId: string) => apiFetch(`/api/nodes/${nodeId}/images/${encodeURIComponent(imageId)}`).then((r) => asJson<any>(r)),
    pull: (nodeId: string, image: string, tag = 'latest') =>
      apiFetch(`/api/nodes/${nodeId}/images/pull`, { method: 'POST', body: JSON.stringify({ image, tag }) }).then((r) => asJson<any>(r)),
    remove: (nodeId: string, imageId: string, force = false) =>
      apiFetch(`/api/nodes/${nodeId}/images/${encodeURIComponent(imageId)}?force=${force}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    prune: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/images/prune`, { method: 'POST' }).then((r) => asJson<any>(r)),
  },

  dockerVolumes: {
    list: (nodeId: string) => apiFetch(`/api/nodes/${nodeId}/volumes`).then((r) => asJson<{ volumes: any[] }>(r)),
    inspect: (nodeId: string, name: string) => apiFetch(`/api/nodes/${nodeId}/volumes/${encodeURIComponent(name)}`).then((r) => asJson<any>(r)),
    create: (nodeId: string, name: string, driver = 'local', labels?: Record<string, string>) =>
      apiFetch(`/api/nodes/${nodeId}/volumes`, { method: 'POST', body: JSON.stringify({ name, driver, labels }) }).then((r) => asJson<any>(r)),
    remove: (nodeId: string, name: string) =>
      apiFetch(`/api/nodes/${nodeId}/volumes/${encodeURIComponent(name)}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    prune: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/volumes/prune`, { method: 'POST' }).then((r) => asJson<any>(r)),
  },

  dockerNetworks: {
    list: (nodeId: string) => apiFetch(`/api/nodes/${nodeId}/networks`).then((r) => asJson<{ networks: any[] }>(r)),
    inspect: (nodeId: string, networkId: string) => apiFetch(`/api/nodes/${nodeId}/networks/${encodeURIComponent(networkId)}`).then((r) => asJson<any>(r)),
    create: (nodeId: string, name: string, driver = 'bridge', options?: any) =>
      apiFetch(`/api/nodes/${nodeId}/networks`, { method: 'POST', body: JSON.stringify({ name, driver, options }) }).then((r) => asJson<any>(r)),
    remove: (nodeId: string, networkId: string) =>
      apiFetch(`/api/nodes/${nodeId}/networks/${encodeURIComponent(networkId)}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    prune: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/networks/prune`, { method: 'POST' }).then((r) => asJson<any>(r)),
  },

  dockerSystem: {
    info: (nodeId: string) => apiFetch(`/api/nodes/${nodeId}/docker/system/info`).then((r) => asJson<any>(r)),
    df: (nodeId: string) => apiFetch(`/api/nodes/${nodeId}/docker/system/df`).then((r) => asJson<any>(r)),
    prune: (nodeId: string) => apiFetch(`/api/nodes/${nodeId}/docker/system/prune`, { method: 'POST' }).then((r) => asJson<any>(r)),
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
    getPaymentMethods: () =>
      apiFetch('/api/payment-methods').then((r) => asJson<{ channels: any[] }>(r)),
    adminGetChannels: () =>
      apiFetch('/api/admin/payment-methods').then((r) => asJson<{ channels: any[] }>(r)),
    adminSaveChannels: (channels: any[]) =>
      apiFetch('/api/admin/payment-methods', {
        method: 'PUT',
        body: JSON.stringify({ channels }),
      }).then((r) => asJson<{ channels: any[]; message: string }>(r)),
    adminToggleChannel: (channelId: string, enabled: boolean) =>
      apiFetch(`/api/admin/payment-methods/${channelId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }).then((r) => asJson<{ channel: any }>(r)),
  },

  smtp: {
    list: () => apiFetch('/api/smtp-accounts').then((r) => asJson<{ accounts: SmtpAccount[] }>(r)),
    revealPassword: (id: string) =>
      apiFetch(`/api/smtp-accounts/${id}/reveal-password`).then((r) => asJson<{ password: string }>(r)),
    changePassword: (id: string, newPassword: string) =>
      apiFetch(`/api/smtp-accounts/${id}/password`, { method: 'PATCH', body: JSON.stringify({ newPassword }) }).then((r) =>
        asJson<{ ok: boolean; message: string }>(r)
      ),
    updateDomain: (id: string, domain: string) =>
      apiFetch(`/api/smtp-accounts/${id}/domain`, { method: 'PATCH', body: JSON.stringify({ domain }) }).then((r) =>
        asJson<{ ok: boolean; domain: string; aliases: string[] }>(r)
      ),
    addAlias: (id: string, prefix: string) =>
      apiFetch(`/api/smtp-accounts/${id}/aliases`, { method: 'POST', body: JSON.stringify({ prefix }) }).then((r) =>
        asJson<{ ok: boolean; aliases: string[]; count: number; max: number }>(r)
      ),
    removeAlias: (id: string, prefix: string) =>
      apiFetch(`/api/smtp-accounts/${id}/aliases/${prefix}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; aliases: string[] }>(r)
      ),
    create: (data: {
      userId: string;
      orderItemId?: string;
      postalOrgId: string;
      smtpHost: string;
      smtpPort: number;
      smtpUsername: string;
      smtpPassword: string;
      webmailUrl?: string;
    }) =>
      apiFetch('/api/smtp-accounts', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ account: SmtpAccount }>(r)
      ),
    getGlobalConfig: () => apiFetch('/api/smtp/global-config').then((r) => asJson<{ config: any; hasPassword: boolean }>(r)),
    saveGlobalConfig: (data: any) =>
      apiFetch('/api/smtp/global-config', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; config: any }>(r)
      ),
    verifyConnection: (data?: any) =>
      apiFetch('/api/smtp/verify', { method: 'POST', body: JSON.stringify(data || {}) }).then((r) =>
        asJson<{ ok: boolean; message: string; latencyMs: number }>(r)
      ),
    sendEmail: (data: { to: string; subject: string; html: string; text?: string }) =>
      apiFetch('/api/smtp/send', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; messageId: string; response: string; recipient: string }>(r)
      ),
    verifyDns: (domain: string) =>
      apiFetch('/api/smtp/verify-dns', { method: 'POST', body: JSON.stringify({ domain }) }).then((r) =>
        asJson<{
          domain: string;
          serverIp: string;
          serverHost: string;
          verification: { mx: boolean; spf: boolean; dkim?: boolean; dmarc: boolean; allVerified: boolean };
          records: { mxRecords: string[]; txtRecords: string[] };
          expectedDns: Array<{ type: string; name: string; value: string; priority?: number; status: string }>;
        }>(r)
      ),
    getSsoTicket: (smtpAccountId?: string) =>
      apiFetch('/api/webmail/auth/sso-ticket', { method: 'POST', body: JSON.stringify({ accountId: smtpAccountId, smtpAccountId }) }).then((r) =>
        asJson<{ ssoToken: string; webmailUrl: string }>(r)
      ),
  },

  livekit: {
    list: () => apiFetch('/api/livekit/projects').then((r) => asJson<{ projects: LiveKitProject[] }>(r)),
    create: (data: { userId: string; orderItemId?: string; nodeId?: string }) =>
      apiFetch('/api/livekit/projects', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ project: LiveKitProject; nodeRegistered: boolean; warning?: string }>(r)
      ),
    createToken: (projectId: string, roomName: string, identity: string) =>
      apiFetch(`/api/livekit/projects/${projectId}/token`, {
        method: 'POST',
        body: JSON.stringify({ roomName, identity }),
      }).then((r) => asJson<{ token: string }>(r)),
  },

  vps: {
    list: () => apiFetch('/api/vps-provisions').then((r) => asJson<{ provisions: VpsProvision[]; notice?: string }>(r)),
    listAllAdmin: () =>
      apiFetch('/api/vps-provisions/admin/all').then((r) =>
        asJson<{
          provisions: Array<VpsProvision & { user?: { id: string; email: string; displayName?: string | null; role: string } }>;
          notice?: string;
        }>(r)
      ),
    get: (id: string) => apiFetch(`/api/vps-provisions/${id}`).then((r) => asJson<{ provision: VpsProvision; notice?: string }>(r)),
    revealPassword: (id: string) =>
      apiFetch(`/api/vps-provisions/${id}/reveal-password`).then((r) =>
        asJson<{ username: string; password: string; ip?: string; sshPort?: number; credentialType: string; notice?: string }>(r)
      ),
    sshTicket: (id: string) =>
      apiFetch(`/api/vps-provisions/${id}/ssh-ticket`, { method: 'POST' }).then(
        (r) => asJson<{ ticket: string; expiresInMs: number; notice?: string }>(r)
      ),
    power: (id: string, action: 'reboot' | 'start' | 'status') =>
      apiFetch(`/api/vps-provisions/${id}/power`, { method: 'POST', body: JSON.stringify({ action }) }).then(
        (r) => asJson<{ ok: boolean; action: string; message?: string; status?: string; uptime?: string; notice?: string }>(r)
      ),
    stats: (id: string) =>
      apiFetch(`/api/vps-provisions/${id}/stats`).then((r) =>
        asJson<{ stats: { uptime: string; cpuCores: number; ramTotalMb: number; ramUsedMb: number; diskTotalGb: number; diskUsedGb: number } }>(r)
      ),
    changePassword: (id: string, newPassword: string) =>
      apiFetch(`/api/vps-provisions/${id}/change-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }).then(
        (r) => asJson<{ ok: boolean; message: string; notice?: string }>(r)
      ),
    updateCredentials: (id: string, data: { ip?: string; sshPort?: number; username?: string; password?: string }) =>
      apiFetch(`/api/vps-provisions/${id}/update-credentials`, { method: 'PATCH', body: JSON.stringify(data) }).then(
        (r) => asJson<{ ok: boolean; provision: VpsProvision; notice?: string }>(r)
      ),
    manualProvision: (
      id: string,
      data: {
        ip: string;
        sshPort?: number;
        username?: string;
        password?: string;
        sshPrivateKey?: string;
        provider?: string;
        notes?: string;
      }
    ) =>
      apiFetch(`/api/vps-provisions/${id}/manual-provision`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ ok: boolean; provision: VpsProvision; notice?: string }>(r)),
    downloadKeyUrl: (id: string) => `/api/vps-provisions/${id}/download-key`,
    sftpList: (id: string, path = '/root') =>
      apiFetch(`/api/vps-provisions/${id}/sftp/list?path=${encodeURIComponent(path)}`).then((r) =>
        asJson<{
          path: string;
          items: Array<{ name: string; size: number; isDirectory: boolean; modifyTime: number; permissions: number }>;
          notice?: string;
        }>(r)
      ),
    sftpDownloadUrl: (id: string, path: string) => `/api/vps-provisions/${id}/sftp/download?path=${encodeURIComponent(path)}`,
    sftpUpload: (id: string, remotePath: string, file: File) => {
      const formData = new FormData();
      formData.append('remotePath', remotePath);
      formData.append('file', file);
      return apiFetch(`/api/vps-provisions/${id}/sftp/upload`, { method: 'POST', body: formData }).then(
        (r) => asJson<{ ok: boolean; remotePath: string; message: string }>(r)
      );
    },
    sftpDelete: (id: string, path: string, isDirectory = false) =>
      apiFetch(`/api/vps-provisions/${id}/sftp/delete?path=${encodeURIComponent(path)}&isDirectory=${isDirectory}`, {
        method: 'DELETE',
      }).then((r) => asJson<{ ok: boolean; remotePath: string; message: string }>(r)),
    sftpExtract: (id: string, archivePath: string, targetDirectory?: string) =>
      apiFetch(`/api/vps-provisions/${id}/sftp/extract`, {
        method: 'POST',
        body: JSON.stringify({ archivePath, targetDirectory }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    sftpRename: (id: string, oldPath: string, newPath: string) =>
      apiFetch(`/api/vps-provisions/${id}/sftp/rename`, {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    sftpMkdir: (id: string, dirPath: string) =>
      apiFetch(`/api/vps-provisions/${id}/sftp/mkdir`, {
        method: 'POST',
        body: JSON.stringify({ dirPath }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    sftpTouch: (id: string, filePath: string) =>
      apiFetch(`/api/vps-provisions/${id}/sftp/touch`, {
        method: 'POST',
        body: JSON.stringify({ filePath }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    sftpReadFile: (id: string, path: string) =>
      apiFetch(`/api/vps-provisions/${id}/sftp/read-file?path=${encodeURIComponent(path)}`).then((r) =>
        asJson<{ path: string; content: string }>(r)
      ),
    sftpSaveFile: (id: string, remotePath: string, content: string) =>
      apiFetch(`/api/vps-provisions/${id}/sftp/save-file`, {
        method: 'POST',
        body: JSON.stringify({ remotePath, content }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    getFirewall: (id: string) =>
      apiFetch(`/api/vps-provisions/${id}/firewall`).then((r) =>
        asJson<{ status: 'active' | 'inactive'; rules: Array<{ index: number; to: string; action: 'ALLOW' | 'DENY'; from: string; comment?: string }> }>(r)
      ),
    toggleFirewall: (id: string, enabled: boolean) =>
      apiFetch(`/api/vps-provisions/${id}/firewall/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }).then((r) => asJson<{ success: boolean; status: 'active' | 'inactive' }>(r)),
    addFirewallRule: (
      id: string,
      rule: { action: 'allow' | 'deny'; port?: number | string; protocol?: 'tcp' | 'udp' | 'any'; sourceIp?: string; comment?: string }
    ) =>
      apiFetch(`/api/vps-provisions/${id}/firewall/rules`, {
        method: 'POST',
        body: JSON.stringify(rule),
      }).then((r) => asJson<{ success: boolean; message: string }>(r)),
    deleteFirewallRule: (id: string, ruleIndex: number) =>
      apiFetch(`/api/vps-provisions/${id}/firewall/rules/${ruleIndex}`, {
        method: 'DELETE',
      }).then((r) => asJson<{ success: boolean }>(r)),
    create: (data: {
      userId: string;
      orderItemId: string;
      provider?: string;
      externalId?: string;
      panelUrl?: string;
      ip?: string;
      sshPort?: number;
      username?: string;
      password: string;
    }) =>
      apiFetch('/api/vps-provisions', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ provision: VpsProvision; notice?: string }>(r)
      ),
    testConnection: (data: {
      ip: string;
      sshPort?: number;
      username?: string;
      password: string;
      testType?: 'ssh' | 'sftp' | 'both';
    }) =>
      apiFetch('/api/vps-provisions/test-connection', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) =>
        asJson<{
          ok: boolean;
          ssh: { success: boolean; message: string };
          sftp: { success: boolean; message: string };
        }>(r)
      ),
    testExistingConnection: (id: string, testType: 'ssh' | 'sftp' | 'both' = 'both') =>
      apiFetch(`/api/vps-provisions/${id}/test-connection`, {
        method: 'POST',
        body: JSON.stringify({ testType }),
      }).then((r) =>
        asJson<{
          ok: boolean;
          ssh: { success: boolean; message: string };
          sftp: { success: boolean; message: string };
        }>(r)
      ),
    renew: (id: string, data?: { months?: number; notes?: string }) =>
      apiFetch(`/api/vps-provisions/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }).then((r) =>
        asJson<{ ok: boolean; message: string; provision: VpsProvision; orderId: string }>(r)
      ),
  },

  tickets: {
    list: (status?: TicketStatus) =>
      apiFetch(`/api/tickets${status ? `?status=${status}` : ''}`).then((r) =>
        asJson<{ tickets: Ticket[] }>(r)
      ),
    get: (id: string) => apiFetch(`/api/tickets/${id}`).then((r) => asJson<{ ticket: Ticket }>(r)),
    create: (data: { subject: string; message: string; orderId?: string; priority?: TicketPriority }) =>
      apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ticket: Ticket }>(r)
      ),
    reply: (id: string, body: string) =>
      apiFetch(`/api/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }).then(
        (r) => asJson<{ message: TicketMessage }>(r)
      ),
    update: (id: string, data: { status?: TicketStatus; priority?: TicketPriority }) =>
      apiFetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ticket: Ticket }>(r)
      ),
  },

  templates: {
    list: () => apiFetch('/api/templates').then((r) => asJson<{ templates: any[] }>(r)),
  },

  apiKeys: {
    list: () => apiFetch('/api/api-keys').then((r) => asJson<{ keys: any[] }>(r)),
    create: (label: string) =>
      apiFetch('/api/api-keys', { method: 'POST', body: JSON.stringify({ label }) }).then((r) =>
        asJson<{ key: any; rawKey: string }>(r)
      ),
    revoke: (id: string) => apiFetch(`/api/api-keys/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
  },

  webhooks: {
    list: () => apiFetch('/api/webhooks').then((r) => asJson<{ webhooks: any[] }>(r)),
    create: (url: string, event: string) =>
      apiFetch('/api/webhooks', { method: 'POST', body: JSON.stringify({ url, event }) }).then((r) =>
        asJson<{ webhook: any; secret: string }>(r)
      ),
    deliveries: (id: string) =>
      apiFetch(`/api/webhooks/${id}/deliveries`).then((r) => asJson<{ deliveries: any[] }>(r)),
    delete: (id: string) => apiFetch(`/api/webhooks/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
  },

  status: {
    get: () =>
      apiFetch('/api/status').then((r) =>
        asJson<{ overallStatus: string; deploymentsUp: number; deploymentsTotal: number; incidents: any[] }>(r)
      ),
    createIncident: (data: { title: string; body: string; severity: string }) =>
      apiFetch('/api/status/incidents', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ incident: any }>(r)
      ),
    resolveIncident: (id: string) =>
      apiFetch(`/api/status/incidents/${id}/resolve`, { method: 'PATCH' }).then((r) => asJson<{ incident: any }>(r)),
    runChecks: () =>
      apiFetch('/api/status/run-checks', { method: 'POST' }).then((r) =>
        asJson<{ checked: number; up: number; down: number }>(r)
      ),
    deploymentUptime: (id: string) =>
      apiFetch(`/api/deployments/${id}/uptime`).then((r) => asJson<{ checks: any[]; uptimePct: number | null }>(r)),
  },


  teams: {
    list: () => apiFetch('/api/teams').then((r) => asJson<{ ownedTeams: any[]; joinedTeams: any[] }>(r)),
    create: (name: string) =>
      apiFetch('/api/teams', { method: 'POST', body: JSON.stringify({ name }) }).then((r) => asJson<{ team: any }>(r)),
    get: (id: string) => apiFetch(`/api/teams/${id}`).then((r) => asJson<{ team: any; myRole: string; resources: any }>(r)),
    invite: (id: string, data: { email: string; role: string; resourcePermissions?: any[] }) =>
      apiFetch(`/api/teams/${id}/invites`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ invite: any; inviteLink: string; message: string }>(r)
      ),
    getInvite: (token: string) =>
      apiFetch(`/api/teams/invites/accept/${token}`).then((r) => asJson<{ invite: any }>(r)),
    acceptInvite: (token: string) =>
      apiFetch(`/api/teams/invites/accept/${token}`, { method: 'POST' }).then((r) => asJson<{ ok: boolean; member: any }>(r)),
    updateMember: (teamId: string, memberId: string, data: { role?: string; permissions?: any[] }) =>
      apiFetch(`/api/teams/${teamId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ member: any }>(r)
      ),
    removeMember: (teamId: string, memberId: string) =>
      apiFetch(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),
    resendInvite: (teamId: string, inviteId: string) =>
      apiFetch(`/api/teams/${teamId}/invites/${inviteId}/resend`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; message: string }>(r)
      ),
    revokeInvite: (teamId: string, inviteId: string) =>
      apiFetch(`/api/teams/${teamId}/invites/${inviteId}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),
  },

  leaseweb: {
    configureKey: (apiKey: string) =>
      apiFetch('/api/leaseweb/config', { method: 'POST', body: JSON.stringify({ apiKey }) }).then((r) =>
        asJson<{ ok: boolean; apiKeyConfigured: boolean }>(r)
      ),
    products: (location?: string) =>
      apiFetch(`/api/leaseweb/products${location ? `?location=${location}` : ''}`).then((r) =>
        asJson<{ products: any[] }>(r)
      ),
    listVps: () => apiFetch('/api/leaseweb/vps').then((r) => asJson<{ vpss: any[] }>(r)),
    import: (leasewebVpsId: string, data: Record<string, unknown>) =>
      apiFetch(`/api/leaseweb/vps/${leasewebVpsId}/import`, { method: 'POST', body: JSON.stringify(data) }).then(
        (r) => asJson<{ vpsProvision?: any; node?: any; leasewebInfo: any; warning?: string }>(r)
      ),
    instance: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}`).then((r) => asJson<{ instance: any; monitoring: any }>(r)),
    power: (kind: 'provision' | 'node', id: string, action: 'start' | 'stop' | 'reboot') =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/power`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    console: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/console`).then((r) => asJson<{ url: string }>(r)),
    credentials: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/credentials`).then((r) =>
        asJson<{ username: string; password: string }>(r)
      ),
    snapshots: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/snapshots`).then((r) => asJson<{ snapshots: any[] }>(r)),
    createSnapshot: (kind: 'provision' | 'node', id: string, name: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/snapshots`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }).then((r) => asJson<{ snapshot: any }>(r)),
    restoreSnapshot: (kind: 'provision' | 'node', id: string, snapshotId: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/snapshots/${snapshotId}/restore`, { method: 'POST' }).then(
        (r) => asJson<{ ok: boolean }>(r)
      ),
    deleteSnapshot: (kind: 'provision' | 'node', id: string, snapshotId: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/snapshots/${snapshotId}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean }>(r)
      ),
    reinstall: (kind: 'provision' | 'node', id: string, osCode: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/reinstall`, {
        method: 'POST',
        body: JSON.stringify({ osCode }),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    osOptions: () =>
      apiFetch('/api/leaseweb/os-options').then((r) => asJson<{ osOptions: Array<{ code: string; name: string }> }>(r)),
    dataTraffic: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/data-traffic`).then((r) => asJson<{ traffic: any }>(r)),
    resetPassword: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/reset-password`, { method: 'POST' }).then((r) =>
        asJson<{ credentials: { username: string; password: string }; warning?: string }>(r)
      ),
    sshTicket: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/ssh-ticket`, { method: 'POST' }).then((r) =>
        asJson<{ ticket: string; expiresInMs: number }>(r)
      ),
    /** Admin/dev only server-side — never surface this button to a customer. */
    terminate: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/terminate`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean }>(r)
      ),
    firewall: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/firewall`).then((r) =>
        asJson<{ supported: boolean; reason?: string }>(r)
      ),
    dns: (kind: 'provision' | 'node', id: string) =>
      apiFetch(`/api/leaseweb/instances/${kind}/${id}/dns`).then((r) =>
        asJson<{ supported: boolean; reason?: string }>(r)
      ),
    logs: (take = 50) => apiFetch(`/api/leaseweb/logs?take=${take}`).then((r) => asJson<{ logs: any[] }>(r)),
    health: () =>
      apiFetch('/api/leaseweb/health').then((r) =>
        asJson<{ apiKeyConfigured: boolean; lastCallAt: string | null; lastCallSucceeded: boolean | null }>(r)
      ),
  },

  nodeEngine: {
    monitoring: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/monitoring`).then((r) => asJson<any>(r)),
    installPackage: (nodeId: string, packageName: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/packages/install`, {
        method: 'POST',
        body: JSON.stringify({ packageName }),
      }).then((r) => asJson<{ ok: boolean; package: string; output: string }>(r)),
    upgradePackages: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/packages/upgrade`, {
        method: 'POST',
      }).then((r) => asJson<{ ok: boolean; output: string }>(r)),
    listeningPorts: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/ports`).then((r) => asJson<{ ports: Array<{ protocol: string; port: number; address: string; process: string }> }>(r)),
    services: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/services`).then((r) => asJson<{ services: any[] }>(r)),
    serviceAction: (nodeId: string, serviceName: string, action: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/services/action`, {
        method: 'POST',
        body: JSON.stringify({ serviceName, action }),
      }).then((r) => asJson<any>(r)),
    serviceLogs: (nodeId: string, serviceName: string, lines = 100) =>
      apiFetch(`/api/nodes/${nodeId}/engine/services/logs?serviceName=${encodeURIComponent(serviceName)}&lines=${lines}`).then(
        (r) => asJson<{ service: string; logs: string }>(r)
      ),
    users: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/users`).then((r) => asJson<{ users: any[] }>(r)),
    createUser: (nodeId: string, data: { username: string; password?: string }) =>
      apiFetch(`/api/nodes/${nodeId}/engine/users`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => asJson<any>(r)),
    deleteUser: (nodeId: string, username: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/users/${encodeURIComponent(username)}`, { method: 'DELETE' }).then(
        (r) => asJson<any>(r)
      ),
    setUserPassword: (nodeId: string, username: string, password: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/users/${encodeURIComponent(username)}/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }).then((r) => asJson<any>(r)),
    containers: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/containers`).then((r) => asJson<{ containers: any[] }>(r)),
    createContainer: (nodeId: string, config: { name: string; image: string; env?: string[]; ports?: Array<{ hostPort: number; containerPort: number }>; volumes?: Array<{ hostPath: string; containerPath: string }>; network?: string }) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/containers`, {
        method: 'POST',
        body: JSON.stringify(config),
      }).then((r) => asJson<{ ok: boolean; containerId: string; name: string }>(r)),
    containerAction: (nodeId: string, containerId: string, action: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/containers/${encodeURIComponent(containerId)}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }).then((r) => asJson<any>(r)),
    containerLogs: (nodeId: string, containerId: string, tail = 200) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/containers/${encodeURIComponent(containerId)}/logs?tail=${tail}`).then(
        (r) => asJson<{ containerId: string; logs: string }>(r)
      ),
    networks: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/networks`).then((r) => asJson<{ networks: any[] }>(r)),
    createNetwork: (nodeId: string, name: string, driver = 'bridge') =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/networks`, {
        method: 'POST',
        body: JSON.stringify({ name, driver }),
      }).then((r) => asJson<{ ok: boolean; id: string; name: string }>(r)),
    deployCompose: (nodeId: string, yamlContent: string, projectName = 'stx-stack') =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/compose`, {
        method: 'POST',
        body: JSON.stringify({ yamlContent, projectName }),
      }).then((r) => asJson<{ ok: boolean; output: string }>(r)),
    pruneDocker: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/prune`, {
        method: 'POST',
      }).then((r) => asJson<{ ok: boolean; containersPruned: number; imagesPruned: number }>(r)),
    containerInspect: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/containers/${encodeURIComponent(containerId)}/inspect`).then((r) => asJson<any>(r)),
    containerStats: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/containers/${encodeURIComponent(containerId)}/stats`).then((r) => asJson<any>(r)),
    images: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/images`).then((r) => asJson<{ images: any[] }>(r)),
    pullImage: (nodeId: string, imageName: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/images/pull`, {
        method: 'POST',
        body: JSON.stringify({ imageName }),
      }).then((r) => asJson<any>(r)),
    deleteImage: (nodeId: string, imageId: string, force = false) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/images/${encodeURIComponent(imageId)}?force=${force}`, {
        method: 'DELETE',
      }).then((r) => asJson<any>(r)),
    volumes: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/volumes`).then((r) => asJson<{ volumes: any[] }>(r)),
    createVolume: (nodeId: string, data: { name: string; driver?: string; labels?: Record<string, string> }) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/volumes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => asJson<any>(r)),
    deleteVolume: (nodeId: string, name: string, force = false) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/volumes/${encodeURIComponent(name)}?force=${force}`, {
        method: 'DELETE',
      }).then((r) => asJson<any>(r)),
    deleteNetwork: (nodeId: string, networkId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/docker/networks/${encodeURIComponent(networkId)}`, {
        method: 'DELETE',
      }).then((r) => asJson<any>(r)),
    firewallStatus: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall`).then((r) => asJson<any>(r)),
    enableFirewall: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall/enable`, { method: 'POST' }).then((r) => asJson<any>(r)),
    disableFirewall: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall/disable`, { method: 'POST' }).then((r) => asJson<any>(r)),
    resetFirewall: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall/reset`, { method: 'POST' }).then((r) => asJson<any>(r)),
    addFirewallRule: (nodeId: string, rule: { port: number | string; protocol: string; action: string; sourceIp?: string }) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall/rules`, {
        method: 'POST',
        body: JSON.stringify(rule),
      }).then((r) => asJson<any>(r)),
    deleteFirewallRule: (nodeId: string, portOrParams: string | { port?: string | number; protocol?: string; ruleIndex?: number }, protocol?: string) => {
      let q = '';
      if (typeof portOrParams === 'object') {
        const params = new URLSearchParams();
        if (portOrParams.port) params.set('port', String(portOrParams.port));
        if (portOrParams.protocol) params.set('protocol', String(portOrParams.protocol));
        if (portOrParams.ruleIndex !== undefined) params.set('ruleIndex', String(portOrParams.ruleIndex));
        q = params.toString();
      } else {
        q = `port=${encodeURIComponent(portOrParams)}&protocol=${encodeURIComponent(protocol || 'tcp')}`;
      }
      return apiFetch(`/api/nodes/${nodeId}/engine/firewall/rules?${q}`, {
        method: 'DELETE',
      }).then((r) => asJson<any>(r));
    },
    /** Mint a short-lived SSH ticket for the Node Engine terminal */
    sshTicket: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/ssh-ticket`, { method: 'POST' }).then(
        (r) => asJson<{ ticket: string; expiresInMs: number; ip: string; sshKeyRef: string }>(r)
      ),
  },

  git: {
    config: () =>
      apiFetch('/api/git/config').then((r) =>
        asJson<{ providers: Array<{ provider: 'github' | 'gitlab'; configured: boolean }> }>(r)
      ),
    accounts: () =>
      apiFetch('/api/git/accounts').then((r) =>
        asJson<{
          accounts: Array<{
            id: string;
            provider: 'github' | 'gitlab';
            accountLabel: string;
            accountType?: string;
            avatarUrl?: string | null;
            updatedAt: string;
          }>;
        }>(r)
      ),
    repos: (accountId: string, provider: 'github' | 'gitlab' = 'github') =>
      apiFetch(`/api/git/repos?accountId=${encodeURIComponent(accountId)}&provider=${encodeURIComponent(provider)}`).then((r) =>
        asJson<{
          repos: Array<{
            id: string;
            name: string;
            fullName: string;
            private: boolean;
            defaultBranch: string;
            htmlUrl: string;
          }>;
          accountId: string;
          accountLabel: string;
        }>(r)
      ),
    // Returns a URL to redirect the browser to (GitHub App install page /
    // GitLab OAuth authorize page) — the frontend never handles a token
    // as part of connecting an account.
    getConnectUrl: (provider: 'github' | 'gitlab') =>
      apiFetch(`/api/git/connect/${provider}/start`).then((r) => asJson<{ url: string }>(r)),
    disconnect: (provider: 'github' | 'gitlab', accountId: string) =>
      apiFetch('/api/git/disconnect', { method: 'POST', body: JSON.stringify({ provider, accountId }) }).then((r) =>
        asJson<{ ok: boolean }>(r)
      ),
  },


  traefik: {
    overview: () => apiFetch('/api/traefik/overview').then((r) => asJson<{ overview: any }>(r)),
    routers: () => apiFetch('/api/traefik/routers').then((r) => asJson<{ routers: any[] }>(r)),
    services: () => apiFetch('/api/traefik/services').then((r) => asJson<{ services: any[] }>(r)),
    middlewares: () => apiFetch('/api/traefik/middlewares').then((r) => asJson<{ middlewares: any[] }>(r)),
  },

  backups: {
    run: () => apiFetch('/api/admin/backup/run', { method: 'POST' }).then((r) => asJson<{ ok: boolean; key: string; sizeBytes: number; durationMs: number }>(r)),
    history: () =>
      apiFetch('/api/admin/backup/history').then((r) =>
        asJson<{
          runs: Array<{ id: string; triggeredBy: string; success: boolean; r2Key: string | null; sizeBytes: number | null; durationMs: number | null; error: string | null; createdAt: string }>;
        }>(r)
      ),
    exportZipUrl: '/api/admin/backup/export-zip',
    exportZip: async () => {
      const res = await apiFetch('/api/admin/backup/export-zip');
      if (!res.ok) throw new Error(`Backup export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shanutechx_platform_backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  },

  fs: {
    list: (deploymentId: string, path = '') =>
      apiFetch(`/api/fs/${deploymentId}/list?path=${encodeURIComponent(path)}`).then((r) =>
        asJson<{ items: Array<{ name: string; type: 'file' | 'dir'; size: number | null; mtime: number | null }> }>(r)
      ),
    read: (deploymentId: string, path: string) =>
      apiFetch(`/api/fs/${deploymentId}/read?path=${encodeURIComponent(path)}`).then((r) =>
        asJson<{ content: string }>(r)
      ),
    write: (deploymentId: string, path: string, content: string) =>
      apiFetch(`/api/fs/${deploymentId}/write`, {
        method: 'PUT',
        body: JSON.stringify({ path, content }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    mkdir: (deploymentId: string, path: string) =>
      apiFetch(`/api/fs/${deploymentId}/mkdir`, {
        method: 'POST',
        body: JSON.stringify({ path }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    delete: (deploymentId: string, path: string) =>
      apiFetch(`/api/fs/${deploymentId}/delete`, {
        method: 'DELETE',
        body: JSON.stringify({ path }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    rename: (deploymentId: string, from: string, to: string) =>
      apiFetch(`/api/fs/${deploymentId}/rename`, {
        method: 'POST',
        body: JSON.stringify({ from, to }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    gitCommitPush: (deploymentId: string, filePath: string, content: string, commitMessage: string, accountId?: string) =>
      apiFetch(`/api/fs/${deploymentId}/git-commit-push`, {
        method: 'POST',
        body: JSON.stringify({ filePath, content, commitMessage, accountId }),
      }).then((r) =>
        asJson<{ ok: boolean; provider: string; commitSha?: string; commitUrl?: string }>(r)
      ),
    uploadBinary: (deploymentId: string, path: string, base64Content: string) =>
      apiFetch(`/api/fs/${deploymentId}/upload-binary`, {
        method: 'POST',
        body: JSON.stringify({ path, base64Content }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    extractArchive: (deploymentId: string, path: string) =>
      apiFetch(`/api/fs/${deploymentId}/extract`, {
        method: 'POST',
        body: JSON.stringify({ path }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
  },

  catalog: {
    list: (params?: { search?: string; category?: string }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.category) qs.set('category', params.category);
      return apiFetch(`/api/catalog?${qs.toString()}`).then((r) =>
        asJson<{ templates: CatalogTemplate[]; categories: string[]; total: number }>(r)
      );
    },
    get: (slug: string) =>
      apiFetch(`/api/catalog/${slug}`).then((r) =>
        asJson<{ template: CatalogTemplate & { yaml: string } }>(r)
      ),
    create: (slug: string, data: {
      name?: string;
      slogan?: string;
      category?: string;
      tags?: string[];
      logo?: string;
      port?: number | null;
      documentation?: string;
      yaml: string;
    }) =>
      apiFetch(`/api/catalog/${slug}`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ template: CatalogTemplate }>(r)
      ),
    update: (slug: string, data: {
      name?: string;
      slogan?: string;
      category?: string;
      tags?: string[];
      logo?: string;
      port?: number | null;
      documentation?: string;
      yaml?: string;
    }) =>
      apiFetch(`/api/catalog/${slug}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ template: CatalogTemplate }>(r)
      ),
    delete: (slug: string) =>
      apiFetch(`/api/catalog/${slug}`, { method: 'DELETE' }).then((r) =>
        asJson<{ success: boolean; slug: string }>(r)
      ),
    deploy: (body: {
      slug: string;
      nodeId?: string;
      envVars?: Record<string, string>;
      projectName?: string;
      preferredName?: string;
      teamId?: string | null;
      orderItemId?: string;
      exposureMode?: string;
      configFiles?: Record<string, string>;
      configFileContent?: string;
      configFileName?: string;
      cpuLimit?: string;
      memoryLimit?: string;
      builder?: string;
    }) =>
      apiFetch('/api/catalog/deploy', { method: 'POST', body: JSON.stringify(body) }).then((r) =>
        asJson<{ deployment: Deployment; agent: Record<string, unknown>; generatedSecrets?: Record<string, string>; configFiles?: string[] }>(r)
      ),
    nodes: () =>
      apiFetch('/api/catalog/nodes').then((r) =>
        asJson<{ nodes: Array<{ id: string; name: string; location: string; status: string }> }>(r)
      ),
  },

  products: {
    list: (category?: string, all = false) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (all) params.set('all', 'true');
      const qs = params.toString();
      return apiFetch(`/api/products${qs ? `?${qs}` : ''}`).then((r) =>
        asJson<{ products: Product[] }>(r)
      );
    },
    get: (id: string) => apiFetch(`/api/products/${id}`).then((r) => asJson<{ product: Product }>(r)),
    createProduct: (data: {
      category: string;
      name: string;
      description?: string | null;
      iconUrl?: string | null;
      isPopular?: boolean;
      badge?: string | null;
      isActive?: boolean;
    }) =>
      apiFetch('/api/products', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ product: Product }>(r)
      ),
    create: (data: {
      category: string;
      name: string;
      description?: string | null;
      iconUrl?: string | null;
      isPopular?: boolean;
      badge?: string | null;
      isActive?: boolean;
    }) =>
      apiFetch('/api/products', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ product: Product }>(r)
      ),
    updateProduct: (id: string, data: Partial<{
      category: string;
      name: string;
      description: string | null;
      iconUrl: string | null;
      isPopular: boolean;
      badge: string | null;
      isActive: boolean;
    }>) =>
      apiFetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ product: Product }>(r)
      ),
    update: (id: string, data: Partial<{
      category: string;
      name: string;
      description: string | null;
      iconUrl: string | null;
      isPopular: boolean;
      badge: string | null;
      isActive: boolean;
    }>) =>
      apiFetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ product: Product }>(r)
      ),
    deleteProduct: (id: string) =>
      apiFetch(`/api/products/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; message?: string; deactivated?: boolean }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/products/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; message?: string; deactivated?: boolean }>(r)
      ),
    createPlan: (productId: string, data: {
      name: string;
      price: number;
      currency?: 'LKR' | 'USD';
      billingType: string;
      isPopular?: boolean;
      badge?: string | null;
      specsJson?: Record<string, unknown> | null;
      isActive?: boolean;
    }) =>
      apiFetch(`/api/products/${productId}/plans`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ plan: Plan }>(r)
      ),
    updatePlan: (id: string, data: Partial<{
      name: string;
      price: number;
      currency: 'LKR' | 'USD';
      billingType: string;
      isPopular: boolean;
      badge: string | null;
      specsJson: Record<string, unknown> | null;
      isActive: boolean;
    }>) =>
      apiFetch(`/api/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ plan: Plan }>(r)
      ),
    togglePlan: (id: string, isActive?: boolean) =>
      apiFetch(`/api/plans/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify(typeof isActive === 'boolean' ? { isActive } : {}),
      }).then((r) => asJson<{ ok: boolean; plan: Plan }>(r)),
    deletePlan: (id: string) =>
      apiFetch(`/api/plans/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; message?: string; deactivated?: boolean; deleted?: boolean; plan?: Plan }>(r)
      ),
  },

  vpsPlans: {
    list: () => apiFetch('/api/vps-plans').then((r) => asJson<{ plans: VpsPlan[] }>(r)),
    create: (data: {
      provider: string;
      name: string;
      bandwidth: string;
      category: 'web_hosting' | 'app_server' | 'database_server' | 'storage_server';
      cpuCores: number;
      ramGb: number;
      storageGb: number;
      price: number;
      currency?: 'LKR' | 'USD';
      billingPeriod?: 'one_time' | 'monthly' | 'yearly';
      isActive?: boolean;
      leasewebProductCode?: string;
    }) =>
      apiFetch('/api/vps-plans', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ plan: VpsPlan }>(r)
      ),
    update: (id: string, data: Partial<{
      provider: string;
      name: string;
      bandwidth: string;
      category: 'web_hosting' | 'app_server' | 'database_server' | 'storage_server';
      cpuCores: number;
      ramGb: number;
      storageGb: number;
      price: number;
      currency: 'LKR' | 'USD';
      billingPeriod: 'one_time' | 'monthly' | 'yearly';
      isActive: boolean;
      leasewebProductCode: string;
    }>) =>
      apiFetch(`/api/vps-plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ plan: VpsPlan }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/vps-plans/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ success: boolean; id: string }>(r)
      ),
  },

  settings: {
    verifyPassword: (password: string) =>
      apiFetch('/api/settings/verify-password', { method: 'POST', body: JSON.stringify({ password }) }).then((r) =>
        asJson<{ ok: boolean; unlocked: boolean; unlockToken?: string; message: string }>(r)
      ),
    changePin: (currentPin: string, newPin: string) =>
      apiFetch('/api/settings/change-pin', { method: 'POST', body: JSON.stringify({ currentPin, newPin }) }).then((r) =>
        asJson<{ ok: boolean; message: string }>(r)
      ),
    getConfigs: () =>
      apiFetch('/api/settings/configs').then((r) =>
        asJson<{
          configs: {
            discordWebhooks: { configured: boolean; count: number };
            backups: { configured: boolean; lastBackup: any; totalRuns: number };
            smtpServer: { configured: boolean };
            r2Storage: { configured: boolean };
            githubBackup?: { configured: boolean; org: string };
          };
        }>(r)
      ),
    getGithubBackup: () =>
      apiFetch('/api/settings/github-backup').then((r) =>
        asJson<{ configured: boolean; org: string; maskedToken: string }>(r)
      ),
    saveGithubBackup: (token: string, org?: string) =>
      apiFetch('/api/settings/github-backup', { method: 'POST', body: JSON.stringify({ token, org, unlockToken: getSettingsUnlockToken() }) }).then((r) =>
        asJson<{ ok: boolean; message: string; configured: boolean; org: string }>(r)
      ),
    testGithubBackup: (token?: string, org?: string) =>
      apiFetch('/api/settings/github-backup/test', { method: 'POST', body: JSON.stringify({ token, org, unlockToken: getSettingsUnlockToken() }) }).then((r) =>
        asJson<{
          ok: boolean;
          user: { login: string; name: string | null; publicRepos: number; totalPrivateRepos: number; avatarUrl?: string };
          scopes: string;
          org?: { login: string; name: string | null; publicRepos: number; totalPrivateRepos: number } | null;
          message: string;
        }>(r)
      ),
    getSmtpConfig: () =>
      apiFetch('/api/settings/smtp').then((r) => asJson<{ config: any }>(r)),
    saveSmtpConfig: (data: any) =>
      apiFetch('/api/settings/smtp', {
        method: 'PUT',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ ok: boolean; message: string }>(r)),
    testSmtpConnection: (data: any) =>
      apiFetch('/api/settings/smtp/test', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ ok: boolean; message: string; latencyMs: number }>(r)),
  },

  managedDatabases: {
    list: () => apiFetch('/api/managed-databases').then((r) => asJson<{ databases: ManagedDatabase[] }>(r)),
    listByProject: (projectId: string) =>
      apiFetch(`/api/managed-databases?projectId=${encodeURIComponent(projectId)}`).then((r) => asJson<{ databases: ManagedDatabase[] }>(r)),
    create: (data: {
      userId?: string;
      projectId?: string;
      type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
      dbName?: string;
      masterUsername?: string;
      masterPassword?: string;
      allowedIps?: string[];
      maxConnections?: number;
      dbVersion?: string;
      cpuLimit?: number;
      memoryLimitMb?: number;
      storageLimitGb?: number;
    }) =>
      apiFetch('/api/managed-databases', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ database: ManagedDatabase & { masterUsername?: string; masterPassword?: string } }>(r)
      ),
    revealPassword: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/reveal-password`).then((r) => asJson<{ password: string }>(r)),
    getConnection: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/connection`).then((r) =>
        asJson<{
          type: string;
          host: string;
          port: number;
          poolerPort?: number;
          username: string;
          password: string;
          databaseName: string;
          sslMode?: string;
          allowedIps?: string[];
          connectionString: string;
          pooledConnectionString?: string;
          snippets?: Record<string, string>;
        }>(r)
      ),
    action: (id: string, action: 'start' | 'stop' | 'restart') =>
      apiFetch(`/api/managed-databases/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }).then((r) =>
        asJson<{ ok: boolean; database: ManagedDatabase }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/managed-databases/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),
    listUsers: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/users`).then((r) => asJson<{ users: ManagedDatabaseUser[] }>(r)),
    createUser: (id: string, data: { username: string; password?: string; role?: 'admin' | 'read_write' | 'read_only' }) =>
      apiFetch(`/api/managed-databases/${id}/users`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ user: ManagedDatabaseUser & { password?: string } }>(r)
      ),
    deleteUser: (id: string, username: string) =>
      apiFetch(`/api/managed-databases/${id}/users/${encodeURIComponent(username)}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedUsername: string }>(r)
      ),
    updateUser: (id: string, username: string, data: { password?: string; role?: 'admin' | 'read_write' | 'read_only' }) =>
      apiFetch(`/api/managed-databases/${id}/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ user: ManagedDatabaseUser & { password?: string } }>(r)
      ),
    updateConfig: (id: string, data: { dbName?: string; allowedIps?: string[]; maxConnections?: number; dbVersion?: string }) =>
      apiFetch(`/api/managed-databases/${id}/config`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ database: ManagedDatabase }>(r)
      ),
    executeQuery: (id: string, query: string) =>
      apiFetch(`/api/managed-databases/${id}/query`, { method: 'POST', body: JSON.stringify({ query }) }).then((r) =>
        asJson<{ ok: boolean; exitCode: number; rawOutput: string; executionTimeMs: number }>(r)
      ),
    rotateMasterPassword: (id: string, newPassword: string) =>
      apiFetch(`/api/managed-databases/${id}/master-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }).then((r) =>
        asJson<{ ok: boolean; message: string; databaseId: string }>(r)
      ),
    listBackups: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/backups`).then((r) =>
        asJson<{ backups: Array<{ backupId: string; databaseId: string; filename: string; sizeBytes: number; createdAt: string }> }>(r)
      ),
    backup: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/backups`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; backup: { backupId: string; databaseId: string; filename: string; sizeBytes: number; createdAt: string } }>(r)
      ),
    restore: (id: string, backupId: string) =>
      apiFetch(`/api/managed-databases/${id}/restore`, { method: 'POST', body: JSON.stringify({ backupId }) }).then((r) =>
        asJson<{ ok: boolean; containerId: string; backupId: string; message: string }>(r)
      ),
    connection: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/connection`).then((r) =>
        asJson<{
          type: string;
          host: string;
          port: number;
          poolerPort?: number;
          username: string;
          password: string;
          databaseName: string;
          sslMode: string;
          allowedIps: string[];
          connectionString: string;
          pooledConnectionString?: string;
          snippets: Record<string, string>;
        }>(r)
      ),
    getSchema: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/schema`).then((r) =>
        asJson<{ tables: Array<{ name: string; columns: Array<{ name: string; type: string; nullable: boolean; isPrimaryKey: boolean; isForeignKey: boolean; defaultValue?: string }> }> }>(r)
      ),
    getExtensions: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/extensions`).then((r) =>
        asJson<{ extensions: Array<{ name: string; description: string; isEnabled: boolean }> }>(r)
      ),
    toggleExtension: (id: string, extensionName: string, enable: boolean) =>
      apiFetch(`/api/managed-databases/${id}/extensions/toggle`, { method: 'POST', body: JSON.stringify({ extensionName, enable }) }).then((r) =>
        asJson<{ ok: boolean; extensionName: string; isEnabled: boolean; extensions?: Array<{ name: string; description: string; isEnabled: boolean }> }>(r)
      ),
    getSnippets: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/snippets`).then((r) =>
        asJson<{ snippets: Array<{ id: string; databaseId: string; title: string; sql: string; createdAt: string }> }>(r)
      ),
    saveSnippet: (id: string, data: { title: string; sql: string }) =>
      apiFetch(`/api/managed-databases/${id}/snippets`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ snippet: { id: string; databaseId: string; title: string; sql: string; createdAt: string } }>(r)
      ),
    deleteSnippet: (id: string, snippetId: string) =>
      apiFetch(`/api/managed-databases/${id}/snippets/${snippetId}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean }>(r)
      ),
    getMetrics: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/metrics`).then((r) =>
        asJson<{
          metrics: {
            cpuPct: number;
            ramMb: number;
            maxRamMb: number;
            ramPct: number;
            storageGb: number;
            maxStorageGb: number;
            storagePct: number;
            activeConnections: number;
            maxConnections: number;
            slowQueries: any[];
            warnings: string[];
            updatedAt: string;
          };
        }>(r)
      ),
    getLogs: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/logs`).then((r) => asJson<{ logs: Array<{ timestamp: string; message: string }> }>(r)),
    migrate: (id: string, targetNodeId?: string) =>
      apiFetch(`/api/managed-databases/${id}/migrate`, { method: 'POST', body: JSON.stringify({ targetNodeId }) }).then((r) =>
        asJson<{ ok: boolean; message: string; database: ManagedDatabase }>(r)
      ),
    scale: (
      id: string,
      data: { cpuLimit?: number; memoryLimitMb?: number; storageLimitGb?: number; maxConnections?: number; dbVersion?: string }
    ) =>
      apiFetch(`/api/managed-databases/${id}/scale`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; message: string; database: ManagedDatabase }>(r)
      ),
    s3Backups: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/s3-backups`).then((r) => asJson<{ backups: any[] }>(r)),
    createS3Backup: (id: string, data: { s3Endpoint?: string; s3Bucket: string; s3AccessKeyId?: string; s3SecretAccessKey?: string; region?: string }) =>
      apiFetch(`/api/managed-databases/${id}/s3-backups`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; backup: any }>(r)
      ),
    restoreS3Backup: (id: string, backupId: string) =>
      apiFetch(`/api/managed-databases/${id}/s3-restore`, { method: 'POST', body: JSON.stringify({ backupId }) }).then((r) =>
        asJson<{ ok: boolean; restoredBackupId: string }>(r)
      ),
    renew: (id: string, months: number = 1) =>
      apiFetch(`/api/managed-databases/${id}/renew`, { method: 'POST', body: JSON.stringify({ months }) }).then((r) =>
        asJson<{ ok: boolean; message: string; orderId: string }>(r)
      ),
  },

  projects: {
    list: (params?: { search?: string; isArchived?: boolean }) => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append('search', params.search);
      if (params?.isArchived !== undefined) searchParams.append('isArchived', String(params.isArchived));
      const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return apiFetch(`/api/projects${qs}`).then((r) => asJson<{ projects: Project[] }>(r));
    },
    create: (data: { name: string; description?: string; region?: string; nodeId?: string; targetUserId?: string; userId?: string }) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ project: Project }>(r)),
    get: (id: string) =>
      apiFetch(`/api/projects/${id}`).then((r) => asJson<{ project: Project }>(r)),
    update: (id: string, data: { name?: string; description?: string; region?: string; isArchived?: boolean }) =>
      apiFetch(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => asJson<{ project: Project }>(r)),
    delete: (id: string) =>
      apiFetch(`/api/projects/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean; deletedId: string }>(r)),
    members: (id: string) =>
      apiFetch(`/api/projects/${id}/members`).then((r) => asJson<{ members: ProjectMember[] }>(r)),
    addMember: (id: string, data: { email: string; role?: string }) =>
      apiFetch(`/api/projects/${id}/members`, { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ member: ProjectMember; project: Project }>(r)),
    removeMember: (id: string, memberUserId: string) =>
      apiFetch(`/api/projects/${id}/members/${memberUserId}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean; removedUserId: string; project: Project }>(r)),
    projectDatabases: (id: string) =>
      apiFetch(`/api/projects/${id}/databases`).then((r) => asJson<{ databases: ManagedDatabase[] }>(r)),
    provisionStorage: (id: string) =>
      apiFetch(`/api/projects/${id}/storage`, { method: 'POST' }).then((r) => asJson<{ bucketName: string; endpoint: string }>(r)),
    tables: (id: string) =>
      apiFetch(`/api/projects/${id}/tables`).then((r) => asJson<{ tables: ProjectTable[] }>(r)),
    rows: (id: string, table: string, page = 1, limit = 50) =>
      apiFetch(`/api/projects/${id}/tables/${encodeURIComponent(table)}/rows?page=${page}&limit=${limit}`).then((r) =>
        asJson<{ rows: Record<string, unknown>[]; total?: number }>(r)
      ),
    insertRow: (id: string, table: string, data: Record<string, unknown>) =>
      apiFetch(`/api/projects/${id}/tables/${encodeURIComponent(table)}/rows`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; inserted: Record<string, unknown> }>(r)
      ),
    updateRow: (id: string, table: string, pk: string | number, data: Record<string, unknown>) =>
      apiFetch(`/api/projects/${id}/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(pk)}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; updated: Record<string, unknown> }>(r)
      ),
    deleteRow: (id: string, table: string, pk: string | number) =>
      apiFetch(`/api/projects/${id}/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(pk)}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedPk: string | number }>(r)
      ),
    sql: (id: string, sql: string) =>
      apiFetch(`/api/projects/${id}/sql`, { method: 'POST', body: JSON.stringify({ sql }) }).then((r) =>
        asJson<SqlResult>(r)
      ),
    query: (id: string, sql: string) =>
      apiFetch(`/api/projects/${id}/sql`, { method: 'POST', body: JSON.stringify({ sql }) }).then((r) =>
        asJson<SqlResult>(r)
      ),
    listSnippets: (id: string) =>
      apiFetch(`/api/projects/${id}/snippets`).then((r) => asJson<{ snippets: Array<{ id: string; title: string; query: string; createdAt: string }> }>(r)),
    createSnippet: (id: string, data: { title: string; query: string }) =>
      apiFetch(`/api/projects/${id}/snippets`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ snippet: { id: string; title: string; query: string; createdAt: string } }>(r)
      ),
    deleteSnippet: (id: string, snippetId: string) =>
      apiFetch(`/api/projects/${id}/snippets/${snippetId}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    authUsers: (id: string) =>
      apiFetch(`/api/projects/${id}/auth/users`).then((r) => asJson<{ users: any[] }>(r)),
    oauthConfigs: (id: string) =>
      apiFetch(`/api/projects/${id}/auth/oauth/configs`).then((r) => asJson<{ configs: any[] }>(r)),
    saveOAuthConfig: (id: string, data: any) =>
      apiFetch(`/api/projects/${id}/auth/oauth/configs`, { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ config: any }>(r)),
  },

  notifications: {
    listChannels: () =>
      apiFetch('/api/notifications/channels').then((r) => asJson<{ channels: any[] }>(r)),
    createChannel: (data: { name: string; type: string; configJson: Record<string, any>; isEnabled?: boolean }) =>
      apiFetch('/api/notifications/channels', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ channel: any }>(r)
      ),
    updateChannel: (id: string, data: { name?: string; configJson?: Record<string, any>; isEnabled?: boolean }) =>
      apiFetch(`/api/notifications/channels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ channel: any }>(r)
      ),
    deleteChannel: (id: string) =>
      apiFetch(`/api/notifications/channels/${id}`, { method: 'DELETE' }).then((r) => asJson<{ success: boolean }>(r)),
    testChannel: (id: string) =>
      apiFetch(`/api/notifications/channels/${id}/test`, { method: 'POST' }).then((r) =>
        asJson<{ success: boolean; detail: string; dispatchedAt: string }>(r)
      ),
  },

  devSupabase: {
    health: (projectId?: string) =>
      apiFetch(`/api/supabase/health${projectId ? `?projectId=${projectId}` : ''}`).then((r) =>
        asJson<{ status: string; services: Record<string, string>; urls: Record<string, string> }>(r)
      ),
    listProjects: () =>
      apiFetch('/api/supabase/projects').then((r) => asJson<{ projects: SupabaseClientProject[]; total: number }>(r)),
    getProject: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}`).then((r) => asJson<{ project: SupabaseClientProject }>(r)),
    createProject: (data: { name: string; clientEmail: string; region?: string; nodeId?: string }) =>
      apiFetch('/api/supabase/projects', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ project: SupabaseClientProject }>(r)
      ),
    startProject: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/start`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: SupabaseClientProject }>(r)
      ),
    stopProject: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/stop`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: SupabaseClientProject }>(r)
      ),
    restartProject: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/restart`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: SupabaseClientProject }>(r)
      ),
    retryProject: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/retry`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; project: SupabaseClientProject }>(r)
      ),
    migrateProject: (id: string, targetNodeId: string) =>
      apiFetch(`/api/supabase/projects/${id}/migrate`, {
        method: 'POST',
        body: JSON.stringify({ targetNodeId }),
      }).then((r) => asJson<{ ok: boolean; project: SupabaseClientProject }>(r)),
    getProjectLogs: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}/logs`).then((r) => asJson<{ logs: any[] }>(r)),
    deleteProject: (id: string) =>
      apiFetch(`/api/supabase/projects/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),
    updateProjectConfig: (id: string, data: Record<string, any>) =>
      apiFetch(`/api/supabase/projects/${id}/config`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; project: SupabaseClientProject }>(r)
      ),
    getSchemas: (projectId?: string) =>
      apiFetch(`/api/supabase/db/schemas${projectId ? `?projectId=${projectId}` : ''}`).then((r) => asJson<{ schemas: any[] }>(r)),
    getTables: (projectId?: string) =>
      apiFetch(`/api/supabase/db/tables${projectId ? `?projectId=${projectId}` : ''}`).then((r) => asJson<{ tables: any[] }>(r)),
    executeQuery: (sql: string, projectId?: string) =>
      apiFetch('/api/supabase/db/query', { method: 'POST', body: JSON.stringify({ sql, projectId }) }).then((r) => asJson<any>(r)),
    getBuckets: (projectId?: string) =>
      apiFetch(`/api/supabase/storage/buckets${projectId ? `?projectId=${projectId}` : ''}`).then((r) => asJson<{ buckets: any[] }>(r)),
    createBucket: (data: { id: string; name: string; isPublic?: boolean; projectId?: string }) =>
      apiFetch('/api/supabase/storage/buckets', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<any>(r)
      ),
    getAuthUsers: (projectId?: string) =>
      apiFetch(`/api/supabase/auth/users${projectId ? `?projectId=${projectId}` : ''}`).then((r) => asJson<{ users: any[]; total: number }>(r)),
    createAuthUser: (data: { email: string; password: string; user_metadata?: any; projectId?: string }) =>
      apiFetch('/api/supabase/auth/users', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<any>(r)
      ),
    deleteAuthUser: (id: string, projectId?: string) =>
      apiFetch(`/api/supabase/auth/users/${id}${projectId ? `?projectId=${projectId}` : ''}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    getAdvisors: (projectId?: string) =>
      apiFetch(`/api/supabase/advisors${projectId ? `?projectId=${projectId}` : ''}`).then((r) => asJson<{ security: any[]; performance: any[] }>(r)),
    getObservability: (projectId?: string) =>
      apiFetch(`/api/supabase/observability${projectId ? `?projectId=${projectId}` : ''}`).then((r) => asJson<{ metrics: any }>(r)),
    getLogs: (service?: string, projectId?: string) => {
      const params = new URLSearchParams();
      if (service) params.set('service', service);
      if (projectId) params.set('projectId', projectId);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return apiFetch(`/api/supabase/logs${queryStr}`).then((r) => asJson<{ logs: any[] }>(r));
    },
    getFunctions: (projectId?: string) =>
      apiFetch(`/api/supabase/functions${projectId ? `?projectId=${projectId}` : ''}`).then((r) => asJson<{ functions: any[] }>(r)),
    invokeFunction: (name: string, payload: any, projectId?: string) =>
      apiFetch(`/api/supabase/functions/${name}/invoke${projectId ? `?projectId=${projectId}` : ''}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((r) => asJson<any>(r)),
    getIntegrations: (projectId?: string) =>
      apiFetch(`/api/supabase/integrations${projectId ? `?projectId=${projectId}` : ''}`).then((r) =>
        asJson<{ webhooks: any[]; vaultSecrets: any[]; fdw: any[] }>(r)
      ),
    getTableRows: (tableName: string, schema = 'public', limit = 50, projectId?: string) =>
      apiFetch('/api/supabase/db/query', {
        method: 'POST',
        body: JSON.stringify({ sql: `SELECT * FROM "${schema}"."${tableName}" LIMIT ${limit};`, projectId }),
      }).then((r) => asJson<any>(r)),
  },
};


