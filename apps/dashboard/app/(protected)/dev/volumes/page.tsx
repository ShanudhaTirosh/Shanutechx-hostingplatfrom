'use client';

import { UnifiedConnectorsHub } from '@/components/UnifiedConnectorsHub';

export const dynamic = 'force-dynamic';

export default function DevVolumesPage() {
  return <UnifiedConnectorsHub defaultTab="volumes" />;
}
