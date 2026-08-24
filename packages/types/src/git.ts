// ─── Git Integration Types ────────────────────────────────────────────────

export type GitProvider = 'github' | 'gitlab';

export interface GitAccount {
  id: string;
  provider: GitProvider;
  username: string;
  avatarUrl: string | null;
  updatedAt: string;
}

export interface GitRepo {
  id: string;
  name: string;
  /** e.g. "owner/repo-name" */
  fullName: string;
  /**
   * NOTE: the real API (routes/gitConnect.ts) currently sets this to the
   * repo's *web* URL (GitHub's html_url / GitLab's http_url_to_repo), not
   * a git-clone-able URL as the name implies -- documenting the current
   * behavior here rather than silently disagreeing with it; fixing that
   * distinction properly is a server-side change outside this pass.
   */
  cloneUrl: string;
  private: boolean;
  defaultBranch: string;
  /**
   * SECURITY NOTE: the real /git/repos response currently also includes a
   * raw `token` field (the account's decrypted OAuth/PAT token) on every
   * repo entry. That looks unintentional -- it hands the client a live
   * credential capable of acting as the customer on GitHub/GitLab -- and
   * should be removed server-side; flagging it here rather than silently
   * typing around it.
   */
  token?: string;
}

export interface GitCommitPushInput {
  /** Relative path inside the deployment workspace */
  filePath: string;
  content: string;
  commitMessage: string;
  /** Git account ID to push as (must have write access to the repo) */
  gitAccountId?: string;
}

export interface GitCommitPushResult {
  commitUrl: string;
  sha: string;
  branch: string;
}
