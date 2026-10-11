import { prisma } from './prisma';
import { logger } from './logger';
import { env } from '../env';

export interface EmailPlanQuotas {
  planName: string;
  hasActivePlan: boolean;
  isDev: boolean;
  maxMailboxes: number;
  usedMailboxes: number;
  remainingMailboxes: number;
  maxStorageMb: number;
  allocatedStorageMb: number;
  remainingStorageMb: number;
  dailySendLimit: number;
  maxAliases: number;
  maxDomains: number;
  usedDomains: number;
  connectedDomains: string[];
}

/**
 * Resolves customer email plan quotas and resource limits based on their
 * active subscriptions (Subscription -> OrderItem -> Plan -> specsJson)
 * and completed/paid orders. Dev users receive unrestricted superuser access.
 */
export async function getUserEmailPlanQuotas(userId: string, role: string): Promise<EmailPlanQuotas> {
  // 1. Dev superuser bypass per AGENTS.md guardrails
  if (role === 'dev') {
    const existingAccounts = await prisma.smtpAccount.findMany({
      where: {},
      select: { id: true, storageQuotaMb: true, customDomain: true },
    });
    const allocatedMb = existingAccounts.reduce((sum, a) => sum + (a.storageQuotaMb || 1024), 0);
    const domains = Array.from(new Set(existingAccounts.map((a) => a.customDomain).filter(Boolean))) as string[];

    return {
      planName: 'Developer Superuser (Unrestricted)',
      hasActivePlan: true,
      isDev: true,
      maxMailboxes: 9999,
      usedMailboxes: existingAccounts.length,
      remainingMailboxes: 9999,
      maxStorageMb: 999999,
      allocatedStorageMb: allocatedMb,
      remainingStorageMb: 999999 - allocatedMb,
      dailySendLimit: 999999,
      maxAliases: 9999,
      maxDomains: 9999,
      usedDomains: domains.length,
      connectedDomains: domains,
    };
  }

  // 2. Fetch user's active subscriptions
  const activeSubs = await prisma.subscription.findMany({
    where: { userId, status: 'active' },
    include: {
      orderItem: {
        include: {
          plan: { include: { product: true } },
        },
      },
    },
  });

  // 3. Fetch user's paid orders
  const paidOrders = await prisma.order.findMany({
    where: { userId, status: 'paid' },
    include: {
      items: {
        include: {
          plan: { include: { product: true } },
        },
      },
    },
  });

  let maxMailboxes = 0;
  let maxStorageMb = 0;
  let dailySendLimit = 1000;
  let maxAliases = 5;
  let maxDomains = 3;
  let primaryPlanName = '';

  const processPlanSpecs = (plan: any, quantity = 1, configJson?: any) => {
    if (!plan && !configJson) return;

    const specs: any = plan?.specsJson || {};
    const cfg: any = configJson || {};

    const isEmailPlan =
      plan?.product?.category === 'smtp' ||
      cfg.serviceType === 'smtp_hosting' ||
      cfg.type === 'smtp_hosting' ||
      cfg.category === 'email' ||
      (plan?.name && /email|smtp|mail/i.test(plan.name)) ||
      specs.mailboxesCount !== undefined ||
      specs.maxMailboxes !== undefined;

    if (!isEmailPlan) return;

    if (!primaryPlanName && plan?.name) {
      primaryPlanName = plan.name;
    }

    // Mailboxes limit
    const mailboxesFromSpecs = Number(
      specs.mailboxesCount || specs.maxMailboxes || cfg.maxMailboxes || cfg.seats || quantity || 1
    );
    maxMailboxes += Math.max(1, mailboxesFromSpecs);

    // Storage limit in MB
    let planStorageMb = 1024;
    if (typeof specs.storageQuotaMb === 'number') {
      planStorageMb = specs.storageQuotaMb === -1 ? 999999 : specs.storageQuotaMb;
    } else if (typeof specs.storageGB === 'number') {
      planStorageMb = specs.storageGB * 1024;
    } else if (typeof cfg.storageGB === 'number') {
      planStorageMb = cfg.storageGB * 1024;
    }
    maxStorageMb += planStorageMb;

    // Daily send limit
    const planSendLimit = Number(specs.dailyQuota || specs.dailySendLimit || cfg.dailySendLimit || 1000);
    dailySendLimit = Math.max(dailySendLimit, planSendLimit);

    // Aliases limit
    const planAliases = Number(specs.maxAliases || specs.emailAliases || cfg.maxAliases || 5);
    maxAliases = Math.max(maxAliases, planAliases);

    // Domains limit
    const planDomains = Number(specs.maxDomains || cfg.maxDomains || 3);
    maxDomains = Math.max(maxDomains, planDomains);
  };

  // Inspect active subscriptions first
  for (const sub of activeSubs) {
    if (sub.orderItem?.plan) {
      processPlanSpecs(sub.orderItem.plan, sub.orderItem.quantity, (sub.orderItem as any).configJson);
    }
  }

  // Also inspect paid orders for one-time or upfront packages
  for (const ord of paidOrders) {
    for (const item of ord.items) {
      processPlanSpecs(item.plan, item.quantity, (item as any).configJson);
    }
  }

  const hasActivePlan = maxMailboxes > 0 || maxStorageMb > 0;

  // Query existing user accounts to calculate allocated vs remaining
  const existingAccounts = await prisma.smtpAccount.findMany({
    where: { userId },
    select: { id: true, storageQuotaMb: true, customDomain: true },
  });

  const usedMailboxes = existingAccounts.length;
  const allocatedStorageMb = existingAccounts.reduce((sum, a) => sum + (a.storageQuotaMb || 1024), 0);
  const remainingMailboxes = Math.max(0, maxMailboxes - usedMailboxes);
  const remainingStorageMb = Math.max(0, maxStorageMb - allocatedStorageMb);

  const domainSet = new Set(existingAccounts.map((a) => a.customDomain).filter(Boolean) as string[]);
  const connectedDomains = Array.from(domainSet);
  const usedDomains = connectedDomains.length;

  return {
    planName: primaryPlanName || (hasActivePlan ? 'Business Email Plan' : 'No Active Plan'),
    hasActivePlan,
    isDev: false,
    maxMailboxes,
    usedMailboxes,
    remainingMailboxes,
    maxStorageMb,
    allocatedStorageMb,
    remainingStorageMb,
    dailySendLimit,
    maxAliases,
    maxDomains,
    usedDomains,
    connectedDomains,
  };
}

