"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, ReactNode } from "react";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebaseClient";
import { useAppUser } from "@/lib/AppUserContext";
import { ThemeToggle } from "@/components/ThemeProvider";

// ── Icon primitive ───────────────────────────────────────────────────────────
function Icon({
  d,
  viewBox = "0 0 24 24",
  size = 15,
}: {
  d: string | ReactNode;
  viewBox?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {typeof d === "string" ? <path d={d} /> : d}
    </svg>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${className}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Icon Registry ────────────────────────────────────────────────────────────
const ICONS: Record<string, ReactNode> = {
  overview:     <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  services:     <Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  cart:         <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  orders:       <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  billing:      <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  deployments:  <Icon d="M5 12h14M12 5l7 7-7 7" />,
  smtp:         <Icon d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  livekit:      <Icon d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.899L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
  vps:          <Icon d="M5 12h2l2-8 2 16 2-10 2 6 1-4h3" />,
  tickets:      <Icon d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />,
  developer:    <Icon d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
  profile:      <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  chat:         <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  review:       <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  customers:    <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
  staff:        <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  analytics:    <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  cms:          <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  audit:        <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  infra:        <Icon d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />,
  webhooks:     <Icon d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />,
  containers:   <Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />,
  proxy:        <Icon d="M4 4h6v6H4V4zm10 10h6v6h-6v-6zM7 10v4a3 3 0 003 3h4m0-10h-4a3 3 0 00-3 3" />,
  monitoring:   <Icon d="M3 12h4l3 8 4-16 3 8h4" />,
  logs:         <Icon d="M4 6h16M4 12h16M4 18h10" />,
  nodes:        <Icon d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />,
  leaseweb:     <Icon d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />,
  databases:    <Icon d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />,
  projects:     <Icon d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 1.66-3.582 3-8 3" />,
  catalog:      <Icon d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />,
  knowledgebase:<Icon d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  settings:     <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />,
  bots:         <Icon d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2zM4 11a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7zm5 3h.01M15 14h.01" />,
};

export interface SidebarSubLink {
  href: string;
  label: string;
  icon?: keyof typeof ICONS;
}

export interface SidebarLink {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  children?: SidebarSubLink[];
}

export interface DashboardConfig {
  role: 'customer' | 'admin' | 'dev' | 'support';
  title: string;
  badge: string;
  badgeStyle: { color: string; bg: string; border: string };
  defaultHref: string;
  links: SidebarLink[];
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. CUSTOMER DASHBOARD SIDEBAR CONFIG
// ═════════════════════════════════════════════════════════════════════════════
export const CUSTOMER_DASHBOARD: DashboardConfig = {
  role: 'customer',
  title: 'CUSTOMER PORTAL',
  badge: 'CLIENT',
  badgeStyle: {
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
    border: 'var(--color-success-border)',
  },
  defaultHref: '/dashboard',
  links: [
    { href: '/dashboard',            label: 'Overview',               icon: 'overview' },
    { href: '/services',             label: 'Services & Products',    icon: 'services' },
    { href: '/orders?tab=cart',      label: 'Shopping Cart',          icon: 'cart' },
    { href: '/orders?tab=subscriptions', label: 'Subscriptions',     icon: 'billing' },
    { href: '/deployments',          label: 'Deployments',            icon: 'deployments' },
    { href: '/email',                label: 'Business Email',         icon: 'smtp' },
    { href: '/vps',                  label: 'VPS Instances',          icon: 'vps' },
    { href: '/tickets',              label: 'Support Tickets',        icon: 'tickets' },
    { href: '/knowledgebase',        label: 'Knowledge Base',         icon: 'knowledgebase' },
    { href: '/catalog',              label: 'App Catalog',            icon: 'catalog' },
    { href: '/profile',              label: 'Account Profile',        icon: 'profile' },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. ADMIN DASHBOARD SIDEBAR CONFIG
// ═════════════════════════════════════════════════════════════════════════════
export const ADMIN_DASHBOARD: DashboardConfig = {
  role: 'admin',
  title: 'ADMIN CONTROL PANEL',
  badge: 'ADMIN',
  badgeStyle: {
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
    border: 'var(--color-warning-border)',
  },
  defaultHref: '/admin',
  links: [
    { href: '/admin',                label: 'Admin Overview',         icon: 'overview' },
    { href: '/admin/bots',           label: 'Bot Studio',             icon: 'bots' },
    { href: '/admin/observability',  label: 'Observability',          icon: 'monitoring' },
    { href: '/admin/vps-plans',      label: 'VPS Plans & Pricing',    icon: 'vps' },
    { href: '/admin/vps',            label: 'Global VPS Fleet',       icon: 'vps' },
    { href: '/admin/review-queue',   label: 'Payment Review',         icon: 'review' },
    { href: '/admin/customers',      label: 'Customers Directory',    icon: 'customers' },
    { href: '/admin/services',       label: 'Products & Catalog',     icon: 'services' },
    { href: '/admin/email',          label: 'Business Email Host',    icon: 'smtp' },
    { href: '/admin/staff',          label: 'Staff Directory',        icon: 'staff' },
    { href: '/admin/analytics',      label: 'Platform Analytics',     icon: 'analytics' },
    { href: '/admin/cms',            label: 'Site Content (CMS)',     icon: 'cms' },
    { href: '/admin/audit-log',      label: 'Audit Log',              icon: 'audit' },
    { href: '/admin/knowledgebase',  label: 'Knowledge Base Mgr',     icon: 'knowledgebase' },
    { href: '/admin/catalog',        label: 'Catalog Manager',        icon: 'catalog' },
    { href: '/settings',             label: 'Platform Settings',      icon: 'settings' },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. DEV STUDIO DASHBOARD SIDEBAR CONFIG
// ═════════════════════════════════════════════════════════════════════════════
export const DEV_DASHBOARD: DashboardConfig = {
  role: 'dev',
  title: 'DEV STUDIO HUB',
  badge: 'DEV',
  badgeStyle: {
    color: 'var(--color-accent)',
    bg: 'var(--color-accent-subtle)',
    border: 'var(--color-accent-border)',
  },
  defaultHref: '/dev',
  links: [
    { href: '/dev',                  label: 'Dev Studio Overview',    icon: 'infra' },
    { href: '/dev/deploy',           label: 'Deploy Pipeline',        icon: 'deployments' },
    { href: '/dev/projects',         label: 'Projects & Managed DBs', icon: 'projects' },
    {
      href: '/dev/containers',
      label: 'Containers & Docker',
      icon: 'containers',
      children: [
        { href: '/dev/containers?tab=containers', label: 'Containers Hub',         icon: 'containers' },
        { href: '/dev/containers?tab=nodes',      label: 'Compute Host Nodes',     icon: 'nodes' },
        { href: '/admin/vps',                     label: 'Global VPS Fleet',       icon: 'vps' },
        { href: '/dev/containers?tab=images',     label: 'Docker Images',          icon: 'containers' },
        { href: '/dev/containers?tab=volumes',    label: 'Docker Volumes',         icon: 'containers' },
        { href: '/dev/containers?tab=networks',   label: 'Docker Networks',        icon: 'proxy' },
        { href: '/dev/containers?tab=system',     label: 'Docker System & Engine', icon: 'infra' },
      ],
    },
    { href: '/dev/reverse-proxy',    label: 'Reverse Proxy',          icon: 'proxy' },
    { href: '/dev/ports',            label: 'Exposed Node Ports',     icon: 'proxy' },
    { href: '/dev/monitoring',       label: 'System Monitoring',      icon: 'monitoring' },
    { href: '/dev/logs',             label: 'Platform Telemetry Logs',icon: 'logs' },
    { href: '/admin/vps-plans',      label: 'VPS Plans & Pricing',    icon: 'vps' },
    { href: '/dev/catalog',          label: 'Catalog Inspector',      icon: 'catalog' },
    { href: '/dev/docs',             label: 'Dev & API Docs',         icon: 'knowledgebase' },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. SUPPORT OPERATIONS DASHBOARD SIDEBAR CONFIG
// ═════════════════════════════════════════════════════════════════════════════
export const SUPPORT_DASHBOARD: DashboardConfig = {
  role: 'support',
  title: 'SUPPORT OPERATIONS',
  badge: 'SUPPORT',
  badgeStyle: {
    color: 'var(--color-info)',
    bg: 'var(--color-info-bg)',
    border: 'var(--color-info-border)',
  },
  defaultHref: '/support',
  links: [
    { href: '/support',              label: 'Support Dashboard',      icon: 'overview' },
    { href: '/admin/tickets',        label: 'Ticket Queue',           icon: 'tickets' },
    { href: '/admin/chat',           label: 'Live Customer Chat',     icon: 'chat' },
    { href: '/support/kb',           label: 'Support Runbooks',       icon: 'knowledgebase' },
    { href: '/admin/customers',      label: 'Customer Directory',     icon: 'customers' },
  ],
};

function isSidebarLinkActive(
  linkHref: string,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
): boolean {
  const [linkPath, linkQuery] = linkHref.split("?");
  const linkParams = new URLSearchParams(linkQuery || "");
  const activeTabParam = searchParams.get("tab");

  if (linkQuery && linkParams.has("tab")) {
    const targetTab = linkParams.get("tab");
    if (pathname === linkPath) {
      if (activeTabParam === targetTab) return true;
      if (!activeTabParam && (targetTab === "containers" || targetTab === "overview")) return true;
    }
    return false;
  }
  if (linkPath === "/cart" || (linkPath === "/orders" && linkParams.get("tab") === "cart")) {
    if (pathname === "/cart") return true;
    if (pathname === "/orders" && activeTabParam === "cart") return true;
    return false;
  }
  if (linkPath === "/billing" || (linkPath === "/orders" && (!linkParams.has("tab") || linkParams.get("tab") !== "cart"))) {
    if (pathname === "/billing") return true;
    if (pathname === "/orders" && activeTabParam !== "cart") return true;
    return false;
  }
  if (linkHref === "/dashboard" || linkHref === "/admin" || linkHref === "/dev" || linkHref === "/support") {
    return pathname === linkHref;
  }
  return pathname === linkPath || pathname.startsWith(linkPath);
}

// ── Generic Sidebar View Component ──────────────────────────────────────────
export function DashboardSidebarView({
  config,
  onNavigate,
}: {
  config: DashboardConfig;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apiUser, switchRole } = useAppUser();
  const [signingOut, setSigningOut] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  function toggleDropdown(href: string) {
    setOpenDropdowns((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  const initials = apiUser?.email ? apiUser.email.slice(0, 2).toUpperCase() : "??";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut(firebaseAuth);
  }

  // Dashboard role quick switcher for admins / devs / support staff
  const userRole = apiUser?.role || 'customer';
  const canAccessAdmin = userRole === 'admin' || userRole === 'dev';
  const canAccessDev = userRole === 'dev' || userRole === 'admin';
  const canAccessSupport = userRole === 'support' || userRole === 'admin' || userRole === 'dev';

  return (
    <aside className="stx-sidebar w-[var(--sidebar-width)] shrink-0 flex flex-col h-screen overflow-y-auto">
      {/* ── Brand Header ── */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[var(--color-border-subtle)] shrink-0">
        <div className="h-7 w-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center shrink-0">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="font-semibold text-[13.5px] tracking-tight text-[var(--color-text-primary)]">
          STX <span className="text-[var(--color-accent)]">HOSTING</span>
        </span>
      </div>

      {/* ── Role Dashboard Badge Header ── */}
      <div className="px-5 pt-4 pb-2 shrink-0 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-faint)]">
            {config.title}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
            style={{
              color: config.badgeStyle.color,
              background: config.badgeStyle.bg,
              borderColor: config.badgeStyle.border,
            }}
          >
            {config.badge}
          </span>
        </div>
      </div>

      {/* ── Navigation Links ── */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto px-3 py-3">
        {config.links.map((link) => {
          const hasChildren = Boolean(link.children?.length);
          const isChildActive = hasChildren && link.children!.some(c => isSidebarLinkActive(c.href, pathname, searchParams));
          const isActive = isSidebarLinkActive(link.href, pathname, searchParams) || isChildActive;
          const isOpen = openDropdowns[link.href] !== undefined ? openDropdowns[link.href] : isActive;

          if (hasChildren) {
            return (
              <div key={link.href} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleDropdown(link.href)}
                  className={`stx-nav-link w-full justify-between focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${isActive ? 'active' : ''}`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-current opacity-70">{ICONS[link.icon]}</span>
                    <span className="truncate text-[13.5px]">{link.label}</span>
                  </div>
                  <ChevronDown className={isOpen ? 'rotate-180' : ''} />
                </button>
                {isOpen && (
                  <div className="ml-4 pl-3 mt-0.5 mb-0.5 flex flex-col gap-0.5 border-l border-[var(--color-border-subtle)]">
                    {link.children!.map((child) => {
                      const childActive = isSidebarLinkActive(child.href, pathname, searchParams);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => onNavigate?.()}
                          className={`stx-nav-link text-[12.5px] py-1.5 ${childActive ? 'active' : ''}`}
                        >
                          <span className="text-current opacity-60 shrink-0">
                            {child.icon ? ICONS[child.icon] : (
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 inline-block" />
                            )}
                          </span>
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => onNavigate?.()}
              className={`stx-nav-link focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${isActive ? 'active' : ''}`}
            >
              <span className="text-current opacity-70 shrink-0">{ICONS[link.icon]}</span>
              <span className="truncate text-[13.5px]">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer: Dashboard Switcher + User Info + Sign Out ── */}
      <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 shrink-0 space-y-2.5">
        {/* Quick Dashboard Switcher (if staff/dev) */}
        {(canAccessAdmin || canAccessSupport) && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)]">
            <span className="text-[10px] font-semibold text-[var(--color-text-faint)] px-1 uppercase">Go To:</span>
            <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
              <Link
                href="/dashboard"
                onClick={() => onNavigate?.()}
                className={`text-[10.5px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                  config.role === 'customer'
                    ? 'bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Client
              </Link>
              {canAccessSupport && (
                <Link
                  href="/support"
                  onClick={() => onNavigate?.()}
                  className={`text-[10.5px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                    config.role === 'support'
                      ? 'bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Support
                </Link>
              )}
              {canAccessAdmin && (
                <Link
                  href="/admin"
                  onClick={() => onNavigate?.()}
                  className={`text-[10.5px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                    config.role === 'admin'
                      ? 'bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Admin
                </Link>
              )}
              {canAccessDev && (
                <Link
                  href="/dev"
                  onClick={() => onNavigate?.()}
                  className={`text-[10.5px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                    config.role === 'dev'
                      ? 'bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Dev
                </Link>
              )}
            </div>
          </div>
        )}

        {/* User Info */}
        {apiUser && (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-[var(--color-text-primary)] font-medium truncate">
                {apiUser.email}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {apiUser.role === "dev" ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)] bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)] rounded px-1.5 py-0.5">
                    Dev · Superuser
                  </span>
                ) : userRole === "admin" ? (
                  <select
                    value={apiUser.role}
                    onChange={async (e) => {
                      try { await switchRole(e.target.value as any); } catch {}
                    }}
                    className="text-[10px] capitalize font-semibold bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--color-text-muted)] rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="admin">Admin Account</option>
                    <option value="support">Support Account</option>
                    <option value="customer">Customer Account</option>
                  </select>
                ) : (
                  <span className="text-[10px] capitalize font-medium text-[var(--color-text-muted)]">
                    {apiUser.role}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors disabled:opacity-40"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTED DEDICATED SIDEBAR COMPONENTS FOR EACH DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
export function CustomerSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <DashboardSidebarView config={CUSTOMER_DASHBOARD} onNavigate={onNavigate} />;
}

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <DashboardSidebarView config={ADMIN_DASHBOARD} onNavigate={onNavigate} />;
}

export function DevSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <DashboardSidebarView config={DEV_DASHBOARD} onNavigate={onNavigate} />;
}

export function SupportSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <DashboardSidebarView config={SUPPORT_DASHBOARD} onNavigate={onNavigate} />;
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTO-DETECT SIDEBAR (Default export: automatically renders correct sidebar)
// ═════════════════════════════════════════════════════════════════════════════
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={null}>
      <AutoSidebarContent onNavigate={onNavigate} />
    </Suspense>
  );
}

function AutoSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { apiUser } = useAppUser();

  // Determine dashboard sidebar strictly based on current route & user access
  if (
    pathname.startsWith("/dev") ||
    pathname.startsWith("/admin/projects") ||
    pathname.startsWith("/admin/nodes") ||
    pathname.startsWith("/admin/databases") ||
    pathname.startsWith("/vps-plans")
  ) {
    return <DevSidebar onNavigate={onNavigate} />;
  }

  if (pathname.startsWith("/support") || (pathname.startsWith("/admin/tickets") && apiUser?.role === "support")) {
    return <SupportSidebar onNavigate={onNavigate} />;
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/settings")) {
    return <AdminSidebar onNavigate={onNavigate} />;
  }

  return <CustomerSidebar onNavigate={onNavigate} />;
}
