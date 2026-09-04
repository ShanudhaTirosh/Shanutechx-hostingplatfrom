'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebaseClient';
import { useAppUser } from '@/lib/AppUserContext';

// ── Icons (inline SVG, no deps) ─────────────────────────────────────────────
function Icon({ d, viewBox = '0 0 24 24' }: { d: string | React.ReactNode; viewBox?: string }) {
  return (
    <svg width="16" height="16" viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  overview: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  services: <Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  cart: <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  orders: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  billing: <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  deployments: <Icon d="M5 12h14M12 5l7 7-7 7" />,
  smtp: <Icon d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  livekit: <Icon d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.899L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
  vps: <Icon d="M5 12h2l2-8 2 16 2-10 2 6 1-4h3" />,
  tickets: <Icon d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />,
  developer: <Icon d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
  profile: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  // Staff/Admin
  chat: <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  review: <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  customers: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
  staff: <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  analytics: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  cms: <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  audit: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  // Infra
  infra: <Icon d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />,
  webhooks: <Icon d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />,
  containers: <Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />,
  proxy: <Icon d="M4 4h6v6H4V4zm10 10h6v6h-6v-6zM7 10v4a3 3 0 003 3h4m0-10h-4a3 3 0 00-3 3" />,
  monitoring: <Icon d="M3 12h4l3 8 4-16 3 8h4" />,
  logs: <Icon d="M4 6h16M4 12h16M4 18h10" />,
  nodes: <Icon d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />,
  leaseweb: <Icon d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />,
  databases: <Icon d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />,
  projects: <Icon d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 1.66-3.582 3-8 3" />,
  catalog: <Icon d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />,
  knowledgebase: <Icon d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  settings: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />,
};

type SpaceKey = 'customer' | 'admin' | 'dev' | 'support';

interface PanelSpace {
  key: SpaceKey;
  label: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  defaultHref: string;
  links: { href: string; label: string; icon: keyof typeof ICONS }[];
}

const SPACE_ICONS: Record<SpaceKey, React.ReactNode> = {
  customer: <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  admin: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />,
  dev: <Icon d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />,
  support: <Icon d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />,
};

const SPACES: Record<SpaceKey, PanelSpace> = {
  customer: {
    key: 'customer',
    label: 'Customer Storefront',
    badge: 'Client',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
    badgeText: 'text-emerald-400',
    defaultHref: '/dashboard',
    links: [
      { href: '/dashboard', label: 'Overview', icon: 'overview' },
      { href: '/services', label: 'Services', icon: 'services' },
      { href: '/orders?tab=cart', label: 'Shopping Cart', icon: 'cart' },
      { href: '/orders?tab=subscriptions', label: 'Subscriptions & Invoices', icon: 'billing' },
      { href: '/deployments', label: 'Deployments', icon: 'deployments' },
      { href: '/email', label: 'Business Email & Webmail', icon: 'smtp' },
      { href: '/vps', label: 'VPS', icon: 'vps' },
      { href: '/tickets', label: 'Support', icon: 'tickets' },
      { href: '/knowledgebase', label: 'Knowledge Base', icon: 'knowledgebase' },
      { href: '/catalog', label: 'App Catalog', icon: 'catalog' },
      { href: '/profile', label: 'Profile', icon: 'profile' },
    ],
  },
  admin: {
    key: 'admin',
    label: 'Admin Control Panel',
    badge: 'Admin',
    badgeBg: 'bg-amber-500/10 border-amber-500/20',
    badgeText: 'text-amber-400',
    defaultHref: '/admin',
    links: [
      { href: '/admin', label: 'Admin Dashboard', icon: 'overview' },
      { href: '/admin/vps', label: 'Global VPS Fleet', icon: 'vps' },
      { href: '/admin/review-queue', label: 'Payment Review', icon: 'review' },
      { href: '/admin/customers', label: 'Customers', icon: 'customers' },
      { href: '/admin/services', label: 'Products & Plans', icon: 'services' },
      { href: '/admin/email', label: 'Business Email & Host', icon: 'smtp' },
      { href: '/admin/staff', label: 'Staff Directory', icon: 'staff' },
      { href: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
      { href: '/admin/cms', label: 'Site Content', icon: 'cms' },
      { href: '/admin/audit-log', label: 'Audit Log', icon: 'audit' },
      { href: '/admin/knowledgebase', label: 'Knowledge Base Mgr', icon: 'knowledgebase' },
      { href: '/settings', label: 'Protected Settings', icon: 'settings' },
      { href: '/catalog', label: 'App Catalog', icon: 'catalog' },
    ],
  },
  dev: {
    key: 'dev',
    label: 'Dev & Infrastructure',
    badge: 'Dev',
    badgeBg: 'bg-violet-500/10 border-violet-500/20',
    badgeText: 'text-violet-300',
    defaultHref: '/dev',
    links: [
      { href: '/dev', label: 'Dev Dashboard', icon: 'infra' },
      { href: '/admin/nodes', label: 'Compute Nodes', icon: 'nodes' },
      { href: '/admin/vps', label: 'Global VPS Fleet', icon: 'vps' },
      { href: '/admin/projects', label: 'Projects & Supabase Stack', icon: 'projects' },
      { href: '/dev/containers', label: 'Containers', icon: 'containers' },
      { href: '/dev/reverse-proxy', label: 'Reverse Proxy', icon: 'proxy' },
      { href: '/dev/monitoring', label: 'Monitoring', icon: 'monitoring' },
      { href: '/dev/logs', label: 'Logs', icon: 'logs' },
      { href: '/admin/databases', label: 'Databases', icon: 'databases' },
      { href: '/vps-plans', label: 'VPS Plans', icon: 'vps' },
      { href: '/catalog', label: 'App Catalog', icon: 'catalog' },
      { href: '/admin/review-queue', label: 'Payment Review', icon: 'review' },
      { href: '/admin/customers', label: 'Customers', icon: 'customers' },
      { href: '/admin/staff', label: 'Staff Directory', icon: 'staff' },
      { href: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
      { href: '/admin/cms', label: 'Site Content', icon: 'cms' },
      { href: '/admin/audit-log', label: 'Audit Log', icon: 'audit' },
      { href: '/settings', label: 'Protected Settings', icon: 'settings' },
    ],
  },
  support: {
    key: 'support',
    label: 'Support Operations',
    badge: 'Support',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/20',
    badgeText: 'text-cyan-300',
    defaultHref: '/support',
    links: [
      { href: '/support', label: 'Support Operations', icon: 'overview' },
      { href: '/admin/tickets', label: 'Ticket Queue', icon: 'tickets' },
      { href: '/admin/chat', label: 'Live Support Chat', icon: 'chat' },
      { href: '/knowledgebase', label: 'Knowledge Base', icon: 'knowledgebase' },
    ],
  },
};

function isPathInSpace(pathname: string, spaceKey: SpaceKey): boolean {
  const space = SPACES[spaceKey];
  if (!space) return false;
  return space.links.some((link) => {
    const [linkPath] = link.href.split('?');
    return (
      pathname === linkPath ||
      (linkPath !== '/dashboard' &&
        linkPath !== '/admin' &&
        linkPath !== '/dev' &&
        linkPath !== '/support' &&
        pathname.startsWith(linkPath))
    );
  });
}

function getSpaceFromPathname(pathname: string): SpaceKey {
  if (
    pathname.startsWith('/dev') ||
    pathname.startsWith('/admin/projects') ||
    pathname.startsWith('/admin/nodes') ||
    pathname.startsWith('/admin/databases') ||
    pathname.startsWith('/vps-plans')
  ) {
    return 'dev';
  }
  if (pathname.startsWith('/support') || pathname.startsWith('/admin/tickets') || pathname.startsWith('/admin/chat')) {
    return 'support';
  }
  if (pathname.startsWith('/admin') || pathname.startsWith('/settings')) {
    return 'admin';
  }
  return 'customer';
}

function isSidebarLinkActive(
  linkHref: string,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>
): boolean {
  const [linkPath, linkQuery] = linkHref.split('?');
  const linkParams = new URLSearchParams(linkQuery || '');
  const activeTabParam = searchParams.get('tab');

  // Shopping Cart link matching (/cart or /orders?tab=cart)
  if (linkPath === '/cart' || (linkPath === '/orders' && linkParams.get('tab') === 'cart')) {
    if (pathname === '/cart') return true;
    if (pathname === '/orders' && activeTabParam === 'cart') return true;
    return false;
  }

  // Subscriptions & Invoices link matching (/billing or /orders?tab=subscriptions)
  if (
    linkPath === '/billing' ||
    (linkPath === '/orders' && (!linkParams.has('tab') || linkParams.get('tab') !== 'cart'))
  ) {
    if (pathname === '/billing') return true;
    if (pathname === '/orders' && activeTabParam !== 'cart') return true;
    return false;
  }

  // Base root spaces matching
  if (linkHref === '/dashboard' || linkHref === '/admin' || linkHref === '/dev') {
    return pathname === linkHref;
  }

  return pathname === linkPath || pathname.startsWith(linkPath);
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={null}>
      <SidebarContent onNavigate={onNavigate} />
    </Suspense>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apiUser, loading, switchRole } = useAppUser();
  const [signingOut, setSigningOut] = useState(false);

  const isDev = apiUser?.role === 'dev';
  const isAdmin = apiUser?.role === 'admin';
  const isSupport = apiUser?.role === 'support';
  const isCustomer = apiUser?.role === 'customer';

  // Determine allowed spaces based strictly on user role (while loading, retain full spaces)
  const allowedSpaces: SpaceKey[] = [];
  if (loading || !apiUser || isDev || isAdmin) {
    allowedSpaces.push('admin', 'dev', 'support', 'customer');
  } else if (isSupport) {
    allowedSpaces.push('support', 'customer');
  } else {
    allowedSpaces.push('customer');
  }

  // Detect active space from pathname, falling back to first allowed space or saved space
  const [selectedSpace, setSelectedSpace] = useState<SpaceKey>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('shanutechx_active_space') as SpaceKey;
        if (saved && allowedSpaces.includes(saved) && isPathInSpace(pathname, saved)) {
          return saved;
        }
      } catch {}
    }
    const detected = getSpaceFromPathname(pathname);
    return allowedSpaces.includes(detected) ? detected : allowedSpaces[0] || 'customer';
  });

  // Keep selected space synced with pathname only if pathname leaves current space
  useEffect(() => {
    if (loading || !apiUser) return;

    if (isPathInSpace(pathname, selectedSpace) && allowedSpaces.includes(selectedSpace)) {
      return;
    }
    const spaceForPath = getSpaceFromPathname(pathname);
    if (allowedSpaces.includes(spaceForPath)) {
      setSelectedSpace(spaceForPath);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('shanutechx_active_space', spaceForPath); } catch {}
      }
    } else if (!allowedSpaces.includes(selectedSpace)) {
      const fallback = allowedSpaces[0] || 'customer';
      setSelectedSpace(fallback);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('shanutechx_active_space', fallback); } catch {}
      }
    }
  }, [pathname, loading, apiUser, isDev, isAdmin, isSupport, selectedSpace]);

  const activePanel = SPACES[selectedSpace] || SPACES.customer;

  function handleSpaceSwitch(spaceKey: SpaceKey) {
    if (!allowedSpaces.includes(spaceKey)) return;
    setSelectedSpace(spaceKey);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('shanutechx_active_space', spaceKey); } catch {}
    }
    const spaceObj = SPACES[spaceKey];
    if (!isPathInSpace(pathname, spaceKey) && spaceObj) {
      router.push(spaceObj.defaultHref);
    }
  }

  const initials = apiUser?.email
    ? apiUser.email.slice(0, 2).toUpperCase()
    : '??';

  async function handleSignOut() {
    setSigningOut(true);
    await signOut(firebaseAuth);
  }

  return (
    <aside className="w-72 md:w-64 lg:w-72 shrink-0 flex flex-col py-6 px-3.5 gap-1 border-r border-white/[0.05] h-screen overflow-y-auto bg-bg">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-3 mb-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/STX.png"
            alt="STX HOSTING Logo"
            className="w-6 h-6 max-w-[24px] max-h-[24px] shrink-0 rounded-md object-contain shadow-glow-violet"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <span className="font-extrabold text-sm tracking-tight text-white">
            STX <span className="text-accent-teal">HOSTING</span>
          </span>
        </div>
      </div>

      {/* Dynamic Panel Switcher Tabs (Only shown for staff with >1 allowed space) */}
      {allowedSpaces.length > 1 && (
        <div className="px-1 mb-5">
          <p className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-text-faint font-semibold">
            PANEL SPACES
          </p>
          <div className={`grid gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl ${
            allowedSpaces.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
          }`}>
            {allowedSpaces.map((spaceKey) => {
              const space = SPACES[spaceKey];
              const isActive = selectedSpace === spaceKey;
              return (
                <button
                  key={spaceKey}
                  onClick={() => handleSpaceSwitch(spaceKey)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all border ${
                    isActive
                      ? `${space.badgeBg} ${space.badgeText} shadow-sm font-bold border-white/10`
                      : 'text-text-muted hover:text-white border-transparent hover:bg-white/[0.04]'
                  }`}
                  title={space.label}
                >
                  <span className={isActive ? space.badgeText : 'text-text-faint'}>
                    {SPACE_ICONS[spaceKey]}
                  </span>
                  <span className="truncate text-[11px]">{space.badge}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Panel Category Header */}
      <div className="px-3 mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-faint">
          {activePanel.label}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${activePanel.badgeBg} ${activePanel.badgeText}`}>
          {activePanel.badge}
        </span>
      </div>

      {/* Active Panel Navigation Links */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
        {activePanel.links.map((link) => {
          const active = isSidebarLinkActive(link.href, pathname, searchParams);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all group relative ${
                active
                  ? 'bg-white/[0.08] text-text-primary font-medium shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-brand-gradient" />
              )}
              <span className={active ? 'text-accent-teal-bright' : 'text-text-faint group-hover:text-text-muted transition-colors'}>
                {ICONS[link.icon]}
              </span>
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] px-3">
        {apiUser && (
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-glow-teal">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-primary font-medium truncate">{apiUser.email}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {apiUser.role === 'dev' ? (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider bg-accent-violet/20 text-accent-violet-light border border-accent-violet/30 rounded px-2 py-0.5 inline-flex items-center gap-1"
                    title="Developer accounts cannot be demoted"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Dev Account (Protected)
                  </span>
                ) : (
                  <select
                    value={apiUser.role}
                    onChange={async (e) => {
                      const newRole = e.target.value as any;
                      try {
                        await switchRole(newRole);
                      } catch {}
                    }}
                    className="text-[10px] capitalize font-semibold tracking-wide bg-white/5 border border-white/10 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:border-accent-teal"
                    style={{
                      color:
                        apiUser.role === 'admin'
                          ? '#f59e0b'
                          : apiUser.role === 'support'
                          ? '#06b6d4'
                          : '#10b981',
                    }}
                  >
                    <option value="admin" className="bg-[#0a0a14] text-amber-400">Admin Account</option>
                    <option value="support" className="bg-[#0a0a14] text-cyan-400">Support Account</option>
                    <option value="customer" className="bg-[#0a0a14] text-emerald-400">Customer Account</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-red-400 transition-colors group"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
