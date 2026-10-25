'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  Eye,
  Send,
  Sliders,
  X,
  Loader2,
  Check,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { api } from '../../lib/api';

interface StaffUser {
  id: string;
  email: string;
  displayName?: string | null;
  role: 'admin' | 'support';
  avatarUrl?: string | null;
}

interface MailboxAclEntry {
  userId: string;
  userEmail: string;
  userName?: string;
  role: 'admin' | 'support';
  permissions: ('read' | 'write' | 'manage')[];
  grantedAt: string;
  grantedBy: string;
}

interface MailboxStaffAccessModalProps {
  mailbox: {
    id: string;
    email: string;
    username: string;
    isInternal?: boolean;
  };
  onClose: () => void;
  onUpdate?: () => void;
}

export const MailboxStaffAccessModal: React.FC<MailboxStaffAccessModalProps> = ({
  mailbox,
  onClose,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [aclList, setAclList] = useState<MailboxAclEntry[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New grant form state
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [allowRead, setAllowRead] = useState(true);
  const [allowWrite, setAllowWrite] = useState(true);
  const [allowManage, setAllowManage] = useState(false);

  useEffect(() => {
    loadAccessData();
  }, [mailbox.id]);

  async function loadAccessData() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.email.getMailboxAccess(mailbox.id);
      if (res.ok) {
        setAclList(res.mailboxAcl || []);
        setStaffUsers(res.staffUsers || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch mailbox staff access list');
    } finally {
      setLoading(false);
    }
  }

  async function handleGrantOrUpdate(targetUserId: string, perms: ('read' | 'write' | 'manage')[]) {
    if (perms.length === 0) {
      setError('At least one permission (Read or Write) must be selected.');
      return;
    }
    setActionLoading(targetUserId);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.email.grantMailboxAccess(mailbox.id, {
        userId: targetUserId,
        permissions: perms,
      });
      if (res.ok) {
        setAclList(res.mailboxAcl || []);
        setSuccessMessage('Staff permissions updated successfully.');
        setSelectedStaffId('');
        if (onUpdate) onUpdate();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update staff permissions');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(targetUserId: string) {
    if (!confirm('Are you sure you want to revoke this staff member\'s access to this mailbox?')) return;
    setActionLoading(targetUserId);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.email.revokeMailboxAccess(mailbox.id, targetUserId);
      if (res.ok) {
        setAclList(res.mailboxAcl || []);
        setSuccessMessage('Staff access revoked successfully.');
        if (onUpdate) onUpdate();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to revoke staff access');
    } finally {
      setActionLoading(null);
    }
  }

  // Filter staff who are not yet in the ACL list
  const availableStaffToGrant = staffUsers.filter(
    (u) => !aclList.some((entry) => entry.userId === u.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/15 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Staff Access & Permissions</h3>
                {mailbox.isInternal && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-neutral-300 border border-white/15 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> System Mailbox
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{mailbox.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Dev Superuser Notice */}
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-white/15 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-neutral-300 flex items-center gap-2">
              <Shield className="h-4 w-4 text-white" />
              <span>Granular Role-Based Access Control</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              As a Dev administrator, you can grant system mailbox access to Admins and Support staff. Configure separate
              permissions for <strong className="text-white">Read</strong> (viewing and reading messages) and{' '}
              <strong className="text-white">Write</strong> (composing, replying, and sending outbound emails).
            </p>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="h-7 w-7 animate-spin text-white" />
              <span className="text-xs">Loading staff access permissions...</span>
            </div>
          ) : (
            <>
              {/* SECTION 1: Current Staff Grants */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-white" />
                    <span>Delegated Staff ({aclList.length})</span>
                  </h4>
                </div>

                {aclList.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                    No staff members currently have delegated access to this mailbox.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {aclList.map((entry) => {
                      const hasRead = entry.permissions.includes('read');
                      const hasWrite = entry.permissions.includes('write');
                      const hasManage = entry.permissions.includes('manage');
                      const isUpdating = actionLoading === entry.userId;

                      return (
                        <div
                          key={entry.userId}
                          className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">
                                {entry.userName || entry.userEmail}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  entry.role === 'admin'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {entry.role}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              {entry.userEmail}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Read Toggle */}
                            <button
                              disabled={isUpdating}
                              onClick={() => {
                                const nextPerms = hasRead
                                  ? entry.permissions.filter((p) => p !== 'read')
                                  : [...entry.permissions, 'read' as const];
                                handleGrantOrUpdate(entry.userId, nextPerms);
                              }}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                hasRead
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                              title={hasRead ? 'Read access granted' : 'Click to enable read access'}
                            >
                              <Eye className="h-3 w-3" />
                              <span>Read</span>
                            </button>

                            {/* Write Toggle */}
                            <button
                              disabled={isUpdating}
                              onClick={() => {
                                const nextPerms = hasWrite
                                  ? entry.permissions.filter((p) => p !== 'write')
                                  : [...entry.permissions, 'write' as const];
                                handleGrantOrUpdate(entry.userId, nextPerms);
                              }}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                hasWrite
                                  ? 'bg-white/10 text-neutral-300 border-white/15'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                              title={hasWrite ? 'Write / Send access granted' : 'Click to enable write / send access'}
                            >
                              <Send className="h-3 w-3" />
                              <span>Write</span>
                            </button>

                            {/* Manage Toggle */}
                            <button
                              disabled={isUpdating}
                              onClick={() => {
                                const nextPerms = hasManage
                                  ? entry.permissions.filter((p) => p !== 'manage')
                                  : [...entry.permissions, 'manage' as const];
                                handleGrantOrUpdate(entry.userId, nextPerms);
                              }}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                hasManage
                                  ? 'bg-purple-500/20 text-neutral-300 border-white/15'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                              title={hasManage ? 'Manage settings access granted' : 'Click to enable settings access'}
                            >
                              <Sliders className="h-3 w-3" />
                              <span>Manage</span>
                            </button>

                            {/* Revoke Button */}
                            <button
                              disabled={isUpdating}
                              onClick={() => handleRevoke(entry.userId)}
                              className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all ml-1"
                              title="Revoke access"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserX className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: Grant New Staff Access */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-white" />
                  <span>Grant New Staff Access</span>
                </h4>

                {availableStaffToGrant.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    All available Admin and Support users already have permissions configured for this mailbox.
                  </p>
                ) : (
                  <div className="space-y-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                        Select Staff Member
                      </label>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
                      >
                        <option value="">-- Choose an Admin or Support Member --</option>
                        {availableStaffToGrant.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.displayName ? `${user.displayName} (${user.email})` : user.email} — [
                            {user.role.toUpperCase()}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-2">
                        Initial Permissions
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={allowRead}
                            onChange={(e) => setAllowRead(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">Read Access</span>
                            <span className="text-[10px] text-slate-400">View inbox & messages</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={allowWrite}
                            onChange={(e) => setAllowWrite(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">Write Access</span>
                            <span className="text-[10px] text-slate-400">Send & reply to emails</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                          <input
                            type="checkbox"
                            checked={allowManage}
                            onChange={(e) => setAllowManage(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">Manage Access</span>
                            <span className="text-[10px] text-slate-400">Edit profile & aliases</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <button
                      disabled={!selectedStaffId || actionLoading !== null}
                      onClick={() => {
                        const perms: ('read' | 'write' | 'manage')[] = [];
                        if (allowRead) perms.push('read');
                        if (allowWrite) perms.push('write');
                        if (allowManage) perms.push('manage');
                        handleGrantOrUpdate(selectedStaffId, perms);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2"
                    >
                      {actionLoading === selectedStaffId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      <span>Grant Staff Permissions</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
