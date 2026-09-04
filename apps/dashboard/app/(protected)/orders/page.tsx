'use client';

import { UnifiedOrdersPortal } from '@/components/UnifiedOrdersPortal';

export const dynamic = 'force-dynamic';

export default function OrdersPage() {
  return <UnifiedOrdersPortal initialTab="subscriptions" />;
}
