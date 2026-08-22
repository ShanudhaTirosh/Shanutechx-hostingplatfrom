import { sendSmtpEmail } from './smtpDispatcher';
import { logger } from './logger';

export interface SmtpPlanTier {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  maxAliases: number;
  storageLimitGb: number;
  dailyQuota: number;
}

export const SMTP_PLAN_TIERS: Record<string, SmtpPlanTier> = {
  starter: {
    id: 'starter',
    name: 'Starter Mail Hosting',
    maxAliases: 3,
    storageLimitGb: 5,
    dailyQuota: 500,
  },
  pro: {
    id: 'pro',
    name: 'Professional Mail Hosting',
    maxAliases: 5,
    storageLimitGb: 25,
    dailyQuota: 2500,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Mail Hosting',
    maxAliases: 10,
    storageLimitGb: 100,
    dailyQuota: 10000,
  },
};

export function getTierFromPlanName(planName: string): SmtpPlanTier {
  const lower = planName.toLowerCase();
  if (lower.includes('enterprise')) return SMTP_PLAN_TIERS.enterprise;
  if (lower.includes('pro')) return SMTP_PLAN_TIERS.pro;
  return SMTP_PLAN_TIERS.starter;
}

/**
 * Validates domain assignment rules:
 * - Admins and Devs can use the main platform domain (e.g. shanutechx.com).
 * - Customers MUST use their own custom domain.
 */
export function validateDomainForUser(
  userRole: string,
  targetDomain: string,
  rootDomain: string
): { valid: boolean; error?: string } {
  const isMainDomain = targetDomain.toLowerCase() === rootDomain.toLowerCase() || targetDomain.toLowerCase().endsWith(`.${rootDomain.toLowerCase()}`);
  const isStaff = userRole === 'admin' || userRole === 'dev';

  if (isMainDomain && !isStaff) {
    return {
      valid: false,
      error: `The main platform domain (${rootDomain}) is reserved for Admin & Staff accounts. Customers must configure their own custom domain.`,
    };
  }

  return { valid: true };
}

export function generateDefaultAliases(domain: string, maxCount: number): string[] {
  const defaults = ['info', 'support', 'sales', 'billing', 'contact', 'admin', 'hello', 'jobs', 'help', 'team'];
  return defaults.slice(0, maxCount).map((prefix) => `${prefix}@${domain}`);
}

export interface SmtpReleaseDetails {
  clientEmail: string;
  clientName: string;
  planName: string;
  tier: SmtpPlanTier;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  webmailUrl: string;
  domain: string;
  aliases: string[];
  orderId?: string;
  paymentId?: string;
  amountPaid?: string;
}

/**
 * Sends a rich HTML Welcome Release Email with Payment Proof, Invoice, Credentials, and Aliases to the client.
 */
export async function sendSmtpReleaseEmail(details: SmtpReleaseDetails): Promise<void> {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background-color: #0f111a; color: #e2e8f0; padding: 32px; border-radius: 16px; max-width: 640px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #8b5cf6; margin: 0; font-size: 24px;">ShanuTechX Cloud Platform</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Payment Approved &amp; Service Provisioned</p>
      </div>

      <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #10b981;">
        <h2 style="color: #10b981; font-size: 16px; margin: 0 0 8px 0;">✓ Payment Approved &amp; Order Confirmed</h2>
        <p style="font-size: 13px; margin: 4px 0; color: #cbd5e1;">Payment Status: <strong>APPROVED</strong></p>
        ${details.paymentId ? `<p style="font-size: 13px; margin: 4px 0; color: #cbd5e1;">Payment ID: <code style="color: #38bdf8;">${details.paymentId}</code></p>` : ''}
        ${details.orderId ? `<p style="font-size: 13px; margin: 4px 0; color: #cbd5e1;">Order Ref: <code style="color: #38bdf8;">${details.orderId}</code></p>` : ''}
        ${details.amountPaid ? `<p style="font-size: 13px; margin: 4px 0; color: #cbd5e1;">Amount Paid: <strong>${details.amountPaid}</strong></p>` : ''}
      </div>

      <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h3 style="color: #f8fafc; font-size: 15px; margin: 0 0 12px 0;">🔑 Your SMTP Account Credentials</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">Plan Tier:</td><td style="font-weight: bold; color: #a78bfa;">${details.planName} (${details.tier.storageLimitGb}GB Storage)</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Configured Domain:</td><td style="font-mono: true; font-weight: bold; color: #38bdf8;">${details.domain}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">SMTP Host:</td><td style="font-mono: true; font-weight: bold; color: #38bdf8;">${details.smtpHost}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">SMTP Port:</td><td style="font-mono: true; color: #f8fafc;">${details.smtpPort} (STARTTLS / TLS)</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Username:</td><td style="font-mono: true; color: #f8fafc;">${details.smtpUsername}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Password:</td><td style="background-color: #0f172a; padding: 4px 8px; border-radius: 6px; font-mono: true; color: #34d399; font-weight: bold;">${details.smtpPassword}</td></tr>
        </table>
      </div>

      <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <h3 style="color: #f8fafc; font-size: 15px; margin: 0 0 12px 0;">📧 Configured Email Aliases (${details.aliases.length} / ${details.tier.maxAliases})</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #38bdf8;">
          ${details.aliases.map((a) => `<li style="margin-bottom: 4px;"><code>${a}</code></li>`).join('')}
        </ul>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${details.webmailUrl}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none; font-size: 14px;">Open Webmail Client →</a>
      </div>
    </div>
  `;

  try {
    await sendSmtpEmail(
      {
        host: process.env.SMTP_HOST || 'mail.shanutechx.com',
        port: Number(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER || 'no-reply@shanutechx.com',
        pass: process.env.SMTP_PASS || 'smtp_pass',
      },
      {
        from: `"ShanuTechX Provisioner" <${process.env.SMTP_USER || 'no-reply@shanutechx.com'}>`,
        to: details.clientEmail,
        subject: `[ShanuTechX] SMTP Credentials & Order Release - ${details.planName}`,
        html: htmlBody,
      }
    );
    logger.info({ recipient: details.clientEmail, plan: details.planName }, 'Dispatched SMTP Credentials Release Email');
  } catch (err: any) {
    logger.error({ err: err.message, recipient: details.clientEmail }, 'Failed to dispatch SMTP Release Email');
  }
}
