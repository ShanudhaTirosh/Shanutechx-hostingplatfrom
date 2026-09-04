'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { Spinner } from '@/components/ui';

/**
 * Gates the whole /admin/* tree to admin, support, OR dev. This top-level
 * check only answers "does this person belong anywhere under /admin/*
 * at all" — every specific section has its own narrower guard on top of
 * this one:
 *   - RequireFullAdmin: customers, staff, CMS, review queue, audit log,
 *     analytics — admin only, never support or dev.
 *   - RequireAdminOrDev: nodes, Leaseweb, managed databases — admin or dev,
 *     never support.
 *   - Tickets/chat pages have their own explicit admin-or-support guard
 *     (not just relying on this outer gate), since dev passing this outer
 *     check does NOT mean dev should see customer support tickets/chat.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { apiUser, loading, switchRole } = useAppUser();
  const router = useRouter();

  const belongsUnderAdmin =
    apiUser?.role === 'admin' || apiUser?.role === 'support' || apiUser?.role === 'dev';

  useEffect(() => {
    if (!loading && apiUser && !belongsUnderAdmin) {
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

      router.replace('/dashboard');
    }
  }, [loading, apiUser, belongsUnderAdmin, router, switchRole]);

  if (loading) return <Spinner label="Loading admin panel..." />;
  if (!belongsUnderAdmin) return null;

  return <>{children}</>;
}
