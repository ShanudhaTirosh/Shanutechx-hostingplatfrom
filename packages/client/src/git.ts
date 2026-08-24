import type { GitAccount, GitRepo } from '@shanutechx/types';
import { BaseClient } from './base.js';

export class GitResource extends BaseClient {
  async listAccounts(): Promise<GitAccount[]> {
    const res = await this.httpGet<{ accounts: GitAccount[] }>('/api/git/accounts');
    return res.accounts;
  }

  async removeAccount(accountId: string): Promise<void> {
    return this.httpPost('/api/git/disconnect', { accountId });
  }

  async listRepos(gitAccountId: string): Promise<GitRepo[]> {
    const res = await this.httpGet<{ repos: GitRepo[] }>(
      '/api/git/repos',
      { accountId: gitAccountId },
    );
    return res.repos;
  }

  /** Get GitHub OAuth authorization URL */
  getGitHubAuthUrl(): string {
    return `${this.apiUrl}/api/git/connect/github/authorize`;
  }

  getGitLabAuthUrl(): string {
    return `${this.apiUrl}/api/git/connect/gitlab/authorize`;
  }

  /** The flow that actually works today: connect an account with a
   * manually-created GitHub/GitLab personal access token. */
  async connectWithToken(
    provider: 'github' | 'gitlab',
    token: string,
    accountLabel?: string,
  ): Promise<GitAccount> {
    const res = await this.httpPost<{ account: GitAccount }>(
      `/api/git/connect/${provider}/token`,
      { token, accountLabel },
    );
    return res.account;
  }

  async listAllRepos(): Promise<GitRepo[]> {
    const accounts = await this.listAccounts();
    const repoSets = await Promise.all(
      accounts.map((a) => this.listRepos(a.id)),
    );
    return repoSets.flat();
  }

  async resolveAccountForRepo(
    repoUrl: string,
  ): Promise<GitAccount | undefined> {
    const accounts = await this.listAccounts();
    return accounts.find(
      (a) =>
        repoUrl.includes(`github.com/${a.username}`) ||
        repoUrl.includes(`gitlab.com/${a.username}`),
    );
  }
}
