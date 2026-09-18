/**
 * Generic OAuth2 config for the three supported providers. Each provider
 * differs only in endpoint URLs, scopes, and how to read the user's email
 * out of its profile response — the actual authorize/callback route logic
 * in routes/projectAuth.ts is the same for all three.
 *
 * Honest limitation: this code is a correct, standard OAuth2
 * authorization-code implementation, but it has NOT been exercised against
 * live Google/GitHub/Discord OAuth apps in this sandbox (no network access
 * to those providers, and no real client id/secret to test with). Verify
 * end-to-end with real OAuth app credentials before relying on it in
 * production — the redirect URIs registered with each provider must
 * exactly match `ProjectOAuthConfig.redirectUri`.
 */

export type OAuthProviderName = 'google' | 'github' | 'discord';

export interface GoogleProfileResponse {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

export interface GitHubProfileResponse {
  id: number | string;
  login?: string;
  email?: string | null;
  name?: string;
}

export interface DiscordProfileResponse {
  id: string;
  email?: string | null;
  verified?: boolean;
  username?: string;
}

export type RawOAuthProfile = GoogleProfileResponse | GitHubProfileResponse | DiscordProfileResponse | Record<string, unknown>;

export interface OAuthProviderDef {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  /** Extracts a stable provider user id and an email from that provider's user-info response shape. */
  extractProfile: (profile: Record<string, unknown>) => { providerUserId: string; email: string | null };
}

export const OAUTH_PROVIDERS: Record<OAuthProviderName, OAuthProviderDef> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    extractProfile: (p: Record<string, unknown>) => {
      const profile = p as unknown as GoogleProfileResponse;
      return {
        providerUserId: profile.sub,
        email: (profile.email_verified === true || profile.email_verified === 'true') ? (profile.email ?? null) : null,
      };
    },
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    extractProfile: (p: Record<string, unknown>) => {
      const profile = p as unknown as GitHubProfileResponse;
      return {
        providerUserId: String(profile.id),
        email: null, // Always use /user/emails fallback to ensure primary && verified status
      };
    },
  },
  discord: {
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scope: 'identify email',
    extractProfile: (p: Record<string, unknown>) => {
      const profile = p as unknown as DiscordProfileResponse;
      return {
        providerUserId: profile.id,
        email: profile.verified === true ? (profile.email ?? null) : null,
      };
    },
  },
};

/**
 * GitHub's /user endpoint often omits email unless it's public. When
 * extractProfile returns a null email, the caller should fall back to
 * GET https://api.github.com/user/emails (with the same access token) and
 * pick the primary, verified address — implemented in routes/projectAuth.ts
 * rather than here since it's a provider-specific second request, not part
 * of the generic flow.
 */
