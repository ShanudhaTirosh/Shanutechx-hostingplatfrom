/**
 * Abstraction over where JWT tokens are stored.
 * Swap implementations depending on environment (browser vs Node.js vs custom).
 */
export interface TokenStorage {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

/**
 * localStorage-based storage (browser).
 * Falls back gracefully if localStorage is unavailable.
 */
export class LocalStorageTokenStorage implements TokenStorage {
  constructor(private readonly key: string = 'shanutechx_token') {}

  get(): string | null {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }

  set(token: string): void {
    try {
      localStorage.setItem(this.key, token);
    } catch {
      // ignore — storage might be full or unavailable
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

/**
 * In-memory storage (Node.js or SSR environments).
 * Token is lost on process restart.
 */
export class MemoryTokenStorage implements TokenStorage {
  private token: string | null = null;

  get(): string | null {
    return this.token;
  }

  set(token: string): void {
    this.token = token;
  }

  clear(): void {
    this.token = null;
  }
}
