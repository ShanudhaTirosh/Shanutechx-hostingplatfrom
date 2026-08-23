import { githubProvider } from './github';
import { gitlabProvider } from './gitlab';
import { bitbucketProvider } from './bitbucket';
import { giteaProvider } from './gitea';
import type { GitProviderAdapter } from './types';

export type { GitProviderAdapter, GitRepoSummary, ConnectedAccountSummary } from './types';

const providers: Record<'github' | 'gitlab' | 'bitbucket' | 'gitea', GitProviderAdapter> = {
  github: githubProvider,
  gitlab: gitlabProvider,
  bitbucket: bitbucketProvider,
  gitea: giteaProvider,
};

/** Adding a new Git provider means implementing GitProviderAdapter and registering it here — nothing else in routes/gitConnect.ts needs to change. */
export function getProvider(name: string): GitProviderAdapter | null {
  return providers[name as 'github' | 'gitlab' | 'bitbucket' | 'gitea'] ?? null;
}

export function listProviders(): GitProviderAdapter[] {
  return Object.values(providers);
}
