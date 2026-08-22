import type { AuthSession, LoginInput, RegisterInput, User } from '@shanutechx/types';
import { BaseClient } from './base.js';

export class AuthResource extends BaseClient {
  async login(input: LoginInput): Promise<AuthSession> {
    return this.httpPost<AuthSession>('/api/auth/login', input);
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    return this.httpPost<AuthSession>('/api/auth/register', input);
  }

  async refresh(): Promise<AuthSession> {
    return this.httpPost<AuthSession>('/api/auth/refresh');
  }

  async me(): Promise<User> {
    return this.httpGet<User>('/api/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.httpPost('/api/auth/change-password', { currentPassword, newPassword });
  }
}
