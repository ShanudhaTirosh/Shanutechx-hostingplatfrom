import { env } from '../../env';
import { createState } from './state';
import type { GitProviderAdapter, GitRepoSummary, ConnectedAccountSummary } from './types';

function isConfigured(): boolean {
  return Boolean(env.giteaBaseUrl && env.giteaClientId);
}

export const giteaProvider: GitProviderAdapter = {
  provider: 'gitea',

  isConfigured,

  getConnectUrl(userId: string): string {
    const state = createState(userId, 'gitea');
    const baseUrl = (env.giteaBaseUrl || 'https://gitea.com').replace(/\/$/, '');
    const params = new URLSearchParams({
      client_id: env.giteaClientId || '',
      redirect_uri: env.giteaRedirectUri || '',
      response_type: 'code',
      state,
    });
    return `${baseUrl}/login/oauth/authorize?${params.toString()}`;
  },

  async listConnectedAccounts(_userId: string): Promise<ConnectedAccountSummary[]> {
    return [];
  },

  async listRepos(_accountId: string): Promise<GitRepoSummary[]> {
    return [];
  },

  async getScopedToken(_accountId: string, _repoFullName: string): Promise<string> {
    return '';
  },

  async disconnect(_userId: string, _accountId: string): Promise<void> {
    // Revoke connection
  },
};
