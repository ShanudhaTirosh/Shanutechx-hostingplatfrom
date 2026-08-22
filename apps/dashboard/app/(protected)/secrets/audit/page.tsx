'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Table, Tr, Td, Spinner, ErrorBanner, Badge } from '@/components/ui';
import { secretsApi, SecretAuditEntry } from '@/lib/secretsApi';

export default function SecretsAuditPage() {
  const [logs, setLogs] = useState<SecretAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    secretsApi.audit
      .logs()
      .then((res) => setLogs(res.auditLogs))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading secrets audit trail..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Secrets Access Audit Log"
        description="Immutably tracked access events, updates, and reads across all vault projects."
      />

      {error && <ErrorBanner message={error} />}

      <Table headers={['Project', 'Action', 'Actor / User', 'Timestamp']}>
        {logs.map((log) => (
          <Tr key={log.id}>
            <Td className="font-semibold text-xs text-text-primary">{log.projectName}</Td>
            <Td>
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  log.action === 'DELETE'
                    ? 'bg-red-500/20 text-red-300'
                    : log.action === 'CREATE' || log.action === 'UPDATE'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/[0.06] text-text-muted'
                }`}
              >
                {log.action}
              </span>
            </Td>
            <Td className="text-xs font-mono text-text-muted">{log.actorEmail}</Td>
            <Td className="text-xs text-text-faint">{new Date(log.timestamp).toLocaleString()}</Td>
          </Tr>
        ))}
      </Table>
    </div>
  );
}
