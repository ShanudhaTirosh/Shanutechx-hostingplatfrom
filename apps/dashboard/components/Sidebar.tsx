'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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


interface NavGroup {
  label: string;
  links: { href: string; label: string; icon: keyof typeof ICONS }[];
}

const CUSTOMER_GROUP: NavGroup = {
  label: 'Customer',
  links: [
    { href: '/dashboard', label: 'Overview', icon: 'overview' },
    { href: '/services', label: 'Services', icon: 'services' },
    { href: '/cart', label: 'Cart', icon: 'cart' },
    { href: '/orders', label: 'Orders & Invoices', icon: 'orders' },
    { href: '/billing', label: 'Subscriptions', icon: 'billing' },
    { href: '/deployments', label: 'Deployments', icon: 'deployments' },
    { href: '/email', label: 'Shared SMTP & Webmail', icon: 'smtp' },
    { href: '/vps', label: 'VPS', icon: 'vps' },
    { href: '/tickets', label: 'Support', icon: 'tickets' },
    { href: '/knowledgebase', label: 'Knowledge Base', icon: 'knowledgebase' },
    { href: '/catalog', label: 'App Catalog', icon: 'catalog' },
    { href: '/profile', label: 'Profile', icon: 'profile' },
  ],
};

const STAFF_GROUP: NavGroup = {
  label: 'Support',
  links: [
    { href: '/admin/tickets', label: 'Tickets', icon: 'tickets' },
    { href: '/admin/chat', label: 'Live Chat', icon: 'chat' },
  ],
};

