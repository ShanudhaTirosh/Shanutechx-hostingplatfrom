'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Search, ShieldAlert, Lock, Unlock, HardDrive, KeyRound, AlertTriangle, CheckCircle2, User, RefreshCw } from 'lucide-react';

interface SupportUser {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  isBanned: boolean;
  bannedAt?: string;
  banReason?: string;
  createdAt: string;
  smtpAccounts: {
    id: string;
    smtpUsername: string;
    smtpHost: string;
    customDomain?: string;
    storageQuotaMb: number;
    storageUsedMb: number;
    isSuspended: boolean;
    aliases: string[];
  }[];
}

export default function SupportHelpdeskConsolePage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SupportUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SupportUser | null>(null);

  // Support Action Modal Inputs
  const [bumpAccountId, setBumpAccountId] = useState('');
  const [bumpMb, setBumpMb] = useState(1024);
  const [actionReason, setActionReason] = useState('');
  const [executingAction, setExecutingAction] = useState(false);

  const { toast } = useToast();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/webmail/support/lookup?q=${encodeURIComponent(query.trim())}`);
      setResults(res.data?.results || []);
      if (res.data?.results?.length > 0) {
        setSelectedUser(res.data.results[0]);
      } else {
        setSelectedUser(null);
        toast('No accounts found matching query', 'info');
      }
    } catch (err: any) {
      toast('Support lookup failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleUnlockAccount = async (targetUserId: string) => {
    setExecutingAction(true);
    try {
      await api.post('/webmail/support/unlock-account', {
        targetUserId,
        reason: actionReason || 'Customer support request',
      });
      toast('Account unlocked successfully and logged to audit trail!', 'success');
      setActionReason('');
      handleLookup({ preventDefault: () => {} } as any);
    } catch (err: any) {
      toast('Failed to unlock account', 'error');
    } finally {
      setExecutingAction(false);
    }
  };

  const handleQuotaBump = async (smtpAccountId: string) => {
    if (!actionReason.trim()) {
      toast('Justification reason is required for quota bumps', 'error');
      return;
    }
    setExecutingAction(true);
    try {
      const res = await api.post('/webmail/support/quota-bump', {
        smtpAccountId,
        additionalMb: bumpMb,
        reason: actionReason,
      });
      toast(`Granted +${bumpMb}MB quota bump! New total: ${res.data.newQuotaMb}MB`, 'success');
      setActionReason('');
      handleLookup({ preventDefault: () => {} } as any);
    } catch (err: any) {
      toast('Failed to bump quota', 'error');
    } finally {
      setExecutingAction(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header with Privacy Notice */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-white" />
            Support & Helpdesk Console
          </h1>
          <p className="text-sm text-neutral-400">
            Account provisioning lookup, password reset, unlock, and audited quota bump actions.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300">
          <Lock className="h-4 w-4" />
          Strict Privacy Bound: Zero Email Content Reading Access
        </div>
      </div>

      {/* Account Lookup Search Bar */}
      <div className="rounded-2xl border border-white/10 bg-[#0c0d12] p-6 shadow-2xl">
        <form onSubmit={handleLookup} className="flex max-w-2xl gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search user email, display name, or domain..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0a0a0c] pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white/30 focus:outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold px-5 py-2.5 text-sm shadow-md transition-all disabled:opacity-50"
          >
            {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Lookup Account
          </button>
        </form>

        {/* Search Results Grid */}
        {results.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Search Matches</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`rounded-xl border px-4 py-2 text-left text-xs font-medium transition-all ${
                    selectedUser?.id === u.id
                      ? 'border-white/30 bg-white/15 text-white shadow-md'
                      : 'border-white/10 bg-[#0a0a0c] text-neutral-300 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <div className="font-bold text-white">{u.displayName || u.email}</div>
                  <div className="text-neutral-400">{u.email} ({u.role})</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Account Support Management Panel */}
      {selectedUser && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#0c0d12] p-6 shadow-2xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-white" />
                  {selectedUser.displayName || selectedUser.email}
                </h2>
                <p className="text-xs text-neutral-400">User ID: {selectedUser.id} • Created {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                {selectedUser.isBanned ? (
                  <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300">
                    Account Banned: {selectedUser.banReason || 'Policy violation'}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                    Account Active
                  </span>
                )}
              </div>
            </div>

            {/* Support Actions Toolbar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
              <input
                type="text"
                placeholder="Required Action Justification Reason / Ticket ID..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-[#0a0a0c] px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-white/30 focus:outline-none transition-all"
              />

              {selectedUser.isBanned && (
                <button
                  onClick={() => handleUnlockAccount(selectedUser.id)}
                  disabled={executingAction}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
                >
                  <Unlock className="h-4 w-4" /> Unlock Account
                </button>
              )}
            </div>

            {/* Associated SmtpAccounts */}
            <div className="mt-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Customer Mailboxes ({selectedUser.smtpAccounts.length})</h3>
              {selectedUser.smtpAccounts.map((acc) => (
                <div key={acc.id} className="rounded-xl border border-white/10 bg-[#0a0a0c] p-4 text-xs">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <span className="font-bold text-white">{acc.smtpUsername}@{acc.customDomain || 'shanutechx.com'}</span>
                      <p className="text-neutral-400">Storage: {acc.storageUsedMb} MB / {acc.storageQuotaMb} MB • Aliases: {acc.aliases?.length || 0}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuotaBump(acc.id)}
                        disabled={executingAction}
                        className="flex items-center gap-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 px-3.5 py-1.5 font-bold shadow-md transition-all disabled:opacity-50"
                      >
                        <HardDrive className="h-3.5 w-3.5" /> Bump Quotas (+1GB)
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
