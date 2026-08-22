// ─── User / Auth Types ────────────────────────────────────────────────────

export type UserRole = 'customer' | 'admin' | 'dev';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  /** ISO-8601 expiry timestamp */
  expiresAt: string;
  user: User;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}
