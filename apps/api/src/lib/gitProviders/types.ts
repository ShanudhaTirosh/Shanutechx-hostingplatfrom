/**
 * Common repository-provider interface (per product requirement: "Design
 * the architecture so GitHub and GitLab are treated as separate provider
 * integrations behind a common repository-provider interface, making it
 * easy to add additional Git providers in the future").
 *
 * Each concrete provider (github.ts, gitlab.ts) implements this without
 * ever handing a long-lived user credential to the caller — callers only
 * ever get a repo list/metadata or a short-lived token scoped to one
 * operation, never a PAT.
 */

export interface GitRepoSummary {
  /** Provider-native repo/project ID. */
  id: string;
  /** e.g. "owner/repo-name" */
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  /** Web URL (for linking out), not a credentialed clone URL. */
  htmlUrl: string;
}

export interface ConnectedAccountSummary {
  /** Our own DB row ID (GitHubInstallation.id / GitLabConnection.id). */
  id: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'gitea';
  /** Login/username or org name this connection grants access to. */
  accountLabel: string;
  accountType?: string; // GitHub only: "User" | "Organization"
  avatarUrl: string | null;
  updatedAt: string;
}

export interface GitProviderAdapter {
  readonly provider: 'github' | 'gitlab' | 'bitbucket' | 'gitea';

  /** Whether this provider is configured on this deployment at all (app/OAuth credentials present). */
  isConfigured(): boolean;

  /** Build the URL the frontend should redirect the user to in order to connect an account. Embeds a signed, single-use state token. */
  getConnectUrl(userId: string): string;

  /**
   * List every account this user has connected for this provider (a user
   * may have more than one GitHub App installation, for example).
   */
  listConnectedAccounts(userId: string): Promise<ConnectedAccountSummary[]>;

  /** List repositories/projects accessible through a specific connected account. */
  listRepos(accountId: string): Promise<GitRepoSummary[]>;

  /**
   * Returns a short-lived token suitable for one Git operation (clone/
   * push) against a specific repo full name, scoped as narrowly as the
   * provider allows. Never a long-lived PAT.
   */
  getScopedToken(accountId: string, repoFullName: string): Promise<string>;

  /** Revoke/remove a connected account and delete its stored credentials. */
  disconnect(userId: string, accountId: string): Promise<void>;
}
