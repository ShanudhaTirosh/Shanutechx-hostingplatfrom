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

export interface OAuthProviderDef {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  /** Extracts a stable provider user id and an email from that provider's user-info response shape. */
  extractProfile: (profile: any) => { providerUserId: string; email: string | null };
}

export const OAUTH_PROVIDERS: Record<OAuthProviderName, OAuthProviderDef> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    extractProfile: (p) => ({
      providerUserId: p.sub,
      email: (p.email_verified === true || p.email_verified === 'true') ? (p.email ?? null) : null,
    }),
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    extractProfile: (p) => ({
      providerUserId: String(p.id),
      email: null, // Always use /user/emails fallback to ensure primary && verified status
    }),
  },
  discord: {
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scope: 'identify email',
    extractProfile: (p) => ({
      providerUserId: p.id,
      email: p.verified === true ? (p.email ?? null) : null,
    }),
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
