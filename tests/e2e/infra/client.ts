import type { AddressInfo } from 'node:net';

export type UserRole = 'customer' | 'admin' | 'dev' | 'support';

export interface TestUser {
  id: string;
  email: string;
  role: UserRole;
  firebaseUid?: string;
  teamId?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  user?: TestUser | null;
  agentSecret?: string;
  timeoutMs?: number;
}

export interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  data: T;
  rawText: string;
}

export class E2EApiClient {
  private baseUrl: string;
  private defaultUser: TestUser | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setDefaultUser(user: TestUser | null) {
    this.defaultUser = user;
  }

  async request<T = any>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    const user = options.user !== undefined ? options.user : this.defaultUser;
    if (user) {
      headers['x-test-user-id'] = user.id;
      headers['x-test-user-email'] = user.email;
      headers['x-test-role'] = user.role;
      if (user.teamId) headers['x-test-team-id'] = user.teamId;
      headers['Authorization'] = `Bearer test-token-for-${user.id}:${user.role}`;
    }

    if (options.agentSecret) {
      headers['x-agent-secret'] = options.agentSecret;
    }

    let bodyData: string | undefined = undefined;
    if (options.body !== undefined) {
      if (typeof options.body === 'string') {
        bodyData = options.body;
      } else {
        headers['Content-Type'] = 'application/json';
        bodyData = JSON.stringify(options.body);
      }
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: bodyData,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    return {
      status: res.status,
      headers: res.headers,
      data,
      rawText,
    };
  }

  get<T = any>(path: string, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T = any>(path: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T = any>(path: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  put<T = any>(path: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  delete<T = any>(path: string, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}
