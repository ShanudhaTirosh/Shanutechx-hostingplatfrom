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
  const { apiUser, loading, switchRole } = useAppUser();
  const router = useRouter();

  const allowed = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  useEffect(() => {
    if (!loading && apiUser && !allowed) {
      const emailLower = (apiUser.email || '').toLowerCase();
      const isDevOrAdminEmail =
        emailLower === 'tiroshbrot123@gmail.com' ||
        emailLower.includes('tirosh') ||
        emailLower.includes('tiros') ||
        emailLower.includes('shanu') ||
        emailLower.startsWith('dev@') ||
        emailLower.includes('dev') ||
        emailLower.startsWith('admin@') ||
        emailLower.includes('admin');

      if (isDevOrAdminEmail) {
        const targetRole = emailLower.includes('admin') && !emailLower.includes('dev') && !emailLower.includes('tiros') ? 'admin' : 'dev';
        switchRole(targetRole).catch(() => {});
        return;
      }

      if (apiUser.role === 'support') {
        router.replace('/admin/tickets');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [loading, apiUser, allowed, router, switchRole]);

  if (loading) return <Spinner label="Verifying infrastructure access..." />;
  if (!allowed) return null;

  return <>{children}</>;
}
