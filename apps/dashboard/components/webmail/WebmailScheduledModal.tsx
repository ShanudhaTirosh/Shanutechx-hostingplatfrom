'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Trash2, X, Send, Calendar } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailScheduledModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailScheduledModal({ isOpen, onClose }: WebmailScheduledModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadScheduled();
    }
  }, [isOpen]);

  const loadScheduled = async () => {
    setLoading(true);
    try {
      const res = await api.webmail.listScheduled();
      setItems(res.scheduled || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCancel = async (id: string) => {
    try {
      await api.webmail.cancelScheduled(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
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
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Scheduled Emails Queue</h3>
            <p className="text-xs text-slate-400">Messages waiting to be automatically dispatched</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Fetching scheduled queue...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Send className="w-10 h-10 mx-auto text-slate-700 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-400">No scheduled emails</p>
            <p className="text-xs text-slate-600">Use "Schedule Send" in composer to queue messages for later</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="font-semibold text-slate-200 truncate">{item.subject}</div>
                  <div className="text-slate-400 truncate">To: {item.recipientTo}</div>
                  <div className="text-indigo-400 text-[11px] flex items-center gap-1 mt-1 font-medium">
                    <Calendar className="w-3 h-3" /> Scheduled: {new Date(item.scheduledFor).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
                  title="Cancel scheduled send"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
