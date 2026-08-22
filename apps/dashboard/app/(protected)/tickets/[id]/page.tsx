'use client';

import { useParams } from 'next/navigation';
import { TicketThread } from '@/components/TicketThread';

export const dynamic = 'force-dynamic';

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  return <TicketThread ticketId={params.id} />;
}
