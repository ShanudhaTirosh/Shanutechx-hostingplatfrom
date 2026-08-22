import type { AuthSession, LoginInput, RegisterInput, User } from '@shanutechx/types';
import { AuthError } from '@shanutechx/types';
import { ShanuTechXClient } from '@shanutechx/client';
import {
  LocalStorageTokenStorage,
  MemoryTokenStorage,
  type TokenStorage,
} from './storage.js';

export type AuthChangeListener = (session: AuthSession | null) => void;

export interface ShanuTechXAuthConfig {
  apiUrl: string;
  /**
   * Where to store the JWT token.
   * Defaults to localStorage in browser, memory in Node.js.
   */
  storage?: TokenStorage;
  /**
   * Auto-refresh token N milliseconds before expiry.
   * Set to 0 to disable auto-refresh. Default: 60000 (1 minute before expiry).
   */
  autoRefreshLeadMs?: number;
}

/**
 * ShanuTechXAuth — high-level auth manager.
 *
 * @example
 * ```typescript
 * import { ShanuTechXAuth } from '@shanutechx/auth';
 *
 * const auth = new ShanuTechXAuth({ apiUrl: 'https://api.shanutechx.com' });
 *
 * // Subscribe to auth state changes
 * auth.onAuthChange((session) => {
 *   if (session) console.log('Logged in as', session.user.email);
 *   else console.log('Logged out');
 * });
 *
 * // Login
 * await auth.login('user@example.com', 'password123');
 *
 * // Use the underlying client (already has the token set)
 * const deployments = await auth.client.deployments.list();
 * ```
 */
export class ShanuTechXAuth {
  readonly client: ShanuTechXClient;
  private readonly storage: TokenStorage;
  private readonly autoRefreshLeadMs: number;
  private _session: AuthSession | null = null;
  private _listeners: Set<AuthChangeListener> = new Set();
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ShanuTechXAuthConfig) {
    // Auto-detect storage: localStorage in browser, memory in Node
    const storage =
      config.storage ??
      (typeof window !== 'undefined' && typeof localStorage !== 'undefined'
        ? new LocalStorageTokenStorage()
        : new MemoryTokenStorage());

    this.storage = storage;
    this.autoRefreshLeadMs = config.autoRefreshLeadMs ?? 60_000;

    const existingToken = storage.get();
    this.client = new ShanuTechXClient({
      apiUrl: config.apiUrl,
      token: existingToken ?? undefined,
    });
  }

  /** Current auth session, or null if not logged in */
  get session(): AuthSession | null {
    return this._session;
  }

  /** Convenience: currently logged-in user */
  get user(): User | null {
    return this._session?.user ?? null;
  }

  /** True if there is an active session */
  get isAuthenticated(): boolean {
    return this._session !== null;
  }

  /**
   * Login with email + password.
   * Stores the token, updates the client, fires auth change listeners.
   */
  async login(email: string, password: string): Promise<AuthSession> {
    const session = await this.client.auth.login({ email, password } as LoginInput);
    this._applySession(session);
    return session;
  }

  /**
   * Register a new account and immediately log in.
   */
  async register(email: string, password: string, name?: string): Promise<AuthSession> {
    const session = await this.client.auth.register({ email, password, name } as RegisterInput);
    this._applySession(session);
    return session;
  }

  /**
   * Manually refresh the JWT token.
   */
  async refresh(): Promise<AuthSession> {
    const session = await this.client.auth.refresh();
    this._applySession(session);
    return session;
  }

  /**
   * Restore a session from the stored token (call this on app load).
   * Returns null if no stored token or if the token is expired/invalid.
   */
  async restoreSession(): Promise<AuthSession | null> {
    const storedToken = this.storage.get();
    if (!storedToken) return null;

    try {
      this.client.setToken(storedToken);
      const user = await this.client.auth.me();
      // Reconstruct minimal session — no expiry info but token is valid
      const session: AuthSession = {
        token: storedToken,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(), // assume 1hr
        user,
      };
      this._applySession(session);
      return session;
    } catch {
      this.storage.clear();
      this.client.clearToken();
      return null;
    }
  }

  /** Log out: clear token, fire listeners */
  logout(): void {
    this._clearRefreshTimer();
    this.storage.clear();
    this.client.clearToken();
    this._session = null;
    this._notifyListeners();
  }

  /**
   * Subscribe to auth state changes.
   * The listener is called immediately with the current session,
   * then again whenever auth state changes.
   *
   * @returns Unsubscribe function
   */
  onAuthChange(listener: AuthChangeListener): () => void {
    this._listeners.add(listener);
    listener(this._session); // fire immediately with current state
    return () => this._listeners.delete(listener);
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private _applySession(session: AuthSession): void {
    this._session = session;
    this.storage.set(session.token);
    this.client.setToken(session.token);
    this._scheduleRefresh(session);
    this._notifyListeners();
  }

  private _scheduleRefresh(session: AuthSession): void {
    if (this.autoRefreshLeadMs === 0) return;
    this._clearRefreshTimer();

    const expiresAt = new Date(session.expiresAt).getTime();
    const refreshAt = expiresAt - this.autoRefreshLeadMs;
    const delay = refreshAt - Date.now();

    if (delay > 0) {
      this._refreshTimer = setTimeout(() => {
        this.refresh().catch(() => {
          // If refresh fails, log the user out
          this.logout();
        });
      }, delay);
    }
  }

  private _clearRefreshTimer(): void {
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  private _notifyListeners(): void {
    this._listeners.forEach((l) => l(this._session));
  }
}
