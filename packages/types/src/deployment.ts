// ─── Deployment Types ──────────────────────────────────────────────────────

export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'running'
  | 'failed'
  | 'stopped';

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
}

export interface DeploymentCreateInput {
  /** GitHub/GitLab repo URL or public git URL */
  repoUrl: string;
  /** Which VPS node to deploy on */
  nodeId: string;
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
