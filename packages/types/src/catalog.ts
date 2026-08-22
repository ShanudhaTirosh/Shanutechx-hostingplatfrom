// ─── App Catalog Types ─────────────────────────────────────────────────────

export type TemplateCategory =
  | 'database'
  | 'cache'
  | 'messaging'
  | 'ai'
  | 'cms'
  | 'realtime'
  | 'workflow'
  | 'monitoring'
  | 'other';

export interface TemplateEnvSchema {
  key: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  secret?: boolean;
}

export interface CatalogTemplate {
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  version: string;
  envSchema: TemplateEnvSchema[];
  ports: number[];
  minMemoryMb?: number;
  minCpuCores?: number;
  tags: string[];
}

export interface CatalogDeployInput {
  templateSlug: string;
  nodeId: string;
  envVars: Record<string, string>;
  subdomain?: string;
}
