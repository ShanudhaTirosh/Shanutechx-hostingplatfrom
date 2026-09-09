'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, X, Shield, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailDelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailDelegationModal({ isOpen, onClose }: WebmailDelegationModalProps) {
  const [delegations, setDelegations] = useState<any[]>([]);
  const [delegateEmail, setDelegateEmail] = useState('');
  const [permission, setPermission] = useState('full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDelegations();
    }
  }, [isOpen]);

  const loadDelegations = async () => {
    try {
      const res = await api.webmail.getAccountDelegations();
      setDelegations(res.delegations || []);
    } catch {
      // fallback
    }
  };

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateEmail) return;
    setLoading(true);
    setError('');
    try {
      await api.webmail.addAccountDelegate({ delegateEmail, permission });
      setDelegateEmail('');
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      await loadDelegations();
    } catch (err: any) {
      setError('Failed to delegate access. Verify email address.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await api.webmail.revokeAccountDelegate(id);
      setDelegations((prev) => prev.filter((d) => d.id !== id));
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
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Mailbox Access Delegation</h3>
            <p className="text-xs text-slate-400">Grant team members permission to read & send on your behalf</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}
        {added && <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Delegate added successfully!</div>}

        <form onSubmit={handleAdd} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 mb-6 space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-indigo-400" /> Add New Delegate
          </h4>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="colleague@domain.com"
              value={delegateEmail}
              onChange={(e) => setDelegateEmail(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
              required
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="full">Full Access</option>
              <option value="read_only">Read Only</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !delegateEmail}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            {loading ? 'Adding...' : 'Grant Delegate Access'}
          </button>
        </form>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Authorized Delegates</h4>
          {delegations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 rounded-lg bg-slate-900/30 border border-slate-800/60">
              No active delegates. Add team members above to share mailbox management.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {delegations.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <div>
                    <div className="font-medium text-slate-200">{d.delegateEmail}</div>
                    <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1 mt-0.5">
                      <Shield className="w-3 h-3 text-indigo-400" /> {d.permission.replace('_', ' ')} permission
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(d.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Revoke access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
