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
  const { apiUser, loading: apiUserLoading, error: userError, refetchUser } = useAppUser();
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
    } else if (userRole === 'admin') {
      // Admin role cannot access dev infrastructure routes (/dev/*)
      if (pathname.startsWith('/dev')) {
        router.replace('/admin/review-queue');
        return;
      }
    }
    // Dev role (system owner) has full access to all routes
  }, [apiUser, apiUserLoading, pathname, router, mounted]);

  if (apiUserLoading) {
    return <LoadingSpinner message="Loading user context..." />;
  }

  if (userError && !apiUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="max-w-md w-full p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-center space-y-4 shadow-2xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Unable to load user context</h2>
          <p className="text-sm text-text-muted">{userError}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => refetchUser()}
              className="px-4 py-2 rounded-xl bg-accent-teal text-black font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('shanutechx_user_cache');
                  localStorage.removeItem('shanutechx_user_cache_ts');
                  window.location.href = '/login';
                }
              }}
              className="px-4 py-2 rounded-xl bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition-colors"
            >
              Sign in again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!apiUser) {
    return <LoadingSpinner message="Redirecting to login..." />;
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const parts = host.split('.');
  const subdomain = parts.length > 2 ? parts[0].toLowerCase() : '';

    const isDevRoute = pathname.startsWith('/dev') || pathname.startsWith('/admin/projects') || pathname.startsWith('/admin/nodes');
    const isSupportRoute = pathname.startsWith('/admin/tickets') || pathname.startsWith('/admin/chat');
    const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/settings');

    const panelTitle = isDevRoute
      ? 'STX DEV INFRASTRUCTURE'
      : isSupportRoute
      ? 'STX SUPPORT GATEWAY'
      : isAdminRoute
      ? 'STX ADMIN PANEL'
      : 'STX CUSTOMER STOREFRONT';

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
            <span className="font-semibold text-sm tracking-tight text-white">
              {panelTitle}
            </span>
          </div>
        <div className="flex items-center gap-2">
          <DevRightClickToggle />
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
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <div className={`
          fixed md:sticky top-0 left-0 z-40 h-screen transition-transform duration-300
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

import { RightClickProtector, DevRightClickToggle } from '@/components/RightClickProtector';

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
        <RightClickProtector>
          <GatedLayoutContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
            {children}
          </GatedLayoutContent>
        </RightClickProtector>
      </AppUserProvider>
    </ToastProvider>
  );
}
