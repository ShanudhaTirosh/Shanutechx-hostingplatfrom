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
  | 'bot_hosting';

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
  createdAt: string;
  items?: OrderItem[];
  payments?: Payment[];
}

export type PaymentStatus = 'pending' | 'auto_approved' | 'manually_approved' | 'manual_review' | 'rejected';

export interface Payment {
  id: string;
  orderId: string;
  method: 'manual' | 'sms' | 'proof_upload';
  confidenceScore: number | null;
  status: PaymentStatus;
  createdAt: string;
  order?: Order & { user?: ApiUser };
}

export type DeploymentStatus = 'pending' | 'pending_configuration' | 'building' | 'running' | 'failed' | 'stopped';

export type ManagedDatabaseStatus = 'pending' | 'pending_configuration' | 'running' | 'stopped' | 'failed' | 'terminated';

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
}

export interface Node {
  id: string;
  label: string;
  ip: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  roleTags: string[];
  isActive: boolean;
  cpuUsedPct: number | null;
  ramUsedMb: number | null;
  diskUsedGb: number | null;
  lastSeenAt: string | null;
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
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
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

export interface Project {
  id: string;
  userId: string;
  name: string;
  nodeId: string;
  dbName: string;
  dbUsername: string;
  dbPassword: string;        // only revealed on single-project GET
  apiPort: number | null;
  containerId: string | null;
  status: ProjectStatus;
  r2BucketName: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<ApiUser, 'id' | 'email' | 'displayName'>;
  node?: { id: string; label: string; ip: string };
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface ProjectTable {
  name: string;
  columns: TableColumn[];
  rowCount: number;
}

export interface SqlResult {
  rows: Record<string, unknown>[];
  fields: { name: string; dataTypeID: number }[];
  rowCount: number;
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
  nodeId: string;
  type: 'postgres' | 'mysql' | 'redis' | 'mongodb';
  status: ManagedDatabaseStatus;
  containerId?: string | null;
  internalHost?: string | null;
  internalPort?: number | null;
  dbName?: string | null;
  allowedIps?: string[];
  maxConnections?: number | null;
  dbVersion?: string | null;
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
  status: 'ACTIVE' | 'PROVISIONING' | 'SUSPENDED';
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
  studioUrl?: string;
  createdAt: string;
}


