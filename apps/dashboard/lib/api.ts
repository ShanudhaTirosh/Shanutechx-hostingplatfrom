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
  Subscription,
  Project,
  ProjectTable,
  SqlResult,
  CatalogTemplate,
  VpsPlan,
} from './types';

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  me: () => apiFetch('/api/me').then((r) => asJson<{ user: ApiUser; rootDomain: string }>(r)),


  updateProfile: (data: { displayName?: string; phoneNumber?: string | null; discordUserId?: string | null }) =>
    apiFetch('/api/me', { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
      asJson<{ user: ApiUser }>(r)
    ),

  updateRole: (role: 'customer' | 'support' | 'dev' | 'admin') =>
    apiFetch('/api/me/role', { method: 'PATCH', body: JSON.stringify({ role }) }).then((r) =>
      asJson<{ user: ApiUser; rootDomain: string }>(r)
    ),

  admin: {
    customers: (takeOrSearch?: number | string, skip = 0, search?: string) => {
      let takeVal = 50;
      let searchVal = search;
      if (typeof takeOrSearch === 'string') {
        searchVal = takeOrSearch;
      } else if (typeof takeOrSearch === 'number') {
        takeVal = takeOrSearch;
      }
      return apiFetch(`/api/admin/customers?take=${takeVal}&skip=${skip}${searchVal ? `&search=${encodeURIComponent(searchVal)}` : ''}`).then(
        (r) => asJson<{ customers: Customer[]; total: number }>(r)
      );
    },
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
  },

  email: {
    mailboxes: () => apiFetch('/api/email/mailboxes').then((r) => asJson<{ mailboxes: any[]; total: number }>(r)),
    credentials: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/credentials`).then((r) =>
        asJson<{ smtpHost: string; smtpPort: number; username: string; password?: string; imapHost: string; imapPort: number }>(r)
      ),
    renew: (id: string) =>
      apiFetch(`/api/email/mailboxes/${id}/renew`, { method: 'POST' }).then((r) =>
        asJson<{ ok: boolean; message: string; expiresAt: string }>(r)
      ),
    createMailbox: (data: { email: string; password: string; storageQuotaMb?: number; dailySendLimit?: number }) =>
      apiFetch('/api/email/mailboxes', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ mailbox: any }>(r)),
    deleteMailbox: (id: string) => apiFetch(`/api/email/mailboxes/${id}`, { method: 'DELETE' }).then((r) => asJson<{ success: boolean }>(r)),
    domains: () => apiFetch('/api/email/domains').then((r) => asJson<{ domains: any[] }>(r)),
    addDomain: (domain: string) =>
      apiFetch('/api/email/domains', { method: 'POST', body: JSON.stringify({ domain }) }).then((r) => asJson<{ domain: any }>(r)),
    verifyDomain: (id: string) =>
      apiFetch(`/api/email/domains/${id}/verify`, { method: 'POST' }).then((r) => asJson<{ domain: any; verified: boolean; message: string }>(r)),
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

  products: {
    list: (category?: ProductCategory) =>
      apiFetch(`/api/products${category ? `?category=${category}` : ''}`).then((r) =>
        asJson<{ products: Product[] }>(r)
      ),
    get: (id: string) => apiFetch(`/api/products/${id}`).then((r) => asJson<{ product: Product }>(r)),
    create: (data: { category: ProductCategory; name: string; description?: string; iconUrl?: string }) =>
      apiFetch('/api/products', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ product: Product }>(r)
      ),
    update: (id: string, data: Partial<{ category: ProductCategory; name: string; description: string | null; isActive: boolean }>) =>
      apiFetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ product: Product }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/products/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    createPlan: (
      productId: string,
      data: { name: string; price: number; currency?: string; billingType: PlanBillingType; specsJson?: Record<string, unknown> }
    ) =>
      apiFetch(`/api/products/${productId}/plans`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ plan: Plan }>(r)
      ),
    updatePlan: (id: string, data: Partial<{ name: string; price: number; billingType: PlanBillingType; isActive: boolean; specsJson: Record<string, unknown> }>) =>
      apiFetch(`/api/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) => asJson<{ plan: Plan }>(r)),
    deletePlan: (id: string) =>
      apiFetch(`/api/plans/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean; plan: Plan }>(r)),
  },

  knowledgebase: {
    list: (category?: string, query?: string) => {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (query && query.trim()) params.append('q', query.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      return apiFetch(`/api/knowledgebase${qs}`).then((r) =>
        asJson<{ categories: any[]; articles: any[]; total: number }>(r)
      );
    },
    getArticle: (id: string) =>
      apiFetch(`/api/knowledgebase/articles/${id}`).then((r) => asJson<{ article: any }>(r)),
    voteHelpful: (id: string) =>
      apiFetch(`/api/knowledgebase/articles/${id}/helpful`, { method: 'POST' }).then((r) =>
        asJson<{ article: any }>(r)
      ),
    createArticle: (data: { title: string; category: string; summary: string; content: string; published: boolean }) =>
      apiFetch('/api/knowledgebase/articles', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ article: any }>(r)
      ),
    updateArticle: (id: string, data: Partial<{ title: string; category: string; summary: string; content: string; published: boolean }>) =>
      apiFetch(`/api/knowledgebase/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) =>
        asJson<{ article: any }>(r)
      ),
    deleteArticle: (id: string) =>
      apiFetch(`/api/knowledgebase/articles/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ success: boolean }>(r)
      ),
  },

  aiSubscription: {

    getTicket: (orderItemId: string) =>
      apiFetch(`/api/order-items/${orderItemId}/ai-subscription-ticket`).then((r) =>
        asJson<{ ticket: Ticket | null }>(r)
      ),
    openTicket: (orderItemId: string) =>
      apiFetch(`/api/order-items/${orderItemId}/ai-subscription-ticket`, { method: 'POST' }).then((r) =>
        asJson<{ ticket: Ticket; alreadyExisted: boolean }>(r)
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
          aiSubscriptionItems: Array<{ id: string; planName: string }>;
        }>(r)
      ),
  },

  subscriptions: {
    list: () => apiFetch('/api/subscriptions').then((r) => asJson<{ subscriptions: any[] }>(r)),
  },

  orders: {
    list: () => apiFetch('/api/orders').then((r) => asJson<{ orders: Order[] }>(r)),
    uploadProof: (orderId: string, file: File, idempotencyKey?: string) => {
      const formData = new FormData();
      formData.append('proof', file);
      return apiFetch(`/api/orders/${orderId}/payments/proof`, {
        method: 'POST',
        body: formData,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }).then((r) => asJson<{ payment: Payment; reasons: string[] }>(r));
    },
    invoiceUrl: (orderId: string) => `/api/orders/${orderId}/invoice`,
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
      internalPort: number;
      exposureMode: 'ssl_with_proxy' | 'raw_tcp' | 'internal_only';
      subdomain: string;
      envVars: Record<string, string>;
    }>) =>
      apiFetch(`/api/deployments/${id}/config`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ ok: boolean; deployment: any }>(r)),

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
      },
      onEvent: (event: BuildEvent) => void
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
          if (line.trim()) onEvent(JSON.parse(line));
        }
      }
    },
    updateGitSettings: (id: string, data: { gitToken?: string; autoDeploy?: boolean }) =>
      apiFetch(`/api/deployments/${id}/git-settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ deployment: Deployment }>(r)),
    uploadZip: async (
      id: string,
      file: File,
      onEvent: (event: BuildEvent) => void
    ): Promise<void> => {
      const formData = new FormData();
      formData.append('zipFile', file);
      const res = await apiFetch(`/api/deployments/${id}/upload-zip`, {
        method: 'POST',
        body: formData,
      });
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
          if (line.trim()) onEvent(JSON.parse(line));
        }
      }
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
      roleTags: string[];
    }) => apiFetch('/api/nodes/connect', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ success: boolean; message: string; node?: Node; logs?: string[] }>(r)),
    /**
     * Open a Server-Sent Events stream for live provisioning progress.
     * The caller is responsible for closing the EventSource when done.
     * Events: { type:'step', message } | { type:'done', node } | { type:'error', error, logs }
     */
    connectSSHStream: (data: {
      ip: string; port?: number; username?: string; password?: string;
      privateKey?: string; label: string; roleTags: string[];
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
      roleTags: string[];
    }) => apiFetch('/api/nodes', { method: 'POST', body: JSON.stringify(data) }).then((r) => asJson<{ node: Node }>(r)),
  },


  payments: {
    reviewQueue: () => apiFetch('/api/payments/review-queue').then((r) => asJson<{ payments: Payment[] }>(r)),
    review: (id: string, approve: boolean, reason?: string) =>
      apiFetch(`/api/payments/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve, reason }),
      }).then((r) => asJson<{ payment: Payment }>(r)),
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
          verification: { mx: boolean; spf: boolean; dmarc: boolean; allVerified: boolean };
          records: { mxRecords: string[]; txtRecords: string[] };
          expectedDns: Array<{ type: string; name: string; value: string; priority?: number; status: string }>;
        }>(r)
      ),
  },

  webmail: {
    listMessages: (folder = 'inbox', search = '', category?: string, smtpAccountId?: string) =>
      apiFetch(
        `/api/webmail/messages?folder=${folder}${search ? `&search=${encodeURIComponent(search)}` : ''}${
          category ? `&category=${category}` : ''
        }${smtpAccountId ? `&smtpAccountId=${smtpAccountId}` : ''}`
      ).then((r) => asJson<{ messages: import('./types').WebmailMessage[]; unreadCount: number; total: number }>(r)),
    listThreads: (folder = 'inbox') =>
      apiFetch(`/api/webmail/threads?folder=${folder}`).then((r) =>
        asJson<{ threads: import('./types').WebmailThread[]; total: number }>(r)
      ),
    getThread: (threadId: string) =>
      apiFetch(`/api/webmail/threads/${threadId}`).then((r) =>
        asJson<{ threadId: string; messages: import('./types').WebmailMessage[]; total: number }>(r)
      ),
    getMessage: (id: string) =>
      apiFetch(`/api/webmail/messages/${id}`).then((r) => asJson<{ message: import('./types').WebmailMessage }>(r)),
    send: (data: {
      recipientEmail: string;
      subject: string;
      htmlBody: string;
      smtpAccountId?: string;
      threadId?: string;
      inReplyTo?: string;
      scheduledAt?: string;
      readReceipt?: boolean;
      labels?: string[];
      attachments?: Array<{ filename: string; sizeStr: string; url?: string }>;
    }) =>
      apiFetch('/api/webmail/send', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; message: import('./types').WebmailMessage; scheduled?: boolean }>(r)
      ),
    saveDraft: (data: { recipientEmail?: string; subject?: string; htmlBody?: string; id?: string }) =>
      apiFetch('/api/webmail/drafts', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ draft: import('./types').WebmailMessage }>(r)
      ),
    bulkAction: (data: {
      messageIds: string[];
      action: 'markRead' | 'markUnread' | 'star' | 'unstar' | 'pin' | 'unpin' | 'archive' | 'delete' | 'moveFolder' | 'applyLabel' | 'snooze';
      targetFolder?: string;
      label?: string;
      snoozeUntil?: string;
    }) =>
      apiFetch('/api/webmail/bulk', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ ok: boolean; count: number }>(r)
      ),
    updateMessage: (id: string, data: Partial<import('./types').WebmailMessage>) =>
      apiFetch(`/api/webmail/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) =>
        asJson<{ message: import('./types').WebmailMessage }>(r)
      ),
    deleteMessage: (id: string) =>
      apiFetch(`/api/webmail/messages/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean; deletedId: string }>(r)
      ),

    // Folders, Labels & Filters
    folders: {
      list: () => apiFetch('/api/webmail/folders').then((r) => asJson<{ folders: import('./types').WebmailFolder[] }>(r)),
      create: (data: { name: string; icon?: string; color?: string; parentId?: string }) =>
        apiFetch('/api/webmail/folders', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ folder: import('./types').WebmailFolder }>(r)
        ),
      delete: (id: string) => apiFetch(`/api/webmail/folders/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },
    labels: {
      list: () => apiFetch('/api/webmail/labels').then((r) => asJson<{ labels: import('./types').WebmailLabel[] }>(r)),
      create: (data: { name: string; color?: string }) =>
        apiFetch('/api/webmail/labels', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ label: import('./types').WebmailLabel }>(r)
        ),
      delete: (id: string) => apiFetch(`/api/webmail/labels/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },
    filters: {
      list: () => apiFetch('/api/webmail/filters').then((r) => asJson<{ filters: import('./types').WebmailFilter[] }>(r)),
      create: (data: { name: string; conditionsJson: any; actionsJson: any }) =>
        apiFetch('/api/webmail/filters', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ filter: import('./types').WebmailFilter }>(r)
        ),
      delete: (id: string) => apiFetch(`/api/webmail/filters/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Signatures & Templates
    signatures: {
      list: () => apiFetch('/api/webmail/signatures').then((r) => asJson<{ signatures: import('./types').WebmailSignature[] }>(r)),
      create: (data: { name: string; htmlContent: string; isDefault?: boolean; smtpAccountId?: string }) =>
        apiFetch('/api/webmail/signatures', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ signature: import('./types').WebmailSignature }>(r)
        ),
      delete: (id: string) => apiFetch(`/api/webmail/signatures/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },
    templates: {
      list: () => apiFetch('/api/webmail/templates').then((r) => asJson<{ templates: import('./types').WebmailTemplate[] }>(r)),
      create: (data: { name: string; subject?: string; body: string }) =>
        apiFetch('/api/webmail/templates', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ template: import('./types').WebmailTemplate }>(r)
        ),
      delete: (id: string) => apiFetch(`/api/webmail/templates/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Auto-reply & Blocklist
    autoReply: {
      get: () => apiFetch('/api/webmail/auto-reply').then((r) => asJson<{ autoReply: import('./types').WebmailAutoReply | null }>(r)),
      save: (data: { enabled: boolean; subject: string; body: string; startDate?: string; endDate?: string }) =>
        apiFetch('/api/webmail/auto-reply', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ autoReply: import('./types').WebmailAutoReply }>(r)
        ),
    },
    blockedSenders: {
      list: () => apiFetch('/api/webmail/blocked-senders').then((r) => asJson<{ blockedSenders: import('./types').WebmailBlockedSender[] }>(r)),
      add: (data: { emailOrDomain: string; reason?: string }) =>
        apiFetch('/api/webmail/blocked-senders', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ blocked: import('./types').WebmailBlockedSender }>(r)
        ),
      delete: (id: string) => apiFetch(`/api/webmail/blocked-senders/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
    },

    // Calendar & Google Sync
    calendarSync: {
      list: () => apiFetch('/api/webmail/calendar/sync').then((r) => asJson<{ syncs: import('./types').WebmailCalendarSync[] }>(r)),
      create: (data: { provider: 'google' | 'ical' | 'outlook'; name: string; calendarUrl?: string }) =>
        apiFetch('/api/webmail/calendar/sync', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
          asJson<{ sync: import('./types').WebmailCalendarSync; message: string }>(r)
        ),
      delete: (id: string) => apiFetch(`/api/webmail/calendar/sync/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean }>(r)),
      parseIcs: (icsContent: string) =>
        apiFetch('/api/webmail/ics/parse', { method: 'POST', body: JSON.stringify({ icsContent }) }).then((r) =>
          asJson<{ event: { title: string; start: string; end: string; location?: string } }>(r)
        ),
    },

    // Express AI Gateway
    ai: {
      summarize: (threadBody: string, subject?: string) =>
        apiFetch('/api/webmail/ai/summarize', { method: 'POST', body: JSON.stringify({ threadBody, subject }) }).then((r) =>
          asJson<{ summary: import('./types').WebmailAiSummary }>(r)
        ),
      replySuggestions: (messageBody: string, senderName?: string) =>
        apiFetch('/api/webmail/ai/reply-suggestions', { method: 'POST', body: JSON.stringify({ messageBody, senderName }) }).then((r) =>
          asJson<{ suggestions: string[] }>(r)
        ),
      draft: (prompt: string, tone?: string, recipientName?: string) =>
        apiFetch('/api/webmail/ai/draft', { method: 'POST', body: JSON.stringify({ prompt, tone, recipientName }) }).then((r) =>
          asJson<{ draft: { subject: string; body: string } }>(r)
        ),
      threatCheck: (senderEmail: string, subject: string, body: string) =>
        apiFetch('/api/webmail/ai/threat-check', { method: 'POST', body: JSON.stringify({ senderEmail, subject, body }) }).then((r) =>
          asJson<{ assessment: { riskLevel: 'safe' | 'suspicious' | 'dangerous'; flags: string[]; isExternal: boolean; recommendation: string } }>(r)
        ),
      translate: (text: string, targetLanguage: string) =>
        apiFetch('/api/webmail/ai/translate', { method: 'POST', body: JSON.stringify({ text, targetLanguage }) }).then((r) =>
          asJson<{ translatedText: string; sourceLanguage: string }>(r)
        ),
    },
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
    get: (id: string) => apiFetch(`/api/vps-provisions/${id}`).then((r) => asJson<{ provision: VpsProvision; notice?: string }>(r)),
    revealPassword: (id: string) =>
      apiFetch(`/api/vps-provisions/${id}/reveal-password`).then((r) =>
        asJson<{ username: string; password: string; ip?: string; sshPort?: number; credentialType: string; notice?: string }>(r)
      ),
    sshTicket: (id: string) =>
      apiFetch(`/api/vps-provisions/${id}/ssh-ticket`, { method: 'POST' }).then(
        (r) => asJson<{ ticket: string; expiresInMs: number; notice?: string }>(r)
      ),
    power: (id: string, action: 'reboot' | 'stop' | 'start' | 'status') =>
      apiFetch(`/api/vps-provisions/${id}/power`, { method: 'POST', body: JSON.stringify({ action }) }).then(
        (r) => asJson<{ ok: boolean; action: string; message?: string; status?: string; uptime?: string }>(r)
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
  },

  tickets: {
    list: (status?: TicketStatus) =>
      apiFetch(`/api/tickets${status ? `?status=${status}` : ''}`).then((r) =>
        asJson<{ tickets: Ticket[] }>(r)
      ),
    get: (id: string) => apiFetch(`/api/tickets/${id}`).then((r) => asJson<{ ticket: Ticket }>(r)),
    create: (data: { subject: string; message: string; orderId?: string }) =>
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

  managedDatabases: {
    list: () => apiFetch('/api/managed-databases').then((r) => asJson<{ databases: any[] }>(r)),
    create: (userId: string, type: 'postgres' | 'mysql' | 'redis' | 'mongodb') =>
      apiFetch('/api/managed-databases', { method: 'POST', body: JSON.stringify({ userId, type }) }).then((r) =>
        asJson<{ database: any }>(r)
      ),
    revealPassword: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/reveal-password`).then((r) => asJson<{ password: string }>(r)),
    action: (id: string, action: 'start' | 'stop' | 'restart') =>
      apiFetch(`/api/managed-databases/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }).then((r) =>
        asJson<{ ok: boolean; database: any }>(r)
      ),
    connection: (id: string) =>
      apiFetch(`/api/managed-databases/${id}/connection`).then((r) =>
        asJson<{
          type: string;
          host: string;
          port: number;
          username: string;
          password: string;
          databaseName: string;
          connectionString: string;
        }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/managed-databases/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: boolean; deletedId: string }>(r)),
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
    firewallStatus: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall`).then((r) => asJson<any>(r)),
    addFirewallRule: (nodeId: string, rule: { port: number; protocol: string; action: string }) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall/rules`, {
        method: 'POST',
        body: JSON.stringify(rule),
      }).then((r) => asJson<any>(r)),
    deleteFirewallRule: (nodeId: string, port: string, protocol: string) =>
      apiFetch(`/api/nodes/${nodeId}/engine/firewall/rules?port=${encodeURIComponent(port)}&protocol=${encodeURIComponent(protocol)}`, {
        method: 'DELETE',
      }).then((r) => asJson<any>(r)),
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
  projects: {
    list: () =>
      apiFetch('/api/projects').then((r) => asJson<{ projects: Project[] }>(r)),
    get: (id: string) =>
      apiFetch(`/api/projects/${id}`).then((r) => asJson<{ project: Project }>(r)),
    create: (data: { userId: string; name: string; nodeId: string; orderItemId?: string }) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ project: Project }>(r)
      ),
    delete: (id: string) =>
      apiFetch(`/api/projects/${id}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean }>(r)
      ),
    tables: (id: string) =>
      apiFetch(`/api/projects/${id}/tables`).then((r) =>
        asJson<{ tables: ProjectTable[] }>(r)
      ),
    rows: (id: string, table: string, page = 1, limit = 50) =>
      apiFetch(`/api/projects/${id}/tables/${table}/rows?page=${page}&limit=${limit}`).then((r) =>
        asJson<{ rows: Record<string, unknown>[]; total: number }>(r)
      ),
    insertRow: (id: string, table: string, row: Record<string, unknown>) =>
      apiFetch(`/api/projects/${id}/tables/${table}/rows`, {
        method: 'POST',
        body: JSON.stringify(row),
      }).then((r) => asJson<{ row: Record<string, unknown> }>(r)),
    updateRow: (id: string, table: string, pk: string | number, data: Record<string, unknown>) =>
      apiFetch(`/api/projects/${id}/tables/${table}/rows/${pk}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => asJson<{ row: Record<string, unknown> }>(r)),
    deleteRow: (id: string, table: string, pk: string | number) =>
      apiFetch(`/api/projects/${id}/tables/${table}/rows/${pk}`, { method: 'DELETE' }).then((r) =>
        asJson<{ ok: boolean }>(r)
      ),
    sql: (id: string, sql: string) =>
      apiFetch(`/api/projects/${id}/sql`, { method: 'POST', body: JSON.stringify({ sql }) }).then(
        (r) => asJson<SqlResult>(r)
      ),
    provisionStorage: (id: string) =>
      apiFetch(`/api/projects/${id}/storage`, { method: 'POST' }).then((r) =>
        asJson<{ bucketName: string; endpoint: string }>(r)
      ),
    authUsers: (id: string) =>
      apiFetch(`/api/projects/${id}/auth/users`).then((r) =>
        asJson<{ users: Array<{ id: string; email: string; emailVerified: boolean; createdAt: string; lastLoginAt: string | null }> }>(r)
      ),
    oauthConfigs: (id: string) =>
      apiFetch(`/api/projects/${id}/auth/oauth-config`).then((r) =>
        asJson<{ configs: Array<{ id: string; provider: string; clientId: string; redirectUri: string }> }>(r)
      ),
    saveOAuthConfig: (id: string, data: { provider: 'google' | 'github' | 'discord'; clientId: string; clientSecret: string; redirectUri: string }) =>
      apiFetch(`/api/projects/${id}/auth/oauth-config`, { method: 'POST', body: JSON.stringify(data) }).then((r) =>
        asJson<{ config: { id: string; provider: string; clientId: string; redirectUri: string } }>(r)
      ),
  },

  traefik: {
    overview: () => apiFetch('/api/traefik/overview').then((r) => asJson<{ overview: any }>(r)),
    routers: () => apiFetch('/api/traefik/routers').then((r) => asJson<{ routers: any[] }>(r)),
    services: () => apiFetch('/api/traefik/services').then((r) => asJson<{ services: any[] }>(r)),
    middlewares: () => apiFetch('/api/traefik/middlewares').then((r) => asJson<{ middlewares: any[] }>(r)),
  },

  containers: {
    list: (nodeId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers`).then((r) =>
        asJson<{ containers: Array<{ id: string; name: string; image: string; state: string; status: string; createdAt: number; ports: Array<{ privatePort: number; publicPort?: number; type: string }> }> }>(r)
      ),
    action: (nodeId: string, containerId: string, action: 'start' | 'stop' | 'restart') =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }).then((r) => asJson<{ ok: boolean }>(r)),
    logs: (nodeId: string, containerId: string) =>
      apiFetch(`/api/nodes/${nodeId}/containers/${containerId}/logs`).then((r) => asJson<{ logs: string }>(r)),
  },

  backups: {
    run: () => apiFetch('/api/admin/backup/run', { method: 'POST' }).then((r) => asJson<{ ok: boolean; key: string; sizeBytes: number; durationMs: number }>(r)),
    history: () =>
      apiFetch('/api/admin/backup/history').then((r) =>
        asJson<{
          runs: Array<{ id: string; triggeredBy: string; success: boolean; r2Key: string | null; sizeBytes: number | null; durationMs: number | null; error: string | null; createdAt: string }>;
        }>(r)
      ),
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
    deploy: (body: { slug: string; nodeId: string; envVars?: Record<string, string>; projectName?: string; teamId?: string | null }) =>
      apiFetch('/api/catalog/deploy', { method: 'POST', body: JSON.stringify(body) }).then((r) =>
        asJson<{ deployment: Deployment; agent: Record<string, unknown> }>(r)
      ),
    nodes: () =>
      apiFetch('/api/catalog/nodes').then((r) =>
        asJson<{ nodes: Array<{ id: string; name: string; location: string; status: string }> }>(r)
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
        asJson<{ ok: boolean; unlocked: boolean; message: string }>(r)
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
            leasewebApi: { configured: boolean };
            smtpServer: { configured: boolean };
            r2Storage: { configured: boolean };
          };
        }>(r)
      ),
  },
};
