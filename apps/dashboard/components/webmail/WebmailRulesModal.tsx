'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Zap, Trash2, X, Plus, Forward } from 'lucide-react';

interface WebmailRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailRulesModal({ isOpen, onClose }: WebmailRulesModalProps) {
  const [filters, setFilters] = useState<any[]>([]);
  const [ruleName, setRuleName] = useState('');
  const [fromContains, setFromContains] = useState('');
  const [subjectContains, setSubjectContains] = useState('');
  const [actionMoveFolder, setActionMoveFolder] = useState('archive');
  const [actionApplyLabel, setActionApplyLabel] = useState('');
  const [actionForwardTo, setActionForwardTo] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) fetchFilters();
  }, [isOpen]);

  const fetchFilters = () => {
    api.webmail.filters.list().then((r) => setFilters(r.filters || [])).catch(() => {});
  };

  if (!isOpen) return null;

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const conditionsJson = {
      fromContains: fromContains.trim() || undefined,
      subjectContains: subjectContains.trim() || undefined,
    };

    const actionsJson = {
      moveToFolder: actionMoveFolder || undefined,
      applyLabel: actionApplyLabel.trim() || undefined,
      forwardTo: actionForwardTo.trim() || undefined,
    };

    try {
      await api.webmail.filters.create({ name: ruleName, conditionsJson, actionsJson });
      toast(`Filter rule "${ruleName}" created!`, 'success');
      setRuleName('');
      setFromContains('');
      setSubjectContains('');
      setActionApplyLabel('');
      setActionForwardTo('');
      fetchFilters();
    } catch {
      toast('Failed to create rule', 'error');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.webmail.filters.delete(id);
      toast('Rule deleted', 'info');
      fetchFilters();
    } catch {
      toast('Failed to delete rule', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>Automated Rules & Email Filters</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* RULE CREATOR FORM */}
        <form onSubmit={handleCreateRule} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
          <h4 className="font-bold text-indigo-400">Create New Automated Filter Rule</h4>
          <input
            type="text"
            placeholder="Rule Title (e.g. Move Newsletters to Archive)"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">If From contains:</label>
              <input
                type="text"
                placeholder="e.g. newsletter@domain.com"
                value={fromContains}
                onChange={(e) => setFromContains(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">If Subject contains:</label>
              <input
                type="text"
                placeholder="e.g. Invoice, Receipt"
                value={subjectContains}
                onChange={(e) => setSubjectContains(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Then Move to Folder:</label>
              <select
                value={actionMoveFolder}
                onChange={(e) => setActionMoveFolder(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 cursor-pointer"
              >
                <option value="archive">Archive</option>
                <option value="trash">Trash</option>
                <option value="spam">Spam</option>
                <option value="">— No move —</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">And Apply Label:</label>
              <input
                type="text"
                placeholder="e.g. News, Work"
                value={actionApplyLabel}
                onChange={(e) => setActionApplyLabel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1">
              <Forward className="h-3 w-3" /> Also Forward to External Email (optional):
            </label>
            <input
              type="email"
              placeholder="e.g. backup@shanutechx.com"
              value={actionForwardTo}
              onChange={(e) => setActionForwardTo(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white placeholder:text-slate-600"
            />
          </div>

          <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>Save Automated Rule</span>
          </button>
        </form>

        {/* EXISTING RULES LIST */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Rules ({filters.length})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {filters.map((flt) => (
              <div key={flt.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs">
                <div>
                  <p className="font-bold text-white">{flt.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    If: {JSON.stringify(flt.conditionsJson)} → Action: {JSON.stringify(flt.actionsJson)}
                  </p>
                </div>
                <button onClick={() => handleDeleteRule(flt.id)} className="text-slate-500 hover:text-rose-400 p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
