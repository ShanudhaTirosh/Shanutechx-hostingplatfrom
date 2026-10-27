'use client';

import { useState } from 'react';
import { useAppUser } from '@/lib/AppUserContext';
import { api } from '@/lib/api';
import { Button, Input, useToast } from '@/components/ui';

export function NotificationChannelBanner() {
  const { apiUser, refetchUser } = useAppUser();
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  if (!apiUser) return null;
  const hasChannel = Boolean(apiUser.phoneNumber || apiUser.discordUserId);
  if (hasChannel) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() && !discordId.trim()) {
      setError('Please provide at least a WhatsApp phone number OR a Discord User ID.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({
        phoneNumber: phone.trim() ? phone.replace(/\s+/g, '') : null,
        discordUserId: discordId.trim() || null,
      });
      await refetchUser();
      toast('Notification channel saved successfully!', 'success');
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save notification channel');
      toast('Failed to update notification channel', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg backdrop-blur-md transition-all duration-300 animate-fade-in mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-200">
                Action Required: No Real-time Notification Channel Linked
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5 max-w-2xl leading-relaxed">
                You currently have neither a <strong className="text-amber-100">WhatsApp Phone Number</strong> nor a{' '}
                <strong className="text-amber-100">Discord User ID</strong> set in your profile. Please add at least
                one channel to receive real-time server downtime alerts, container build updates, and deployment status changes.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setPhone(apiUser.phoneNumber || '');
              setDiscordId(apiUser.discordUserId || '');
              setError(null);
              setShowModal(true);
            }}
            className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-md transition-all"
          >
            Fix Channel Error →
          </Button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-background-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-sm text-text-primary">Link Notification Channel</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-primary transition-colors text-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Enter at least one communication channel below to receive automatic push notifications for hosting events, build failures, and billing.
            </p>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="WhatsApp Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+94771234567"
                hint="Include country code (e.g. +9477... or +1...)"
              />

              <div className="relative text-center my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <span className="relative bg-background-card px-2 text-[10px] uppercase font-mono text-text-faint">OR</span>
              </div>

              <Input
                label="Discord User ID"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="123456789012345678"
                hint="Discord Settings → Advanced → Enable Developer Mode → Copy User ID."
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={busy}>
                  Save &amp; Enable Realtime Alerts
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
