import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  firebaseProjectId: required('FIREBASE_PROJECT_ID'),
  firebaseClientEmail: required('FIREBASE_CLIENT_EMAIL'),
  // Private key in .env is usually escaped with \n — unescape it here.
  firebasePrivateKey: required('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  whatsappInternalSecret: required('WHATSAPP_INTERNAL_SECRET'),
  whatsappBotUrl: process.env.WHATSAPP_BOT_URL ?? 'http://localhost:4100',
  cloudflareApiToken: required('CLOUDFLARE_API_TOKEN'),
  cloudflareZoneId: required('CLOUDFLARE_ZONE_ID'),
  rootDomain: required('ROOT_DOMAIN'),
  // Traefik's REST API, reachable only over the internal Docker network
  // (see infra/control-plane/docker-compose.yml) — never exposed publicly.
  traefikApiUrl: process.env.TRAEFIK_API_URL ?? 'http://traefik:8080',
  nodeAgentSecret: required('NODE_AGENT_SECRET'),
  nodeAgentPort: Number(process.env.NODE_AGENT_PORT ?? 5000),
  // NOTE: AI-based payment verification (Gemini/Groq) was removed
  // entirely (audit finding M7) — all payments are approved/declined by
  // a human admin/dev only (see routes/payments.ts). The dead
  // lib/verifyPayment.ts.disabled, lib/gemini.ts, and lib/groq.ts files
  // that referenced these keys have been deleted.
  gracePeriodDays: Number(process.env.GRACE_PERIOD_DAYS ?? 7), // 7 days default
  smsWebhookSecret: required('SMS_WEBHOOK_SECRET'),
  discordBotUrl: process.env.DISCORD_BOT_URL ?? 'http://localhost:4200',
  discordInternalSecret: required('DISCORD_INTERNAL_SECRET'),
  secretsEncryptionKey: required('SECRETS_ENCRYPTION_KEY'),
  // Signs JWTs issued to end users of dev-created Projects via the
  // Auth-as-a-Service feature (routes/projectAuth.ts). Deliberately separate
  // from any platform-level auth secret — a leak here can't be used to
  // forge platform admin/dev sessions, only project-scoped end-user tokens.
  projectAuthJwtSecret: required('PROJECT_AUTH_JWT_SECRET'),
  postalApiUrl: process.env.POSTAL_API_URL ?? '',
  postalApiKey: process.env.POSTAL_API_KEY ?? '',
  postalFromAddress: process.env.POSTAL_FROM_ADDRESS ?? 'no-reply@shanutechx.com',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL ?? '',
  billingCronSecret: required('BILLING_CRON_SECRET'),
  leasewebApiKey: process.env.LEASEWEB_API_KEY ?? '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  r2Endpoint: process.env.R2_ENDPOINT ?? '',
  r2BucketName: process.env.R2_BUCKET_NAME ?? 'shanutechx-backups',

  // GitHub App (audit finding H7 rewrite: replaces the old PAT-paste
  // flow). Optional at boot -- if unset, the "Connect GitHub" feature
  // reports itself as not configured rather than blocking API startup,
  // since not every deployment needs this integration turned on.
  githubAppId: process.env.GITHUB_APP_ID ?? '',
  githubAppSlug: process.env.GITHUB_APP_SLUG ?? '',
  // PEM private key, usually \n-escaped in .env like the Firebase key above.
  githubAppPrivateKey: (process.env.GITHUB_APP_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  githubAppWebhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET ?? '',
  // Used only to sign/verify the short-lived `state` param across the
  // install/authorize redirect -- not a long-lived credential.
  gitOauthStateSecret: process.env.GIT_OAUTH_STATE_SECRET || process.env.PROJECT_AUTH_JWT_SECRET || '',

  // GitLab OAuth application (audit finding H7 rewrite).
  gitlabAppClientId: process.env.GITLAB_APP_CLIENT_ID ?? '',
  gitlabAppClientSecret: process.env.GITLAB_APP_CLIENT_SECRET ?? '',
  // Must exactly match the redirect URI configured on the GitLab
  // application. Defaults to the platform API's own callback path.
  gitlabRedirectUri:
    process.env.GITLAB_REDIRECT_URI ?? `https://api.${process.env.ROOT_DOMAIN ?? 'shanutechx.com'}/api/git/gitlab/callback`,

  // Bitbucket & Gitea Git Providers
  bitbucketKey: process.env.BITBUCKET_KEY ?? '',
  bitbucketSecret: process.env.BITBUCKET_SECRET ?? '',
  giteaBaseUrl: process.env.GITEA_BASE_URL ?? '',
  giteaClientId: process.env.GITEA_CLIENT_ID ?? '',
  giteaRedirectUri: process.env.GITEA_REDIRECT_URI ?? '',
};
