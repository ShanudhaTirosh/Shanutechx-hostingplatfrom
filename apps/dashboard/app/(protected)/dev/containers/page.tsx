'use client';

import { UnifiedConnectorsHub } from '@/components/UnifiedConnectorsHub';

export const dynamic = 'force-dynamic';

export default function DevContainersPage() {
  return <UnifiedConnectorsHub defaultTab="containers" />;
}
