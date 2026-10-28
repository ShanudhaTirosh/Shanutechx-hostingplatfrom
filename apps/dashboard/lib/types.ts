export interface ApiUser {
  id: string;
  email: string;
  role: 'customer' | 'admin' | 'support' | 'dev';
  displayName?: string | null;
  phoneNumber?: string | null;
  discordUserId?: string | null;
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
}

export type ServiceType =
  | 'web_hosting'
  | 'node_hosting'
  | 'python_hosting'
  | 'discordbot_python'
  | 'discordbot_node'
  | 'vps'
  | 'smtp'
  | 'livekit'
  | 'docker_hosting'
  | 'mongodb_hosting';

export interface Service {
  id: string;
  type: ServiceType;
  name: string;
  price: number; // smallest currency unit
  currency: 'LKR' | 'USD' | 'EUR'; // Service currency
  nodeId: string | null;
}

export type ProductCategory =
  | 'vps'
  | 'smtp'
  | 'web_hosting'
  | 'database'
  | 'app_catalog'
  | 'bot_hosting'
  | 'app_deployment';

export type PlanBillingType = 'one_time' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export interface Plan {
  id: string;
  productId: string;
  name: string;
  price: number; // smallest currency unit
  currency: 'LKR' | 'USD' | 'EUR';
  billingType: PlanBillingType;
  isPopular?: boolean;
  badge?: string | null;
  specsJson: Record<string, unknown> | null;
  isActive: boolean;
  product?: Product;
}

