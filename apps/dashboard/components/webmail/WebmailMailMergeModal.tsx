'use client';

import React, { useState } from 'react';
import { Users, Send, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailMailMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailMailMergeModal({ isOpen, onClose }: WebmailMailMergeModalProps) {
  const [subject, setSubject] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('Hi {{name}},\n\nWelcome to {{company}}!');
  const [csvText, setCsvText] = useState('email,name,company\nalice@example.com,Alice,Acme Corp\nbob@example.com,Bob,Tech Inc');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !bodyTemplate || !csvText) return;
    setLoading(true);

    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map((h) => h.trim());
      const emailIdx = headers.findIndex((h) => h.toLowerCase() === 'email');
      if (emailIdx === -1) return;

      const recipients = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (!cols[emailIdx]) continue;
        const variables: Record<string, string> = {};
        headers.forEach((h, idx) => {
          variables[h] = cols[idx] || '';
        });
        recipients.push({ email: cols[emailIdx], variables });
      }

      const res = await api.webmail.mailMerge({ recipients, subject, bodyTemplate });
      setResult(res.dispatchedCount);
      setTimeout(() => {
        setResult(null);
        setLoading(false);
        onClose();
      }, 1500);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-xl max-w-xl w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Mail Merge Campaign</h3>
            <p className="text-xs text-slate-400">Send personalized emails at scale with template variables</p>
          </div>
        </div>

        {result !== null ? (
          <div className="py-10 text-center space-y-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full w-fit mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-semibold text-slate-200">Dispatched {result} emails!</h4>
            <p className="text-xs text-slate-400">All personalized campaign emails have been queued.</p>
          </div>
        ) : (
          <form onSubmit={handleDispatch} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject Template</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Important update for {{company}}"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Body Template (HTML / Text)</label>
              <textarea
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                rows={4}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>CSV Recipient List (comma-separated with headers)</span>
                <span className="text-[10px] text-indigo-400 font-mono">Header row required</span>
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={4}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" /> {loading ? 'Dispatching Campaign...' : 'Dispatch Mail Merge'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
