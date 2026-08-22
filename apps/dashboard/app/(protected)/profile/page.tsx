'use client';

import { useEffect, useState } from 'react';
import { useAppUser } from '@/lib/AppUserContext';
import { api } from '@/lib/api';
import { Card, Button, ErrorBanner, Input, PageHeader, useToast } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const { apiUser } = useAppUser();
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (apiUser) {
      setDisplayName(apiUser.displayName ?? '');
      setPhoneNumber(apiUser.phoneNumber ?? '');
      setDiscordUserId(apiUser.discordUserId ?? '');
    }
  }, [apiUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({
        displayName: displayName || undefined,
        phoneNumber: phoneNumber ? phoneNumber.replace(/\s+/g, '') : null,
        discordUserId: discordUserId || null,
      });
      toast('Profile saved successfully', 'success');
    } catch (err: any) {
      setError(err.message);
      toast('Failed to save profile', 'error');
    } finally {
      setBusy(false);
    }
  }

  const initials = apiUser?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="max-w-xl space-y-6 animate-fade-in">
      <PageHeader
        title="My Profile"
        description="Update your display name and link notification channels."
      />

      {/* Avatar Card */}
      <Card className="flex items-center gap-4 border border-white/[0.06]">
        <div className="h-14 w-14 rounded-full bg-brand-gradient flex items-center justify-center text-white text-lg font-bold shadow-glow-violet shrink-0">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-text-primary">{apiUser?.displayName || apiUser?.email}</p>
          <p className="text-text-muted text-xs mt-0.5 font-mono">{apiUser?.email}</p>
          <p className="text-xs mt-1">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize bg-accent-violet/15 text-accent-violet-light">
              {apiUser?.role}
            </span>
          </p>
        </div>
      </Card>

      <Card className="border border-white/[0.06]">
        <h2 className="font-semibold text-sm text-text-primary mb-4">Edit Profile</h2>
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email is read-only, provided by Firebase */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Email Address</label>
            <input
              disabled
              value={apiUser?.email ?? ''}
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-text-muted cursor-not-allowed"
            />
            <p className="text-[10px] text-text-faint">Email is managed by your sign-in provider and cannot be changed here.</p>
          </div>

          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. John Silva"
            hint="Shown in the dashboard and support tickets."
          />

          <Input
            label="WhatsApp Number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+94771234567"
            hint="Used for order & deployment alert notifications via WhatsApp."
          />

          <Input
            label="Discord User ID"
            value={discordUserId}
            onChange={(e) => setDiscordUserId(e.target.value)}
            placeholder="123456789012345678"
            hint="Enable Developer Mode in Discord → right-click your profile → Copy User ID."
          />

          <div className="pt-2">
            <Button type="submit" loading={busy} className="w-full justify-center">
              {busy ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
