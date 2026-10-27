import { dbOps } from "./db";
import { env } from "./env";

/**
 * Typed resolvers for settings stored as key/value JSON rows in the `settings` table.
 * Each getter reads the DB first and falls back to env / hardcoded defaults so existing
 * deployments keep working until an admin saves settings from the UI.
 */

// ---------- Branding ----------
export interface Branding {
  siteName: string;
  tagline: string;
  description: string;
  footerText: string;
  footerLinkText: string;
  footerLinkUrl: string;
  metaTitle: string;
  metaDescription: string;
}

export const DEFAULT_BRANDING: Branding = {
  siteName: "Status",
  tagline: "STX Cloud & Infrastructure Health",
  description: "Real-time availability, operational telemetry, and uptime status for STX platform services.",
  footerText: "Operated by",
  footerLinkText: "ShanuTechX Cloud",
  footerLinkUrl: "https://shanutechx.com",
  metaTitle: "STX Status — Cloud & Infrastructure Health",
  metaDescription: "Live availability, system metrics, and incident status for STX cloud infrastructure.",
};

export async function getBranding(): Promise<Branding> {
  const stored = await dbOps.getSetting<Partial<Branding>>("branding");
  return { ...DEFAULT_BRANDING, ...(stored ?? {}) };
}

// ---------- Retention ----------
export interface Retention {
  days: number;
}

export const DEFAULT_RETENTION: Retention = { days: 90 };

export async function getRetention(): Promise<Retention> {
  const stored = await dbOps.getSetting<Partial<Retention>>("retention");
  const days = Number(stored?.days);
  return { days: Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION.days };
}

// ---------- Notifications ----------
export interface NotificationConfig {
  email: {
    enabled: boolean;
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
    to?: string;
  };
  googleChat: { enabled: boolean; webhookUrl?: string };
  discord: { enabled: boolean; webhookUrl?: string };
  teams: { enabled: boolean; webhookUrl?: string };
  telegram: { enabled: boolean; botToken?: string; chatId?: string };
}

/** Defaults derived field-by-field from env so existing env-only deployments keep working. */
export function notificationDefaultsFromEnv(): NotificationConfig {
  return {
    email: {
      enabled: env.EMAIL_ENABLED,
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
      from: env.EMAIL_FROM,
      to: env.EMAIL_TO,
    },
    googleChat: {
      enabled: env.GOOGLE_CHAT_ENABLED,
      webhookUrl: env.GOOGLE_CHAT_WEBHOOK_URL,
    },
    discord: {
      enabled: env.DISCORD_ENABLED,
      webhookUrl: env.DISCORD_WEBHOOK_URL,
    },
    teams: {
      enabled: env.TEAMS_ENABLED,
      webhookUrl: env.TEAMS_WEBHOOK_URL,
    },
    telegram: {
      enabled: env.TELEGRAM_ENABLED,
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
    },
  };
}

export async function getNotificationConfig(): Promise<NotificationConfig> {
  const base = notificationDefaultsFromEnv();
  const stored = await dbOps.getSetting<Partial<NotificationConfig>>("notifications");
  if (!stored) return base;
  return {
    email: { ...base.email, ...(stored.email ?? {}) },
    googleChat: { ...base.googleChat, ...(stored.googleChat ?? {}) },
    discord: { ...base.discord, ...(stored.discord ?? {}) },
    teams: { ...base.teams, ...(stored.teams ?? {}) },
    telegram: { ...base.telegram, ...(stored.telegram ?? {}) },
  };
}

// ---------- Admin auth ----------
export interface AdminAuth {
  passwordHash?: string;
}

export async function getAdminAuth(): Promise<AdminAuth> {
  return (await dbOps.getSetting<AdminAuth>("admin")) ?? {};
}
