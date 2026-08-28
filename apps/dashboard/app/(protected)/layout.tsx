'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { AppUserProvider, useAppUser } from '@/lib/AppUserContext';
import Sidebar from '@/components/Sidebar';
import { NotificationChannelBanner } from '@/components/NotificationChannelBanner';
import { ToastProvider } from '@/components/ui';

function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 rounded-full border-2 border-white/10 border-t-accent-teal-bright animate-spin" />
        <span className="text-text-muted text-sm">{message}</span>
      </div>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome banner skeleton */}
      <div className="h-24 bg-white/[0.02] rounded-2xl border border-white/[0.04]" />
      
      {/* Stats grid skeleton */}
      <div className="grid md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white/[0.02] rounded-2xl border border-white/[0.04]" />
        ))}
      </div>
      
      {/* Content skeleton */}
      <div className="h-64 bg-white/[0.02] rounded-2xl border border-white/[0.04]" />
    </div>
  );
}

function GatedLayoutContent({ children, sidebarOpen, setSidebarOpen }: { children: React.ReactNode, sidebarOpen: boolean, setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const pathname = usePathname();
  const { apiUser, loading: apiUserLoading } = useAppUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (apiUserLoading || !apiUser || !mounted) return;

    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const parts = host.split('.');
    const subdomain = parts.length > 2 ? parts[0].toLowerCase() : '';

    const isDevSub = subdomain === 'dev';
    const isAdminSub = subdomain === 'admin';
    const isClientSub = subdomain === 'app' || subdomain === 'client';

    const userRole = apiUser.role;

    // Role-based route gating
    // /projects is dev-only
    if (userRole !== 'dev' && (pathname.startsWith('/projects') || pathname.startsWith('/admin/projects'))) {
      router.replace(userRole === 'customer' ? '/dashboard' : '/admin/review-queue');
      return;
    }

    if (userRole === 'customer') {
      // Customers cannot access /admin/*, /dev/*, or /settings routes
      if (pathname.startsWith('/admin') || pathname.startsWith('/dev') || pathname.startsWith('/settings')) {
        router.replace('/dashboard');
        return;
      }
    } else if (userRole === 'support') {
      // Support staff can access tickets, chat, and customer pages
      if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/tickets') && !pathname.startsWith('/admin/chat')) {
        router.replace('/admin/tickets');
        return;
      }
      if (pathname.startsWith('/dev') || pathname.startsWith('/settings')) {
        router.replace('/admin/tickets');
        return;
      }
    }
    // Dev and Admin roles have full access to all routes (admin, dev, catalog, storefront)
  }, [apiUser, apiUserLoading, pathname, router, mounted]);

  if (apiUserLoading || !apiUser) {
    return <LoadingSpinner message="Loading user context..." />;
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const parts = host.split('.');
  const subdomain = parts.length > 2 ? parts[0].toLowerCase() : '';

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.06] sticky top-0 z-40 bg-bg/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 rounded-lg bg-brand-gradient items-center justify-center shadow-glow-violet">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="font-semibold text-sm">
            {subdomain === 'admin' ? 'SHANUTECHX ADMIN' : subdomain === 'dev' ? 'SHANUTECHX DEV' : 'SHANUTECHX'}
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex flex-col gap-1.5 p-1"
          aria-label="Toggle sidebar"
        >
          <span className={`block h-0.5 w-5 bg-text-muted rounded transition-all ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block h-0.5 w-5 bg-text-muted rounded transition-all ${sidebarOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-text-muted rounded transition-all ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-screen max-w-[1400px] mx-auto">
        {/* Sidebar */}
        <div className={`
          fixed md:relative top-0 left-0 z-40 h-full transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        {/* Main content */}
        <main className="flex-1 py-6 px-4 md:px-6 min-w-0 animate-fade-in">
          <NotificationChannelBanner />
          <Suspense fallback={<DashboardSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <LoadingSpinner />;
  }

  return (
    <ToastProvider>
      <AppUserProvider>
        <GatedLayoutContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
          {children}
        </GatedLayoutContent>
      </AppUserProvider>
    </ToastProvider>
  );
}
