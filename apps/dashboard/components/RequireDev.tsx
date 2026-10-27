'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { Spinner } from '@/components/ui';

/**
 * Strict access control: guarantees that core system VPS infrastructure,
 * host UFW firewall, Docker engine orchestration, and low-level compute nodes
 * can ONLY be accessed and managed by the 'dev' superuser role.
 * Standard users, customers, support staff, and admin staff are redirected.
 */
export default function RequireDev({ children }: { children: React.ReactNode }) {
  const { apiUser, loading } = useAppUser();
  const router = useRouter();

  const isDev = apiUser?.role === 'dev';

  useEffect(() => {
    if (!loading && apiUser && !isDev) {
      if (apiUser.role === 'admin' || apiUser.role === 'support') {
        router.replace('/admin');
      } else {
        router.replace('/vps');
      }
    }
  }, [loading, apiUser, isDev, router]);

  if (loading) return <Spinner label="Verifying Dev Superuser privileges..." />;
  if (!isDev) return null;

  return <>{children}</>;
}
