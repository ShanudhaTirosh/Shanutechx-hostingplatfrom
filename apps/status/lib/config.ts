export const intervalSeconds = 30;
export const timeoutMs = 15000;

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  timeoutMs: number;
}

export const sites: SiteConfig[] = [
  {
    id: "stx-api-health",
    name: "STX API & Orchestration Engine",
    url: process.env.STX_API_URL || "https://api.shanutechx.com/health",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "stx-web-portal",
    name: "STX Web Storefront & Docs",
    url: process.env.STX_WEB_URL || "https://shanutechx.com",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "stx-dashboard-app",
    name: "STX Control Panel Dashboard",
    url: process.env.STX_DASHBOARD_URL || "https://app.shanutechx.com",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "stx-webmail-client",
    name: "STX Enterprise Business Email",
    url: process.env.STX_WEBMAIL_URL || "https://webmail.shanutechx.com",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "stx-auth-sso",
    name: "STX Global OAuth Identity Gateway",
    url: "https://accounts.google.com",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "stx-git-engine",
    name: "STX Git Deployments Engine",
    url: "https://github.com",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "stx-cloud-gateway",
    name: "STX Anycast Cloud Gateway",
    url: "https://one.one.one.one",
    intervalSeconds,
    timeoutMs,
  },
];
