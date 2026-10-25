'use client';

import React, { useState } from 'react';
import { Clock, Calendar, X, Check } from 'lucide-react';
import { api } from '../../lib/api';

interface WebmailSnoozeModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  onSnoozed?: () => void;
}

export function WebmailSnoozeModal({ isOpen, onClose, messageId, onSnoozed }: WebmailSnoozeModalProps) {
  const [customDateTime, setCustomDateTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePreset = async (presetHours: number) => {
    setIsSubmitting(true);
    const date = new Date(Date.now() + presetHours * 3600 * 1000);
    try {
      await api.webmail.snoozeMessage(messageId, date.toISOString());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsSubmitting(false);
        onSnoozed?.();
        onClose();
      }, 800);
    } catch {
      setIsSubmitting(false);
    }
  };

  const handleCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDateTime) return;
    setIsSubmitting(true);
    try {
      await api.webmail.snoozeMessage(messageId, new Date(customDateTime).toISOString());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsSubmitting(false);
        onSnoozed?.();
        onClose();
      }, 800);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-white/5 text-white border border-white/15">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Snooze Message</h3>
            <p className="text-xs text-slate-400">Hide from inbox until selected time</p>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center text-emerald-400 flex flex-col items-center gap-2">
            <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <Check className="w-8 h-8" />
            </div>
            <p className="font-medium text-sm">Snoozed successfully!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              <button
                disabled={isSubmitting}
                onClick={() => handlePreset(4)}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-white/15 hover:bg-slate-800/80 transition-all text-left group"
              >
                <div>
                  <div className="text-sm font-medium text-slate-200 group-hover:text-neutral-300">Later today</div>
                  <div className="text-xs text-slate-400">In 4 hours</div>
                </div>
                <Clock className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => handlePreset(24)}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-white/15 hover:bg-slate-800/80 transition-all text-left group"
              >
                <div>
                  <div className="text-sm font-medium text-slate-200 group-hover:text-neutral-300">Tomorrow morning</div>
                  <div className="text-xs text-slate-400">Tomorrow at 8:00 AM</div>
                </div>
                <Calendar className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => handlePreset(168)}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-white/15 hover:bg-slate-800/80 transition-all text-left group"
              >
                <div>
                  <div className="text-sm font-medium text-slate-200 group-hover:text-neutral-300">Next week</div>
                  <div className="text-xs text-slate-400">Next Monday at 8:00 AM</div>
                </div>
                <Calendar className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <form onSubmit={handleCustom} className="space-y-3">
                <label className="block text-xs font-medium text-slate-400">Pick custom date & time</label>
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  disabled={!customDateTime || isSubmitting}
                  className="w-full py-2 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Confirm Custom Time
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
