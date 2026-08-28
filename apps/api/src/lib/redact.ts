/**
 * Removes embedded git credentials from a repo URL so callers can safely show
 * it to clients. The full URL (with x-access-token/oauth2/token) is stored on
 * the deployment for the node agent to clone with, but must never be echoed
 * back to a dashboard/web client where it would leak the git token.
 */
export function redactRepoUrl<T extends string | null | undefined>(repoUrl: T): T {
  if (!repoUrl) return repoUrl;
  try {
    const url = new URL(repoUrl);
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
      return (url.toString().replace(/\/$/, '')) as T;
    }
    return repoUrl;
  } catch {
    return repoUrl;
  }
}
