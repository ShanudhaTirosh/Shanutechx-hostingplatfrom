// ─── Deployment Types ──────────────────────────────────────────────────────

export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'running'
  | 'failed'
  | 'stopped'
  | 'deleted';

export interface Deployment {
  id: string;
  userId: string;
  nodeId: string;
  repoUrl: string | null;
  subdomain: string | null;
  internalPort: number;
  status: DeploymentStatus;
  cpuLimit: number | null;
  memoryLimit: number | null;
  storageLimit: number | null;
  envVarsEncrypted: string | null;
  createdAt: string;
  lastDeployAt: string | null;
  updatedAt: string;
  rootDir?: string | null;
  watchPaths?: string[];
  nixpacksConfig?: NixpacksConfig | null;
  frameworkPreset?: string | null;
  exposureMode?: string | null;
  startCommand?: string | null;
  entryFile?: string | null;
  webHostingType?: string | null;
  customDomain?: string | null;
}

export interface DeploymentCreateInput {
  /** GitHub/GitLab repo URL or public git URL */
  repoUrl: string;
  /** Which VPS node to deploy on (auto-selected if omitted) */
  nodeId?: string;
  /** Container internal port (default: 3000) */
  internalPort?: number;
  /** Environment variables to set */
  envVars?: Record<string, string>;
  /** CPU limit in cores (e.g. 0.5 = 500m) */
  cpuLimit?: number;
  /** Memory limit in MB */
  memoryLimit?: number;
  /** Storage limit in GB */
  storageLimit?: number;
  /** Git account ID to use for cloning (if private repo) */
  gitAccountId?: string;
  /** Custom subdomain (auto-generated if omitted) */
  subdomain?: string;
}

export interface DeploymentEnvUpdateEvent {
  phase: string;
  message?: string;
  log?: string;
}

export interface ResourceUsage {
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number | null;
  memoryUsagePercent: number;
  storageUsedGb: number;
  storageLimitGb: number | null;
  storageUsagePercent: number;
  timestamp: string;
}

export interface WebhookInfo {
  deploymentId: string;
  webhookUrl: string;
  webhookSecret: string;
  githubSetup: {
    url: string;
    events: string[];
    contentType: string;
  };
  gitlabSetup: {
    url: string;
    secretToken: string;
    trigger: string;
  };
}

// ─── Nixpacks & Railwaypack Buildpack Types ─────────────────────────────────

export type NixpacksBuilder = 'NIXPACKS' | 'RAILWAYPACK' | 'DOCKERFILE' | 'AUTO';

export interface NixpacksPhases {
  setup?: { nixPkgs?: string[]; cmds?: string[] };
  install?: { cmds?: string[] };
  build?: { cmds?: string[] };
  start?: { cmd?: string };
}

export interface NixpacksConfig {
  builder?: NixpacksBuilder;
  runtimeVersion?: string;
  phases?: NixpacksPhases;
  watchPaths?: string[];
  rootDir?: string | null;
}

export interface NixpacksConfigResponse {
  ok?: boolean;
  rootDir: string | null;
  watchPaths: string[];
  nixpacksConfig: NixpacksConfig;
}

// ─── Web Hosting Types ──────────────────────────────────────────────────────

export interface WebHostingDeployInput {
  preferredName: string;
  repoUrl: string;
  branch?: string;
  customSubdomain?: string;
  internalPort?: number;
  envVars?: Record<string, string>;
  frameworkPreset?: 'auto' | 'nextjs' | 'react_vite' | 'static_html' | 'custom';
  builder?: NixpacksBuilder;
  rootDir?: string;
  watchPaths?: string[];
  nixpacksConfig?: NixpacksConfig;
  orderItemId?: string;
  isPendingConfig?: boolean;
  startCommand?: string;
  entryFile?: string;
  customDomain?: string;
  cloudflare?: { apiToken: string; zoneId?: string };
}

// ─── Bot Hosting Types (Discord, WhatsApp, Lavalink) ────────────────────────

export type BotHostingLanguage = 'python' | 'nodejs' | 'whatsapp' | 'java';
export type BotHostingType =
  | 'discord_python'
  | 'discord_node'
  | 'whatsapp_baileys'
  | 'lavalink'
  | 'custom_bot';

export interface BotHostingDeployInput {
  preferredName: string;
  language?: BotHostingLanguage;
  botType?: BotHostingType;
  repoUrl?: string;
  branch?: string;
  entryFile?: string;
  startCommand?: string;
  envVars?: Record<string, string>;
  isPendingConfig?: boolean;
  orderItemId?: string;
  exposureMode?: 'no_ssl' | 'ssl_with_proxy' | 'ssl_direct' | 'raw_tcp';
  publishedPort?: number;
}

export interface BotDeploymentResponse {
  ok: boolean;
  botDeployment: Deployment;
  language?: string;
  botType?: string;
  entryFile?: string;
  startCommand?: string;
}

// ─── Git Repo Deployment Types with Nixpack / Railwaypacks ─────────────────

export interface RepoDeployInput {
  repoUrl: string;
  preferredName: string;
  serviceType?:
    | 'web_hosting'
    | 'node_hosting'
    | 'python_hosting'
    | 'discordbot_python'
    | 'discordbot_node'
    | 'whatsapp_baileys'
    | 'lavalink'
    | 'custom_docker';
  branch?: string;
  customSubdomain?: string;
  internalPort?: number;
  envVars?: Record<string, string>;
  builder?: NixpacksBuilder;
  rootDir?: string;
  watchPaths?: string[];
  nixpacksConfig?: NixpacksConfig;
  gitProvider?: 'github' | 'gitlab' | 'custom';
  gitAccountId?: string;
  gitToken?: string;
  startCommand?: string;
  entryFile?: string;
  frameworkPreset?: string;
  exposureMode?: 'ssl_with_proxy' | 'ssl_direct' | 'no_ssl' | 'internal_only' | 'raw_tcp';
  publishedPort?: number;
  cpuLimit?: number;
  memoryLimit?: number;
  storageLimit?: number;
  orderItemId?: string;
  isPendingConfig?: boolean;
}
