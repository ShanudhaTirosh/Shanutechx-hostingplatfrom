'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { Spinner } from '@/components/ui';

/**
 * Gates infrastructure-focused sections — nodes, Leaseweb VPS management,
 * managed databases — to admin OR dev. This is the split the dev role
 * exists for: dev gets full infra visibility (nodes, Leaseweb raw logs,
 * database provisioning) but never customers, billing, payment review,
 * CMS, or staff management, which stay behind RequireFullAdmin instead.
 */
export default function RequireAdminOrDev({ children }: { children: React.ReactNode }) {
  const { apiUser, loading } = useAppUser();
  const router = useRouter();

  const allowed = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  useEffect(() => {
    if (!loading && apiUser && !allowed) {
      if (apiUser.role === 'support') {
        router.replace('/admin/tickets');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [loading, apiUser, allowed, router]);

  if (loading) return <Spinner />;
  if (!allowed) return null;

  return <>{children}</>;
}
