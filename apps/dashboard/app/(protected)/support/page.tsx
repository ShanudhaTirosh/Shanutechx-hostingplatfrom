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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-indigo-500" />
            Support & Helpdesk Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Account provisioning lookup, password reset, unlock, and audited quota bump actions.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Lock className="h-4 w-4" />
          Strict Privacy Bound: Zero Email Content Reading Access
        </div>
      </div>

      {/* Account Lookup Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleLookup} className="flex max-w-2xl gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user email, display name, or domain..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Lookup Account
          </button>
        </form>

        {/* Search Results Grid */}
        {results.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Search Matches</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`rounded-lg border px-4 py-2 text-left text-xs font-medium ${
                    selectedUser?.id === u.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">{u.displayName || u.email}</div>
                  <div className="text-slate-500">{u.email} ({u.role})</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Account Support Management Panel */}
      {selectedUser && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-500" />
                  {selectedUser.displayName || selectedUser.email}
                </h2>
                <p className="text-xs text-slate-500">User ID: {selectedUser.id} • Created {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2">
                {selectedUser.isBanned ? (
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    Account Banned: {selectedUser.banReason || 'Policy violation'}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Account Active
                  </span>
                )}
              </div>
            </div>

            {/* Support Actions Toolbar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
              <input
                type="text"
                placeholder="Required Action Justification Reason / Ticket ID..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              {selectedUser.isBanned && (
                <button
                  onClick={() => handleUnlockAccount(selectedUser.id)}
                  disabled={executingAction}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Unlock className="h-4 w-4" /> Unlock Account
                </button>
              )}
            </div>

            {/* Associated SmtpAccounts */}
            <div className="mt-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Customer Mailboxes ({selectedUser.smtpAccounts.length})</h3>
              {selectedUser.smtpAccounts.map((acc) => (
                <div key={acc.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{acc.smtpUsername}@{acc.customDomain || 'shanutechx.com'}</span>
                      <p className="text-slate-500">Storage: {acc.storageUsedMb} MB / {acc.storageQuotaMb} MB • Aliases: {acc.aliases?.length || 0}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuotaBump(acc.id)}
                        disabled={executingAction}
                        className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700 disabled:opacity-50"
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
