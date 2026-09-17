'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { Spinner } from '@/components/ui';

/**
 * Gates full administrative control panel sections (customers, staff, CMS,
 * review queue, audit log, analytics) to admin OR dev. Excludes support staff
 * and customers.
 */
export default function RequireFullAdmin({ children }: { children: React.ReactNode }) {
  const { apiUser, loading } = useAppUser();
  const router = useRouter();

  const allowed = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  useEffect(() => {
    if (!loading && apiUser && !allowed) {
      // Role is determined server-side only — no client-side email matching.
      if (apiUser.role === 'support') {
        router.replace('/admin/tickets');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [loading, apiUser, allowed, router]);

  if (loading) return <Spinner label="Verifying admin permissions..." />;
  if (!allowed) return null;

  return <>{children}</>;
}

