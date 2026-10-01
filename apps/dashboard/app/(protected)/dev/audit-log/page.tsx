'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Button, Spinner, EmptyState, ErrorBanner, PageHeader, Table, Tr, Td, useToast } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  createdAt: string;
  admin: { email: string };
}

function actionColor(action: string): string {
  if (action.includes('approve') || action.includes('creat')) return 'text-emerald-400';
  if (action.includes('reject') || action.includes('delet') || action.includes('cancel')) return 'text-red-400';
  if (action.includes('update') || action.includes('edit') || action.includes('set')) return 'text-orange-300';
  return 'text-accent-violet-light';
}

function actionBadge(action: string): string {
  if (action.includes('approve') || action.includes('creat')) return 'bg-emerald-500/10';
  if (action.includes('reject') || action.includes('delet') || action.includes('cancel')) return 'bg-red-500/10';
  if (action.includes('update') || action.includes('edit') || action.includes('set')) return 'bg-orange-500/10';
  return 'bg-accent-violet/10';
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function DevAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    api.admin
      .auditLog(skip)
      .then((data) => {
        setEntries(data.entries);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  }, [skip]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Audit Log &amp; Security Ledger"
        description="Dev Studio security ledger recording admin actions, payment approvals, role changes, CMS edits, and secret access events."
      />

      {error && <ErrorBanner message={error} />}
      {entries === null && <Spinner label="Loading security audit ledger..." />}
      {entries?.length === 0 && <EmptyState message="No audit entries recorded yet." />}

      {entries && entries.length > 0 && (
        <Table headers={['Admin Operator', 'Action', 'Target Object', 'Timestamp']}>
          {entries.map((entry) => (
            <Tr key={entry.id}>
              <Td>
                <p className="text-xs font-medium text-text-primary">{entry.admin.email}</p>
              </Td>
              <Td>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${actionBadge(entry.action)} ${actionColor(entry.action)}`}>
                  {entry.action.replace(/_/g, ' ')}
                </span>
              </Td>
              <Td>
                {entry.target ? (
                  <code className="text-[10px] text-text-muted font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">
                    {entry.target}
                  </code>
                ) : (
                  <span className="text-text-faint text-xs">—</span>
                )}
              </Td>
              <Td>
                <p className="text-xs text-text-muted whitespace-nowrap font-mono">
                  {new Date(entry.createdAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </p>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
          >
            <ChevronLeft /> Newer
          </Button>
          <p className="text-text-muted text-xs font-mono">
            {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} entries
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={skip + PAGE_SIZE >= total}
            onClick={() => setSkip(skip + PAGE_SIZE)}
          >
            Older <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
