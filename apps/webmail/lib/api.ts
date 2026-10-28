import { firebaseAuth } from './firebaseClient';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '') + '/api';

async function getIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    const webmailToken = localStorage.getItem('webmail_token');
    return webmailToken || null;
  }
  try {
    return await currentUser.getIdToken();
  } catch {
    const webmailToken = localStorage.getItem('webmail_token');
    return webmailToken || null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Webmail-Token'] = token;
  }

  const normalizedPath = path.startsWith('/api/') ? path.slice(4) : path;
  const res = await fetch(`${API_BASE_URL}${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  me: () => request<any>('/me'),
  updateProfile: (data: { displayName?: string; avatarUrl?: string }) => request<any>('/me', { method: 'PATCH', body: JSON.stringify(data) }),
  post: <T = any>(path: string, body?: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),

  auth: {
    me: () => request<any>('/me'),
  },

  email: {
    mailboxes: () => request<any>('/email/mailboxes'),
    createMailbox: (data: any) => request<any>('/email/mailboxes', { method: 'POST', body: JSON.stringify(data) }),
    credentials: (id: string) => request<any>(`/email/mailboxes/${id}/credentials`),
    websiteConnect: (id: string) => request<any>(`/email/mailboxes/${id}/website-connect`),
    planQuotas: () => request<any>('/email/plan-quotas'),
    plans: () => request<{ ok: boolean; plans: any[] }>('/email/plans'),
    getMailboxAccess: (id: string) => request<any>(`/email/mailboxes/${id}/access`),
    grantMailboxAccess: (id: string, data: { userId: string; permissions: string[] }) =>
      request<any>(`/email/mailboxes/${id}/access`, { method: 'POST', body: JSON.stringify(data) }),
    revokeMailboxAccess: (id: string, userId: string) =>
      request<any>(`/email/mailboxes/${id}/access/${userId}`, { method: 'DELETE' }),
    getMailboxProfile: (id: string) => request<any>(`/email/mailboxes/${id}/profile`),
    updateMailboxProfile: (id: string, data: any) =>
      request<any>(`/email/mailboxes/${id}/profile`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadMailboxAvatar: (id: string, file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return request<any>(`/email/mailboxes/${id}/avatar`, { method: 'POST', body: formData });
    },
    removeMailboxAvatar: (id: string) =>
      request<any>(`/email/mailboxes/${id}/avatar`, { method: 'DELETE' }),
    updateQuota: (id: string, storageQuotaMb: number) => request<any>(`/email/mailboxes/${id}/quota`, { method: 'PATCH', body: JSON.stringify({ storageQuotaMb }) }),
    addAlias: (id: string, prefix: string) =>
      request<any>(`/email/mailboxes/${id}/aliases`, {
        method: 'POST',
        body: JSON.stringify({ prefix }),
      }),
    removeAlias: (id: string, prefix: string) =>
      request<any>(`/email/mailboxes/${id}/aliases/${encodeURIComponent(prefix)}`, {
        method: 'DELETE',
      }),
    sendTransactional: (data: any) => request<any>('/v1/emails', { method: 'POST', body: JSON.stringify(data) }),
    domains: () => request<any>('/email/domains'),
    contacts: () => request<any>('/email/contacts'),
    createContact: (data: any) => request<any>('/email/contacts', { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (id: string, data: any) => request<any>(`/email/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteContact: (id: string) => request<any>(`/email/contacts/${id}`, { method: 'DELETE' }),
    todos: () => request<any>('/email/todos'),
    createTodo: (title: string) => request<any>('/email/todos', { method: 'POST', body: JSON.stringify({ title }) }),
    patchTodo: (id: string, data: any) => request<any>(`/email/todos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTodo: (id: string) => request<any>(`/email/todos/${id}`, { method: 'DELETE' }),
    events: () => request<any>('/email/events'),
    createEvent: (data: any) => request<any>('/email/events', { method: 'POST', body: JSON.stringify(data) }),
  },

  webmail: {
    getCredentials: (mailboxId?: string) =>
      request<any>(`/webmail/account/credentials${mailboxId ? `?mailboxId=${encodeURIComponent(mailboxId)}` : ''}`),
    planUsage: () => request<any>('/webmail/plan-usage'),
    plans: () => request<{ ok: boolean; plans: any[] }>('/webmail/plans'),
    listMessages: (folder = 'inbox', search = '', smtpAccountId?: string, category?: string) => {
      const q = new URLSearchParams({ folder });
      if (search) q.append('search', search);
      if (smtpAccountId) q.append('smtpAccountId', smtpAccountId);
      if (category) q.append('category', category);
      return request<any>(`/webmail/messages?${q.toString()}`);
    },
    listThreads: (folder = 'inbox', smtpAccountId?: string) => {
      const q = new URLSearchParams({ folder });
      if (smtpAccountId) q.append('smtpAccountId', smtpAccountId);
      return request<any>(`/webmail/threads?${q.toString()}`);
    },
    createAlias: (data: { smtpAccountId: string; aliasEmail: string }) =>
      request<any>('/webmail/aliases', { method: 'POST', body: JSON.stringify(data) }),
    deleteAlias: (data: { smtpAccountId: string; aliasEmail: string }) =>
      request<any>('/webmail/aliases', { method: 'DELETE', body: JSON.stringify(data) }),
    getThread: (threadId: string) => request<any>(`/webmail/threads/${threadId}`),
    getMessage: (id: string) => request<any>(`/webmail/messages/${id}`),
    send: (data: any) => request<any>('/webmail/send', { method: 'POST', body: JSON.stringify(data) }),
    saveDraft: (data: any) => request<any>('/webmail/drafts', { method: 'POST', body: JSON.stringify(data) }),
    bulkAction: (data: any) => request<any>('/webmail/bulk', { method: 'POST', body: JSON.stringify(data) }),
    patchMessage: (id: string, data: any) => request<any>(`/webmail/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteMessage: (id: string) => request<any>(`/webmail/messages/${id}`, { method: 'DELETE' }),
    restoreMessage: (id: string) => request<any>(`/webmail/messages/${id}/restore`, { method: 'POST' }),
    moveMessage: (id: string, folder?: string, category?: string) =>
      request<any>(`/webmail/messages/${id}/move`, { method: 'POST', body: JSON.stringify({ folder, category }) }),
    setImportance: (id: string, isImportant: boolean) =>
      request<any>(`/webmail/messages/${id}/importance`, { method: 'POST', body: JSON.stringify({ isImportant }) }),
    muteThread: (threadId: string) => request<any>(`/webmail/threads/${threadId}/mute`, { method: 'POST' }),
    suggestContacts: (q: string) => request<any>(`/webmail/contacts/suggest?q=${encodeURIComponent(q)}`),
    reportThreat: (messageId: string, threatType = 'phishing', comment?: string) =>
      request<any>('/webmail/security/threat-report', { method: 'POST', body: JSON.stringify({ messageId, threatType, comment }) }),

    // Custom Folders
    listFolders: () => request<any>('/webmail/folders'),
    createFolder: (data: any) => request<any>('/webmail/folders', { method: 'POST', body: JSON.stringify(data) }),
    deleteFolder: (id: string) => request<any>(`/webmail/folders/${id}`, { method: 'DELETE' }),
    folders: {
      list: () => request<any>('/webmail/folders'),
      create: (data: any) => request<any>('/webmail/folders', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => request<any>(`/webmail/folders/${id}`, { method: 'DELETE' }),
    },

    // Custom Labels
    listLabels: () => request<any>('/webmail/labels'),
    createLabel: (data: any) => request<any>('/webmail/labels', { method: 'POST', body: JSON.stringify(data) }),
    deleteLabel: (id: string) => request<any>(`/webmail/labels/${id}`, { method: 'DELETE' }),
    labels: {
      list: () => request<any>('/webmail/labels'),
      create: (data: any) => request<any>('/webmail/labels', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => request<any>(`/webmail/labels/${id}`, { method: 'DELETE' }),
    },

    // Rules & Filters
    listFilters: () => request<any>('/webmail/filters'),
    createFilter: (data: any) => request<any>('/webmail/filters', { method: 'POST', body: JSON.stringify(data) }),
    deleteFilter: (id: string) => request<any>(`/webmail/filters/${id}`, { method: 'DELETE' }),
    filters: {
      list: () => request<any>('/webmail/filters'),
      create: (data: any) => request<any>('/webmail/filters', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => request<any>(`/webmail/filters/${id}`, { method: 'DELETE' }),
    },

    // Signatures
    getSignatures: () => request<any>('/webmail/signatures'),
    createSignature: (data: any) => request<any>('/webmail/signatures', { method: 'POST', body: JSON.stringify(data) }),
    deleteSignature: (id: string) => request<any>(`/webmail/signatures/${id}`, { method: 'DELETE' }),
    signatures: {
      list: () => request<any>('/webmail/signatures'),
      create: (data: any) => request<any>('/webmail/signatures', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => request<any>(`/webmail/signatures/${id}`, { method: 'DELETE' }),
    },

    // Templates / Canned Responses
    getTemplates: () => request<any>('/webmail/templates'),
    createTemplate: (data: any) => request<any>('/webmail/templates', { method: 'POST', body: JSON.stringify(data) }),
    deleteTemplate: (id: string) => request<any>(`/webmail/templates/${id}`, { method: 'DELETE' }),
    templates: {
      list: () => request<any>('/webmail/templates'),
      create: (data: any) => request<any>('/webmail/templates', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => request<any>(`/webmail/templates/${id}`, { method: 'DELETE' }),
    },

    // Vacation Auto-Reply
    getAutoReply: () => request<any>('/webmail/auto-reply'),
    setAutoReply: (data: any) => request<any>('/webmail/auto-reply', { method: 'POST', body: JSON.stringify(data) }),
    autoReply: {
      get: () => request<any>('/webmail/auto-reply'),
      save: (data: any) => request<any>('/webmail/auto-reply', { method: 'POST', body: JSON.stringify(data) }),
    },

    // Blocked Senders
    getBlockedSenders: () => request<any>('/webmail/blocked-senders'),
    addBlockedSender: (data: any) => request<any>('/webmail/blocked-senders', { method: 'POST', body: JSON.stringify(data) }),
    deleteBlockedSender: (id: string) => request<any>(`/webmail/blocked-senders/${id}`, { method: 'DELETE' }),
    blockedSenders: {
      list: () => request<any>('/webmail/blocked-senders'),
      add: (data: any) => request<any>('/webmail/blocked-senders', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: string) => request<any>(`/webmail/blocked-senders/${id}`, { method: 'DELETE' }),
    },
  },
};
