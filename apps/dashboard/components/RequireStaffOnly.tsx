'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { Spinner } from '@/components/ui';

/**
 * Gates support-facing sections (tickets, live chat) to admin OR support.
 * Explicitly excludes dev — dev passes the outer /admin/* layout gate
 * (needed to reach the infra sections under the same tree) but that
 * doesn't mean dev should see customer support conversations, which are a
 * different kind of access entirely.
 */
export default function RequireStaffOnly({ children }: { children: React.ReactNode }) {
  const { apiUser, loading } = useAppUser();
  const router = useRouter();

  const allowed = apiUser?.role === 'admin' || apiUser?.role === 'support';

  useEffect(() => {
    if (!loading && apiUser && !allowed) {
      router.replace('/dashboard');
    }
  }, [loading, apiUser, allowed, router]);

  if (loading) return <Spinner />;
  if (!allowed) return null;

  return <>{children}</>;
}
