'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader, Card, Spinner, ErrorBanner, Button, useToast } from '@/components/ui';
import { api } from '@/lib/api';

export default function AcceptTeamInvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided in URL link.');
      setLoading(false);
      return;
    }

    api.teams
      .getInvite(token)
      .then((d) => setInvite(d.invite))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    try {
      await api.teams.acceptInvite(token);
      toast('Successfully joined team workspace!', 'success');
      router.push('/settings');
    } catch (err: any) {
      toast(err.message || 'Failed to accept invitation', 'error');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) return <Spinner label="Verifying team invitation token..." />;

  return (
    <div className="max-w-xl mx-auto py-12 space-y-6 animate-fade-in font-sans">
      <PageHeader
        title="Accept Team Invitation"
        description="Join your team workspace and access shared deployments, databases, and servers."
      />

      {error && <ErrorBanner message={error} />}

      {invite && (
        <Card className="border border-white/10 p-6 space-y-6 shadow-2xl">
          <div className="flex items-center gap-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-lg">
              👥
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{invite.team.name}</h3>
              <p className="text-xs text-text-muted">
                Invited by <span className="text-white font-semibold">{invite.invitedByUser.displayName || invite.invitedByUser.email}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-white/[0.06]">
              <span className="text-text-muted">Recipient Email</span>
              <span className="font-bold text-white font-mono">{invite.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/[0.06]">
              <span className="text-text-muted">Assigned Team Role</span>
              <span className="font-bold text-indigo-300 uppercase">{invite.role}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/[0.06]">
              <span className="text-text-muted">Status</span>
              <span className="font-bold text-emerald-400 capitalize">{invite.status}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Decline / Ignore
            </Button>
            <Button onClick={handleAccept} loading={accepting}>
              Accept Invitation &amp; Join Team →
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
