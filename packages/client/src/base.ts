import { ApiError, AuthError, NetworkError, type ApiErrorResponse } from '@shanutechx/types';

export interface ShanuTechXClientConfig {
  /** Base URL of the ShanuTechX API, e.g. https://api.shanutechx.com */
  apiUrl?: string;
  /** Alias for apiUrl */
  baseUrl?: string;
  /** Bearer token. Can also be set later via setToken() */
  token?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof fetch;
}

export class BaseClient {
  protected apiUrl: string;
  protected token: string | undefined;
  protected timeout: number;
  protected _fetch: typeof fetch;

  constructor(config: ShanuTechXClientConfig) {
    const rawUrl = config.apiUrl || config.baseUrl || 'https://api.shanutechx.com';
    this.apiUrl = rawUrl.replace(/\/$/, '');
    this.token = config.token;
    this.timeout = config.timeout ?? 30_000;
    this._fetch = config.fetch ?? globalThis.fetch;
  }

  /** Update the auth token (after login) */
  setToken(token: string): void {
    this.token = token;
  }

  /** Clear the auth token (after logout) */
  clearToken(): void {
    this.token = undefined;
  }

  protected buildHeaders(extra?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...extra,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Core fetch wrapper. All SDK methods go through here.
   */
  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    let url = `${this.apiUrl}${path}`;

    if (options?.query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this._fetch(url, {
        method,
        headers: this.buildHeaders(options?.headers),
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorData: ApiErrorResponse | null = null;
        try {
          errorData = (await response.json()) as ApiErrorResponse;
        } catch {
          // non-JSON error body
        }

        const message = errorData?.error ?? errorData?.message ?? response.statusText;
        const code = errorData?.code ?? 'API_ERROR';

        if (response.status === 401) {
          throw new AuthError(message, code);
        }
        throw new ApiError(message, response.status, code, errorData?.details);
      }

      if (response.status === 204) return undefined as T;

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError || err instanceof AuthError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NetworkError(`Request timed out after ${this.timeout}ms`);
      }
      throw new NetworkError(
        `Network request failed: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  /** Protected HTTP verb helpers */
  protected httpGet<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, { query });
  }
  protected httpPost<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }
  protected httpPut<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }
  protected httpPatch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }
  protected httpDelete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
