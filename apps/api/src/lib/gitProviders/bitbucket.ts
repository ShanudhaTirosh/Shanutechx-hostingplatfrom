import { env } from '../../env';
import { createState } from './state';
import type { GitProviderAdapter, GitRepoSummary, ConnectedAccountSummary } from './types';

function isConfigured(): boolean {
  return Boolean(env.bitbucketKey && env.bitbucketSecret);
}

export const bitbucketProvider: GitProviderAdapter = {
  provider: 'bitbucket',

  isConfigured,

  getConnectUrl(userId: string): string {
    const state = createState(userId, 'bitbucket');
    const params = new URLSearchParams({
      client_id: env.bitbucketKey || '',
      response_type: 'code',
      state,
    });
    return `https://bitbucket.org/site/oauth2/authorize?${params.toString()}`;
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