/**
 * Validates whether a customer can create a mailbox with the requested storage quota and domain.
 */
export async function validateMailboxCreationQuota(
  userId: string,
  role: string,
  requestedStorageQuotaMb: number,
  domain: string
): Promise<{ allowed: boolean; error?: string; status?: number; code?: string; quotas: EmailPlanQuotas }> {
  const quotas = await getUserEmailPlanQuotas(userId, role);

  if (role === 'dev') {
    return { allowed: true, quotas };
  }

  if (!quotas.hasActivePlan) {
    return {
      allowed: false,
      status: 403,
      code: 'PURCHASE_REQUIRED',
      error: 'You need an active Business Email subscription plan to create mailboxes. Please browse the Catalog to purchase a plan.',
      quotas,
    };
  }

  if (quotas.usedMailboxes >= quotas.maxMailboxes) {
    return {
      allowed: false,
      status: 403,
      code: 'MAILBOX_LIMIT_REACHED',
      error: `You have reached your plan limit of ${quotas.maxMailboxes} mailbox${quotas.maxMailboxes === 1 ? '' : 'es'} (${quotas.usedMailboxes}/${quotas.maxMailboxes} used). Please upgrade your subscription to add more mailboxes.`,
      quotas,
    };
  }

  if (requestedStorageQuotaMb > quotas.remainingStorageMb) {
    return {
      allowed: false,
      status: 403,
      code: 'STORAGE_QUOTA_EXCEEDED',
      error: `Requested storage quota (${requestedStorageQuotaMb} MB) exceeds your remaining plan storage pool (${quotas.remainingStorageMb} MB). Your plan allows ${quotas.maxStorageMb} MB total (${quotas.allocatedStorageMb} MB already allocated).`,
      quotas,
    };
  }

  const cleanDomain = domain.toLowerCase().trim();
  const isExistingDomain = quotas.connectedDomains.includes(cleanDomain);
  if (!isExistingDomain && quotas.usedDomains >= quotas.maxDomains && cleanDomain !== env.rootDomain) {
    return {
      allowed: false,
      status: 403,
      code: 'DOMAIN_LIMIT_REACHED',
      error: `You have reached your custom domain limit (${quotas.usedDomains}/${quotas.maxDomains} domains connected). Please upgrade your plan to connect more domains.`,
      quotas,
    };
  }

  return { allowed: true, quotas };
}
