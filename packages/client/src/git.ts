import type { GitAccount, GitRepo } from '@shanutechx/types';
import { BaseClient } from './base.js';

export class GitResource extends BaseClient {
  async listAccounts(): Promise<GitAccount[]> {
    const res = await this.httpGet<{ accounts: GitAccount[] }>('/api/git/accounts');
    return res.accounts;
  }

  // Audit finding H10: previously DELETE /api/git/accounts/:id, which
  // does not exist. The real route is POST /api/git/disconnect with
  // { accountId } in the body (see routes/gitConnect.ts). Passing no
  // accountId there disconnects every account for the user, so this
  // always passes one explicitly.
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

  /**
   * Audit finding H7/H10: as of this writing, the "Connect via OAuth"
   * flow is incomplete server-side -- GET /api/git/connect/:provider/authorize
   * exists and returns a real GitHub/GitLab consent URL, but nothing
   * implements the callback route that URL redirects back to
   * (/api/git/connect/:provider/callback), so completing this flow will
   * currently dead-end. The only working way to connect an account today
   * is POST /api/git/connect/:provider/token with a manually-created
   * personal access token -- see connectWithToken() below. These two
   * methods are fixed to call the real (existing) authorize endpoint
   * rather than the previously-wrong /api/git/{provider}/auth path, but
   * are not usable end-to-end until the callback route is built.
   */
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
    // Audit finding H10: previously read `a.login`, which doesn't exist
    // on the real account shape -- see GitAccount in @shanutechx/types.
    return accounts.find(
      (a) =>
        repoUrl.includes(`github.com/${a.username}`) ||
        repoUrl.includes(`gitlab.com/${a.username}`),
    );
  }
}
