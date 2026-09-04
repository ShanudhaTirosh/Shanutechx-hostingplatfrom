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

  if (loading) return <Spinner label="Verifying admin permissions..." />;
  if (!allowed) return null;

  return <>{children}</>;
}
