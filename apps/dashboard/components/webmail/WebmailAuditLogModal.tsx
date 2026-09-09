'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Download, X, Calendar, Globe } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailAuditLogModal({ isOpen, onClose }: WebmailAuditLogModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAuditLogs();
    }
  }, [isOpen]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.webmail.getAuditLogs();
      setLogs(res.auditLogs || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Webmail Security Audit Logs</h3>
            <p className="text-xs text-slate-400">Chronological history of logins, session revocations & security events</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Fetching security logs...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">No security audit entries recorded yet.</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold text-indigo-300 capitalize">{log.action.replace(/_/g, ' ')}</div>
                  <div className="text-slate-400 flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-slate-500" /> IP: {log.ipAddress || '127.0.0.1'}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /> {new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {log.details && (
                  <div className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-400 font-mono border border-slate-800/60 max-w-[160px] truncate">
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
