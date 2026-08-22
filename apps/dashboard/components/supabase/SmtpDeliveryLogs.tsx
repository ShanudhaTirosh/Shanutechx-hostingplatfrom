'use client';

import React, { useEffect, useState } from 'react';
import { supabaseAdmin, SmtpDeliveryLog } from '@/lib/supabaseAdmin';

export function SmtpDeliveryLogs() {
  const [logs, setLogs] = useState<SmtpDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = () => {
    supabaseAdmin.smtp
      .getLogs()
      .then((res) => setLogs(res.logs))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  if (loading) {
    return <div className="text-xs text-text-muted p-4">Loading SMTP delivery logs...</div>;
  }

  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] space-y-3">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Outbound Mail Delivery Logs ({logs.length})
        </h3>
        <button onClick={loadLogs} className="text-xs text-accent-teal-bright hover:underline">
          Refresh Logs
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center">No outbound emails dispatched yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs text-text-primary">
            <thead className="sticky top-0 bg-[#0d0f17] border-b border-white/[0.08] text-text-muted uppercase text-[10px]">
              <tr>
                <th className="p-2">Recipient</th>
                <th className="p-2">Subject</th>
                <th className="p-2">Status</th>
                <th className="p-2">Message ID / Details</th>
                <th className="p-2">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono text-[11px]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.04]">
                  <td className="p-2 font-semibold text-text-primary">{log.recipient}</td>
                  <td className="p-2 max-w-xs truncate">{log.subject}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        log.status === 'DELIVERED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="p-2 text-text-muted max-w-xs truncate">
                    {log.status === 'DELIVERED' ? log.messageId : log.errorMessage}
                  </td>
                  <td className="p-2 text-text-faint">{new Date(log.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