const ADMIN_GROUP: NavGroup = {
  label: 'Admin',
  links: [
    { href: '/admin', label: 'Admin Dashboard', icon: 'overview' },
    { href: '/admin/review-queue', label: 'Payment Review', icon: 'review' },
    { href: '/admin/customers', label: 'Customers', icon: 'customers' },
    { href: '/admin/services', label: 'Products & Plans', icon: 'services' },
    { href: '/admin/email', label: 'Shared SMTP Manager', icon: 'smtp' },
    { href: '/admin/staff', label: 'Staff', icon: 'staff' },
    { href: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
    { href: '/admin/cms', label: 'Site Content', icon: 'cms' },
    { href: '/admin/audit-log', label: 'Audit Log', icon: 'audit' },
    { href: '/admin/knowledgebase', label: 'Knowledge Base Mgr', icon: 'knowledgebase' },
    { href: '/settings', label: 'Protected Settings', icon: 'settings' },
    { href: '/catalog', label: 'App Catalog', icon: 'catalog' },
  ],
};


const INFRA_GROUP: NavGroup = {
  label: 'Infrastructure',
  links: [
    { href: '/dev', label: 'Dev Dashboard', icon: 'infra' },
    { href: '/settings', label: 'Protected Settings', icon: 'settings' },
    { href: '/admin/projects', label: 'Projects & Supabase Stack', icon: 'projects' },
    { href: '/admin/nodes', label: 'Nodes Engine', icon: 'nodes' },
    { href: '/dev/containers', label: 'Containers', icon: 'containers' },
    { href: '/dev/reverse-proxy', label: 'Reverse Proxy', icon: 'proxy' },
    { href: '/dev/monitoring', label: 'Monitoring', icon: 'monitoring' },
    { href: '/dev/logs', label: 'Logs', icon: 'logs' },
    { href: '/admin/leaseweb', label: 'Leaseweb', icon: 'leaseweb' },
    { href: '/admin/databases', label: 'Databases', icon: 'databases' },
    { href: '/vps-plans', label: 'VPS Plans', icon: 'vps' },
  ],
};

function NavGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <div>
      <p className="px-3 mb-1 text-[10px] uppercase tracking-widest text-text-faint font-semibold">{group.label}</p>
      {group.links.map((link) => {
        const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all group relative ${
              active
                ? 'bg-white/[0.08] text-text-primary'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-brand-gradient" />
            )}
            <span className={active ? 'text-accent-violet-light' : 'text-text-faint group-hover:text-text-muted transition-colors'}>
              {ICONS[link.icon]}
            </span>
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { apiUser } = useAppUser();
  const [signingOut, setSigningOut] = useState(false);

  const isDev   = apiUser?.role === 'dev';
  const isAdmin  = apiUser?.role === 'admin';
  const isSupport = apiUser?.role === 'support';
  const isCustomer = apiUser?.role === 'customer';
  
  // Staff has access to support tools
  const isStaff = isAdmin || isSupport || isDev;
  
  // Infra has access to infrastructure tools
  const isInfra = isDev;
  
  // Admin has access to admin tools (but not dev/infra unless they're also dev)
  const hasAdminAccess = isAdmin || isDev;

  const initials = apiUser?.email
    ? apiUser.email.slice(0, 2).toUpperCase()
    : '??';

  async function handleSignOut() {
    setSigningOut(true);
    await signOut(firebaseAuth);
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col py-6 pr-4 gap-1 border-r border-white/[0.05] min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 mb-6">
        <span className="inline-flex h-7 w-7 rounded-lg bg-brand-gradient items-center justify-center shadow-glow-violet shrink-0">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </span>
        <span className="font-semibold text-sm text-text-primary">SHANUTECHX</span>
      </div>

      {/* Quick View Switcher for Dev and Admin Roles */}
      {(isDev || isAdmin) && (
        <div className="px-3 mb-4">
          {pathname.startsWith('/admin') || pathname.startsWith('/dev') ? (
            <Link
              href="/dashboard"
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-xl bg-accent-violet/10 text-accent-violet-light border border-accent-violet/20 hover:bg-accent-violet/20 transition-all shadow-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">🛒</span> Customer Storefront
              </span>
              <span>→</span>
            </Link>
          ) : (
            <Link
              href={isDev ? '/dev' : '/admin/review-queue'}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-xl bg-teal-500/10 text-teal-300 border border-teal-500/20 hover:bg-teal-500/20 transition-all shadow-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">⚙️</span> Control Panel
              </span>
              <span>→</span>
            </Link>
          )}
        </div>
      )}

      {/* Nav Groups */}
      <nav className="flex flex-col gap-5 flex-1 overflow-y-auto pr-1">
        {/* Dev users (system owner) see Infrastructure, Admin, Support, and Customer menus */}
        {isDev && (
          <>
            <NavGroup group={INFRA_GROUP} pathname={pathname} />
            <NavGroup group={ADMIN_GROUP} pathname={pathname} />
            <NavGroup group={STAFF_GROUP} pathname={pathname} />
            <NavGroup group={CUSTOMER_GROUP} pathname={pathname} />
          </>
        )}
        
        {/* Admin users see Admin, Support, and Customer menus */}
        {isAdmin && !isDev && (
          <>
            <NavGroup group={ADMIN_GROUP} pathname={pathname} />
            <NavGroup group={STAFF_GROUP} pathname={pathname} />
            <NavGroup group={CUSTOMER_GROUP} pathname={pathname} />
          </>
        )}
        
        {/* Support users see Staff and Customer menus */}
        {isSupport && !isAdmin && !isDev && (
          <>
            <NavGroup group={STAFF_GROUP} pathname={pathname} />
            <NavGroup group={CUSTOMER_GROUP} pathname={pathname} />
          </>
        )}
        
        {/* Customer users see customer menu */}
        {isCustomer && <NavGroup group={CUSTOMER_GROUP} pathname={pathname} />}
      </nav>

      {/* User Footer */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] px-3">
        {apiUser && (
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-primary font-medium truncate">{apiUser.email}</p>
              <p className="text-[10px] capitalize"
                style={{ color: apiUser.role === 'admin' ? '#f59e0b' : apiUser.role === 'dev' ? '#8b5cf6' : apiUser.role === 'support' ? '#06b6d4' : '#6b7280' }}
              >
                {apiUser.role}
              </p>
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
