'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth, googleProvider } from '@/lib/firebaseClient';
import { PageHeader, Card, Spinner, ErrorBanner, Button, useToast } from '@/components/ui';
import { api } from '@/lib/api';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function AcceptTeamInvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [invite, setInvite] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided in URL link.');
      setLoading(false);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    fetch(`${apiBase}/api/teams/public/invites/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid or expired invitation token');
        return res.json();
      })
      .then((data) => setInvite(data))
      .catch((err) => {
        // Fallback to authenticated endpoint if API client is logged in
        api.teams
          .getInvite(token)
          .then((d) => setInvite(d.invite))
          .catch((e) => setError(e.message || err.message));
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleClaimInvite() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      await api.teams.acceptInvite(token);
      toast('Successfully joined team workspace!', 'success');
      router.push('/settings?tab=team');
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
      toast(err.message || 'Failed to accept invitation', 'error');
    } finally {
      setAccepting(false);
    }
  }

  async function handleGoogleLogin() {
    setAuthBusy(true);
    setError(null);
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
      toast('Signed in with Google! Claiming team invitation...', 'success');
      await handleClaimInvite();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setError(null);
    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      } else {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      }
      toast('Account ready! Claiming invitation...', 'success');
      await handleClaimInvite();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setAuthBusy(false);
    }
  }

  if (loading) return <Spinner label="Verifying team invitation token..." />;

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6 animate-fade-in font-sans">
      <PageHeader
        title="Accept Team Invitation"
        description="Join your team workspace and access shared deployments, databases, and VPS servers."
      />

      {error && <ErrorBanner message={error} />}

      {invite && (
        <Card className="border border-white/10 p-6 space-y-6 shadow-2xl bg-bg-card/80 backdrop-blur-xl">
          <div className="flex items-center gap-4 bg-white/5 border border-white/15 rounded-2xl p-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-neutral-800 to-black text-white font-bold flex items-center justify-center shrink-0 shadow-md">
              <TeamIcon />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">{invite.teamName || invite.team?.name}</h3>
              <p className="text-xs text-text-muted">
                Invited by <span className="text-white font-semibold">{invite.inviterName || invite.invitedByUser?.displayName || invite.invitedByUser?.email}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-white/[0.06]">
              <span className="text-text-muted">Target Recipient</span>
              <span className="font-bold text-white font-mono">{invite.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/[0.06]">
              <span className="text-text-muted">Assigned Team Role</span>
              <span className="font-bold text-neutral-300 uppercase tracking-wider">{invite.role}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/[0.06]">
              <span className="text-text-muted">Invitation Status</span>
              <span className="font-bold text-emerald-400 capitalize">{invite.status}</span>
            </div>
          </div>

          {/* If user is logged in */}
          {currentUser ? (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-300 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Currently logged in as:</p>
                  <p className="font-mono text-emerald-400">{currentUser.email}</p>
                </div>
                <Button size="sm" onClick={handleClaimInvite} loading={accepting}>
                  Accept Invitation →
                </Button>
              </div>

              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => firebaseAuth.signOut()}>
                  Sign in as different account
                </Button>
              </div>
            </div>
          ) : (
            /* If user is logged out / has no account */
            <div className="space-y-4 pt-2 border-t border-white/[0.08]">
              <p className="text-xs text-text-muted text-center font-medium">
                To accept this invitation and join <strong className="text-white">{invite.teamName || invite.team?.name}</strong>, sign in with your account or sign up below:
              </p>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authBusy}
                className="w-full glass rounded-xl px-4 py-3 text-sm font-semibold hover:bg-white/[0.08] transition-all disabled:opacity-50 flex items-center justify-center gap-2.5 border border-white/10 shadow-lg"
              >
                <GoogleIcon />
                Sign in with Google to Accept
              </button>

              <div className="flex items-center gap-3 my-3 text-xs text-text-muted">
                <div className="flex-1 h-px bg-white/[0.07]" />
                or sign in with email
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email || invite.email || ''}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-text-muted focus:outline-none focus:border-white/30 transition-colors"
                />

                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-text-muted focus:outline-none focus:border-white/30 transition-colors"
                />

                <Button type="submit" className="w-full" loading={authBusy}>
                  {authMode === 'signin' ? 'Sign In & Join Team →' : 'Create Account & Join Team →'}
                </Button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  className="text-xs text-text-muted hover:text-white transition-colors"
                >
                  {authMode === 'signin' ? "Don't have an account? Sign up with email →" : '← Already have an account? Sign in'}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
