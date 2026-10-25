'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { AppUserProvider, useAppUser } from '@/lib/AppUserContext';
import Sidebar from '@/components/Sidebar';
import { NotificationChannelBanner } from '@/components/NotificationChannelBanner';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { ToastProvider } from '@/components/ui';
import { RightClickProtector, DevRightClickToggle } from '@/components/RightClickProtector';
import { ThemeProvider, ThemeToggle } from '@/components/ThemeProvider';

// ── Loading spinner ─────────────────────────────────────────────────────────
function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-9 w-9 rounded-full border-2 border-t-transparent animate-spin"
          style={{
            borderColor: 'var(--color-border)',
            borderTopColor: 'var(--color-accent)',
          }}
        />
        <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{message}</span>
      </div>
    </div>
  );
}

// ── Page skeleton for Suspense fallback ─────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="skeleton-shimmer h-24 rounded-xl" />
      <div className="grid md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton-shimmer h-24 rounded-xl" />
        ))}
      </div>
      <div className="skeleton-shimmer h-64 rounded-xl" />
    </div>
  );
}

// ── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="max-w-sm w-full p-6 rounded-2xl text-center space-y-4"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl mx-auto"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Unable to load user context
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
        <div className="flex justify-center gap-3 pt-1">
          <button
            onClick={onRetry}
            className="stx-btn stx-btn-primary px-4 py-2 text-sm"
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
            className="stx-btn stx-btn-secondary px-4 py-2 text-sm"
          >
            Sign in again
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main gated layout ────────────────────────────────────────────────────────
function GatedLayoutContent({
  children,
  sidebarOpen,
  setSidebarOpen,
}: {
  children: React.ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const pathname = usePathname();
  const { apiUser, loading: apiUserLoading, error: userError, refetchUser } = useAppUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (apiUserLoading || !apiUser || !mounted) return;

    const userRole = apiUser.role;

    if (userRole === 'customer') {
      if (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/dev') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/projects')
      ) {
        router.replace('/dashboard');
        return;
      }
    } else if (userRole === 'support') {
      if (
        pathname.startsWith('/admin') &&
        !pathname.startsWith('/admin/tickets') &&
        !pathname.startsWith('/admin/chat') &&
        !pathname.startsWith('/admin/customers')
      ) {
        router.replace('/support');
        return;
      }
      if (pathname.startsWith('/dev') || pathname.startsWith('/settings') || pathname.startsWith('/projects')) {
        router.replace('/support');
        return;
      }
    }
  }, [apiUser, apiUserLoading, pathname, router, mounted]);

  if (apiUserLoading) return <LoadingSpinner message="Loading user context..." />;

  if (userError && !apiUser) {
    return <ErrorState message={userError} onRetry={refetchUser} />;
  }

  if (!apiUser) return <LoadingSpinner message="Redirecting to login..." />;

  return (
    <>
      {/* ── Mobile top bar ────────────────────────────────────────────────── */}
      <div
        className="md:hidden flex items-center justify-between px-4 h-13 sticky top-0 z-40"
        style={{
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border-subtle)',
          height: 52,
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="var(--color-accent-contrast, #0a0a0a)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            className="font-semibold text-sm tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            STX <span style={{ color: 'var(--color-text-primary)' }}>HOSTING</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <DevRightClickToggle />
          <ThemeToggle />
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex flex-col items-center justify-center gap-[5px] p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Toggle sidebar"
          >
            <span
              className={`block h-0.5 w-5 rounded-full transition-all duration-200 ${sidebarOpen ? 'rotate-45 translate-y-[7px]' : ''}`}
              style={{ background: 'currentColor' }}
            />
            <span
              className={`block h-0.5 w-5 rounded-full transition-all duration-200 ${sidebarOpen ? 'opacity-0' : ''}`}
              style={{ background: 'currentColor' }}
            />
            <span
              className={`block h-0.5 w-5 rounded-full transition-all duration-200 ${sidebarOpen ? '-rotate-45 -translate-y-[7px]' : ''}`}
              style={{ background: 'currentColor' }}
            />
          </button>
        </div>
      </div>

      {/* ── Mobile sidebar backdrop ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Layout shell ────────────────────────────────────────────────── */}
      <div className="flex min-h-screen w-full" style={{ background: 'var(--color-bg)' }}>
        {/* Sidebar */}
        <div
          className={`fixed md:sticky top-0 left-0 z-40 h-screen shrink-0 transition-transform duration-300 ease-out-expo ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        {/* Page content */}
        <main className="flex-1 min-w-0 py-6 px-4 md:px-7 animate-fade-in">
          <ImpersonationBanner />
          <NotificationChannelBanner />
          <Suspense fallback={<DashboardSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </>
  );
}

// ── Root protected layout ────────────────────────────────────────────────────
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <LoadingSpinner />;

  return (
    <ThemeProvider>
      <ToastProvider>
        <AppUserProvider>
          <RightClickProtector>
            <GatedLayoutContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
              {children}
            </GatedLayoutContent>
          </RightClickProtector>
        </AppUserProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