export interface Product {
  id: string;
  category: ProductCategory;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  isPopular?: boolean;
  badge?: string | null;
  isActive: boolean;
  plans: Plan[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  serviceId: string | null;
  service: Service | null;
  planId: string | null;
  plan: Plan | null;
  quantity: number;
  configJson?: Record<string, any> | null;
}

export interface Order {
  id: string;
  userId: string;
  status: 'draft' | 'awaiting_payment' | 'paid' | 'cancelled';
  total: number;
  totalLkr?: number;
  currency?: string;
  createdAt: string;
  items?: OrderItem[];
  payments?: Payment[];
}

export type PaymentStatus = 'pending' | 'auto_approved' | 'manually_approved' | 'manual_review' | 'rejected';

export interface Payment {
  id: string;
  orderId: string;
  method: 'manual' | 'sms' | 'proof_upload';
  proofUrl?: string | null;
  extractedJson?: Record<string, any> | null;
  confidenceScore: number | null;
  status: PaymentStatus;
  createdAt: string;
  reviewedById?: string | null;
  reviewedBy?: ApiUser | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  order?: Order & { user?: ApiUser; items?: OrderItem[] };
}

export type DeploymentStatus = 'pending' | 'pending_configuration' | 'building' | 'running' | 'failed' | 'stopped';

export type ManagedDatabaseStatus = 'pending' | 'pending_configuration' | 'running' | 'stopped' | 'failed' | 'deleting' | 'terminated';

export type CustomDomainStatus = 'pending' | 'verified' | 'failed' | 'ssl_provisioning' | 'active';

export interface CustomDomain {
  id: string;
  domain: string;
  cnameTarget: string;
  status: CustomDomainStatus;
  sslCertId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  repoUrl: string | null;
  branch?: string | null;
  subdomain: string | null;
  status: DeploymentStatus;
  containerId: string | null;
  createdAt: string;
  node?: { label: string };
  customDomain?: string | null;
  customDomainStatus?: 'none' | 'pending' | 'verified' | 'failed';
  customDomains?: CustomDomain[];
  startCommand?: string | null;
  entryFile?: string | null;
  frameworkPreset?: string | null;
  exposureMode?: string | null;
  publishedPort?: number | null;
  gitCommitHash?: string | null;
  gitCommitMessage?: string | null;
  autoDeploy?: boolean;
  hasGitToken?: boolean;
  builder?: string | null;
  rootDir?: string | null;
  watchPaths?: string[] | null;
  nixpacksConfig?: any;
  webHostingType?: string | null;
}

export interface NixpacksConfig {
  providers?: string[];
  buildImage?: string;
  variables?: Record<string, string>;
  phases?: Record<string, {
    dependsOn?: string[];
    nixPkgs?: string[];
    aptPkgs?: string[];
    cmds?: string[];
    onlyIncludeFiles?: string[];
  }>;
  start?: {
    cmd?: string;
    runImage?: string;
    onlyIncludeFiles?: string[];
  };
  staticEnv?: Record<string, string>;
}

export interface WebHostingDeployInput {
  repoUrl: string;
  branch?: string;
  preferredName: string;
  customSubdomain?: string;
  webHostingType?: 'static' | 'nodejs' | 'nextjs' | 'vite' | 'php' | 'auto';
  frameworkPreset?: string;
  builder?: 'AUTO' | 'RAILWAYPACK' | 'NIXPACKS' | 'DOCKERFILE';
  nodeId?: string;
  orderItemId?: string;
  customDomain?: string;
  envVars?: Record<string, string>;
  rootDir?: string;
  nixpacksConfig?: NixpacksConfig;
}

export interface BotHostingDeployInput {
  name: string;
  repoUrl: string;
  branch?: string;
  language: 'python' | 'nodejs' | 'whatsapp' | 'java';
  botType?: 'discord_python' | 'discord_node' | 'whatsapp_baileys' | 'lavalink' | 'custom_bot';
  startCommand?: string;
  entryFile?: string;
  builder?: 'AUTO' | 'RAILWAYPACK' | 'NIXPACKS' | 'DOCKERFILE';
  envVars?: Record<string, string>;
  nodeId?: string;
  orderItemId?: string;
  rootDir?: string;
  nixpacksConfig?: NixpacksConfig;
}

export type NodeStatus = 'pending' | 'installing' | 'online' | 'degraded' | 'offline' | 'maintenance' | 'error';

export interface Node {
  id: string;
  label: string;
  ip: string;
  sshPort?: number;
  os?: string | null;
  provider?: string | null;
  agentVersion?: string | null;
  maintenanceReason?: string | null;
  statusMessage?: string | null;
  status?: NodeStatus;
  isSchedulable?: boolean;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  roleTags: string[];
  isActive: boolean;
  cpuUsedPct: number | null;
  ramUsedMb: number | null;
  diskUsedGb: number | null;
  lastSeenAt: string | null;
  region?: string | null;
  metadata?: any;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'node_enroll' | 'node_maintenance' | 'app_deploy' | 'supabase_provision' | 'mailbox_provision' | 'backup_create' | 'backup_restore';

export interface InfrastructureJob {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  currentStep?: string | null;
  error?: string | null;
  logs?: Array<{ timestamp: string; level: string; message: string }>;
  nodeId?: string | null;
  userId?: string | null;
  payload?: any;
  result?: any;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BuildEvent {
  phase: 'fetch' | 'build' | 'run' | 'done' | 'complete' | 'error';
  message?: string;
  log?: string;
  containerId?: string;
  deploymentId?: string;
  subdomain?: string;
}

export interface SmtpAccount {
  id: string;
  userId: string;
  postalOrgId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  webmailUrl: string | null;
  createdAt: string;
}

export interface LiveKitProject {
  id: string;
  userId: string;
  apiKey: string;
  nodeId: string | null;
  createdAt: string;
}

export type VpsProvisionStatus = 'pending' | 'provisioned' | 'terminated';

export interface VpsProvision {
  id: string;
  userId: string;
  orderItemId: string;
  provider: string;
  externalId: string | null;
  panelUrl: string | null;
  ip: string | null;
  sshPort: number | null;
  username: string | null;
  credentialRef: string | null;
  sshPrivateKey?: string | null;
  sshPublicKey?: string | null;
  notes?: string | null;
  status: VpsProvisionStatus;
  createdAt: string;
  leasewebVpsId: string | null;
}

export type TicketStatus = 'open' | 'pending' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'customer' | 'admin';
  body: string;
  createdAt: string;
  sender?: ApiUser;
}

export interface Ticket {
  id: string;
  userId: string;
  orderId: string | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  user?: ApiUser;
  messages?: TicketMessage[];
  _count?: { messages: number };
}

export interface Customer {
  id: string;
  email: string;
  displayName: string | null;
  firebaseUid: string;
  phoneNumber: string | null;
  discordUserId: string | null;
  role?: 'customer' | 'support' | 'admin' | 'dev';
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  assignedAdminId?: string | null;
  assignedAdmin?: { id: string; email: string; displayName: string | null } | null;
  servicesCount?: number;
  deploymentsCount?: number;
  vpsCount?: number;
  ticketsCount?: number;
  databasesCount?: number;
  smtpCount?: number;
}

export interface CustomerOrderItem {
  id: string;
  quantity: number;
  priceLkr?: number | null;
  configJson?: any;
  plan?: {
    id: string;
    name: string;
    category?: string;
    cpuCores?: number;
    ramGb?: number;
    storageGb?: number;
    price?: number;
    currency?: string;
    product?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
  service?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
}

export interface CustomerOrderPayment {
  id: string;
  method: string;
  amount: number;
  status: string;
  receiptUrl?: string | null;
  transactionRef?: string | null;
  createdAt: string;
}

export interface CustomerOrderInvoice {
  id: string;
  invoiceNumber: string;
  pdfUrl?: string | null;
}

export interface CustomerOrder {
  id: string;
  status: string;
  total: number;
  currency: string;
  totalLkr: number;
  createdAt: string;
  items: CustomerOrderItem[];
  payments: CustomerOrderPayment[];
  invoice?: CustomerOrderInvoice | null;
}

export interface CustomerVpsProvision {
  id: string;
  provider: string;
  externalId?: string | null;
  panelUrl?: string | null;
  ip?: string | null;
  sshPort: number;
  username?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  provisionedAt?: string | null;
  orderItem?: {
    plan?: {
      id: string;
      name: string;
      product?: { name: string } | null;
    } | null;
  } | null;
}

export interface CustomerDeployment {
  id: string;
  subdomain?: string | null;
  runtime?: string | null;
  status: string;
  createdAt: string;
  node?: {
    id: string;
    label: string;
    ip: string;
  } | null;
  orderItem?: {
    plan?: {
      id: string;
      name: string;
      product?: { name: string } | null;
    } | null;
  } | null;
}

export interface CustomerManagedDatabase {
  id: string;
  name: string;
  engine: string;
  status: string;
  port: number;
  createdAt: string;
  node?: {
    id: string;
    label: string;
    ip: string;
  } | null;
}

export interface CustomerSmtpAccount {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface CustomerDetails extends Customer {
  avatarUrl?: string | null;
  orders: CustomerOrder[];
  vpsProvisions: CustomerVpsProvision[];
  deployments: CustomerDeployment[];
  managedDatabases: CustomerManagedDatabase[];
  smtpAccounts: CustomerSmtpAccount[];
  subscriptions: any[];
  tickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  orderItemId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  createdAt: string;
  pastDueAt: string | null;
  cancelledAt: string | null;
  orderItem?: { service: Service | null; plan?: (Plan & { product?: Product }) | null };
  user?: ApiUser;
}

// ── Projects (Supabase clone) ────────────────────────────────────────────────

export type ProjectStatus = 'pending' | 'running' | 'failed';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'admin' | 'developer' | 'read_only';
  createdAt: string;
  user?: ApiUser | Pick<ApiUser, 'id' | 'email' | 'displayName' | 'role'>;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  region?: string | null;
  isArchived?: boolean;
  nodeId?: string | null;
  dbName: string;
  dbUsername: string;
  dbPassword?: string;        // only revealed on single-project GET
  apiPort?: number | null;
  dbPort?: number | null;
  containerId?: string | null;
  status: ProjectStatus | 'running' | 'pending' | 'failed' | 'archived';
  r2BucketName?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: ApiUser | Pick<ApiUser, 'id' | 'email' | 'displayName'>;
  node?: { id: string; label: string; ip: string } | Node;
  callerRole?: 'owner' | 'admin' | 'developer' | 'read_only';
  members?: ProjectMember[];
  databases?: ManagedDatabase[];
  aggregateMetrics?: {
    totalDatabases: number;
    activeDatabases: number;
    totalCpuCores: number;
    totalRamMb: number;
    totalStorageGb: number;
  };
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface ProjectTable {
  name: string;
  schema?: string;
  columns?: TableColumn[];
  rowCount: number;
}

export interface SqlResult {
  ok?: boolean;
  exitCode?: number;
  rawOutput?: string;
  executionTimeMs?: number;
  rows?: Record<string, unknown>[];
  fields?: { name: string; dataTypeID: number }[];
  columns?: string[];
  rowCount?: number;
  error?: string;
}

export interface CatalogTemplate {
  slug: string;
  filename: string;
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  tags: string[];
  logo: string;
  port: number | null;
  recommendedExposureMode?: 'ssl_with_proxy' | 'internal_only' | 'raw_tcp' | string | null;
}

export type VpsPlanCategory = 'web_hosting' | 'app_server' | 'database_server' | 'storage_server';
export type Currency = 'LKR' | 'USD';
export type BillingPeriod = 'one_time' | 'monthly' | 'yearly';

export interface VpsPlan {
  id: string;
  provider: string;
  name: string;
  bandwidth: string;
  category: VpsPlanCategory;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  price: number;
  currency: Currency;
  billingPeriod: BillingPeriod;
  isActive: boolean;
  leasewebProductCode: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Webmail Interfaces ───────────────────────────────────────────────────

export interface WebmailMessage {
  id: string;
  userId?: string;
  smtpAccountId?: string | null;
  folder?: string;
  threadId?: string | null;
  senderName?: string;
  senderEmail?: string;
  recipientEmail?: string;
  subject?: string;
  snippet?: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string | null;
  inReplyTo?: string | null;
  tag?: string | null;
  category?: string;
  priority?: string;
  isRead?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  snoozedUntil?: string | null;
  scheduledAt?: string | null;
  readReceipt?: boolean;
  hasAttachments?: boolean;
  attachmentsJson?: Array<{ filename: string; sizeStr: string; url?: string }>;
  attachments?: Array<{ filename: string; sizeStr: string; url?: string; content?: string }>;
  labels?: string[];
  createdAt?: string;
  updatedAt?: string;
  // Legacy compat aliases
  from?: string;
  to?: string;
  body?: string;
  timestamp?: string;
}

export interface WebmailThread {
  threadId: string;
  messageCount: number;
  latestMessage?: WebmailMessage;
  participants?: string[];
  subject?: string;
  snippet?: string;
  isRead?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  folder?: string;
  timestamp?: string;
  messages?: WebmailMessage[];
}

export interface WebmailFolder {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  order: number;
  createdAt: string;
}

export interface WebmailLabel {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface WebmailFilter {
  id: string;
  userId: string;
  name: string;
  conditionsJson: any;
  actionsJson: any;
  isActive: boolean;
  createdAt: string;
}

export interface WebmailSignature {
  id: string;
  userId: string;
  smtpAccountId?: string | null;
  name: string;
  htmlContent: string;
  isDefault: boolean;
  createdAt: string;
}

export interface WebmailTemplate {
  id: string;
  userId: string;
  name: string;
  subject?: string | null;
  body: string;
  createdAt: string;
}

export interface WebmailAutoReply {
  id: string;
  userId: string;
  smtpAccountId?: string | null;
  enabled: boolean;
  subject: string;
  body: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
}

export interface WebmailBlockedSender {
  id: string;
  userId: string;
  emailOrDomain: string;
  reason?: string | null;
  createdAt: string;
}

export interface WebmailCalendarSync {
  id: string;
  userId: string;
  provider: 'google' | 'ical' | 'outlook';
  name: string;
  calendarUrl?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
}

export interface WebmailAiSummary {
  keyTakeaway: string;
  bulletPoints: string[];
  sentiment: string;
}

// ── Knowledge Base Interfaces ──────────────────────────────────────────────

export type KbTargetRole = 'all' | 'customer' | 'support' | 'dev' | 'admin';

export interface KbCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export interface KbArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  targetRole?: KbTargetRole;
  tags?: string[];
  published: boolean;
  views: number;
  helpfulCount: number;
  updatedAt: string;
}

export interface ManagedDatabaseUser {
  id: string;
  username: string;
  role: 'admin' | 'read_write' | 'read_only';
  createdAt: string;
}

export interface ManagedDatabase {
  id: string;
  userId: string;
  projectId?: string | null;
  nodeId: string;
  type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
  status: ManagedDatabaseStatus;
  containerId?: string | null;
  internalHost?: string | null;
  internalPort?: number | null;
  dbName?: string | null;
  masterUsername?: string | null;
  masterPassword?: string | null;
  allowedIps?: string[];
  maxConnections?: number | null;
  dbVersion?: string | null;
  cpuLimit?: number | null;
  memoryLimitMb?: number | null;
  storageLimitGb?: number | null;
  user?: ApiUser;
  createdAt: string;
  connectionString?: string;
}


export interface SupabaseClientProject {
  id: string;
  name: string;
  clientEmail: string;
  dbName: string;
  region: string;
  status: 'ACTIVE' | 'PROVISIONING' | 'STOPPED' | 'FAILED' | 'SUSPENDED';
  errorMessage?: string | null;
  anonKey: string;
  serviceKey: string;
  smtpConfigured: boolean;
  studioPort?: number;
  apiPort?: number;
  dbPort?: number;
  storageLimitMb?: number;
  extensions?: string[];
  authSettingsJson?: any;
  poolerSettingsJson?: any;
  nodeId?: string | null;
  nodeIp?: string | null;
  nodeLabel?: string | null;
  subdomain?: string;
  studioUrl?: string;
  apiUrl?: string;
  metaUrl?: string;
  dbUrl?: string;
  resourceUsage?: {
    cpuPct: number;
    ramMb: number;
    diskMb: number;
    dbSizeMb: number;
  };
  createdAt: string;
}

export interface DatabaseBackup {
  id: string;
  databaseId: string;
  s3Endpoint?: string | null;
  s3Bucket: string;
  s3Key: string;
  sizeBytes?: string | number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export type NotificationChannelType = 'discord' | 'whatsapp' | 'email' | 'webhook';

export interface NotificationChannel {
  id: string;
  userId: string;
  name: string;
  type: NotificationChannelType;
  configJson: Record<string, any>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}



