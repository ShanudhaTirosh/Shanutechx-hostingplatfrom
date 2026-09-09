'use client';

import React, { useState, useEffect } from 'react';
import { Laptop, Trash2, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailActiveSessionsModal({ isOpen, onClose }: WebmailActiveSessionsModalProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await api.webmail.getSessions();
      setSessions(res.sessions || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleRevoke = async (id: string) => {
    try {
      await api.webmail.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Active Webmail Sessions</h3>
            <p className="text-xs text-slate-400">Devices currently logged into your webmail account</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading active sessions...</div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {sessions.map((s) => (
              <div key={s.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    {s.device}
                    {s.isCurrent && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-normal">
                        Current Session
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px]">IP: {s.ipAddress} • {new Date(s.lastActive).toLocaleTimeString()}</div>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevoke(s.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Terminate Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
