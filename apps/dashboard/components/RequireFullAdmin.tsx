'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { Spinner } from '@/components/ui';

/**
 * Stricter than the top-level /admin/* layout (which lets support staff
 * through too) — wrap any section that should stay true-admin-only:
 * nodes, CMS, the customer directory, the payment review queue, the audit
 * log. A support agent being able to see tickets and chat doesn't mean
 * they should see node SSH key refs, trigger the billing sweep, or
 * approve/reject payments.
 */
export default function RequireFullAdmin({ children }: { children: React.ReactNode }) {
  const { apiUser, loading } = useAppUser();
  const router = useRouter();

  const allowed = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  useEffect(() => {
    if (!loading && apiUser && !allowed) {
      router.replace('/dashboard');
    }
  }, [loading, apiUser, allowed, router]);

  if (loading) return <Spinner />;
  if (!allowed) return null;

  return <>{children}</>;
}
