'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default function IndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    // All authenticated users land on /dashboard (where they can navigate to dev/admin panels via sidebar)
    router.replace('/dashboard');
  }, [loading, user, router]);

  return (
    <main className="min-h-screen flex items-center justify-center text-text-muted text-sm bg-bg">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 rounded-full border-2 border-white/10 border-t-accent-teal-bright animate-spin" />
        <span className="text-text-muted text-sm">Redirecting to your dashboard...</span>
      </div>
    </main>
  );
}
