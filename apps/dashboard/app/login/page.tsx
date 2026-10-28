'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup, signInWithEmailAndPassword, GithubAuthProvider } from 'firebase/auth';
import { firebaseAuth, googleProvider, githubProvider } from '@/lib/firebaseClient';
import { ThemeProvider, ThemeToggle } from '@/components/ThemeProvider';

export const dynamic = 'force-dynamic';

// ── Provider icons ───────────────────────────────────────────────────────────
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

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

// ── OAuth button ─────────────────────────────────────────────────────────────
function OAuthButton({
  onClick,
  disabled,
  loading,
  icon,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2.5 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)';
          (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
        (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)';
      }}
    >
      {loading ? (
        <span
          className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
          style={{ borderColor: 'var(--color-border-strong)', borderTopColor: 'var(--color-accent)' }}
        />
      ) : (
        <span className="shrink-0">{icon}</span>
      )}
      <span>{loading ? 'Signing in…' : label}</span>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<'google' | 'github' | 'password' | null>(null);

  function friendly(msg: string) {
    if (msg.includes('popup-closed-by-user')) return 'Sign-in window was closed before completing.';
    if (msg.includes('account-exists-with-different-credential'))
      return 'An account already exists with this email via a different provider.';
    return msg;
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email/username and password.');
      return;
    }
    setError(null);
    setBusyProvider('password');
    try {
      let resolvedEmail = email.trim();
      if (!resolvedEmail.includes('@')) {
        resolvedEmail = `${resolvedEmail}@shanutechx.com`;
      }
      const result = await signInWithEmailAndPassword(firebaseAuth, resolvedEmail, password);
      if (result.user) {
        localStorage.setItem('stx_auth_user', JSON.stringify({
          uid: result.user.uid,
          name: result.user.displayName || result.user.email?.split('@')[0],
          email: result.user.email,
          photoURL: result.user.photoURL,
          provider: 'password',
        }));
      }
      router.push('/dashboard');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email/username or password.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again in a few moments.');
      } else {
        setError(friendly(err.message ?? 'Sign-in failed. Please verify credentials.'));
      }
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusyProvider('google');
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      if (result.user) {
        localStorage.setItem('stx_auth_user', JSON.stringify({
          uid: result.user.uid,
          name: result.user.displayName || result.user.email?.split('@')[0],
          email: result.user.email,
          photoURL: result.user.photoURL,
          provider: 'google',
        }));
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(friendly(err.message ?? 'Google sign-in failed'));
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleGithub() {
    setError(null);
    setBusyProvider('github');
    try {
      const result = await signInWithPopup(firebaseAuth, githubProvider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) localStorage.setItem('stx_github_token', credential.accessToken);
      if (result.user) {
        localStorage.setItem('stx_auth_user', JSON.stringify({
          uid: result.user.uid,
          name: result.user.displayName || result.user.email?.split('@')[0],
          email: result.user.email,
          photoURL: result.user.photoURL,
          provider: 'github',
          githubConnected: true,
        }));
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(friendly(err.message ?? 'GitHub sign-in failed'));
    } finally {
      setBusyProvider(null);
    }
  }

  const isBusy = busyProvider !== null;

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[380px] animate-scale-in">

        {/* Brand header */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            STX <span style={{ color: 'var(--color-accent)' }}>HOSTING</span>
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 space-y-5"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          {/* Heading */}
          <div className="text-center space-y-1.5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
              style={{
                background: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                border: '1px solid var(--color-success-border)',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Secure Login
            </span>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Sign in to your account
            </h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Enter your credentials or continue with OAuth SSO.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs animate-slide-down"
              style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handlePasswordLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Email or Username
              </label>
              <input
                id="login-email-input"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com or username"
                disabled={isBusy}
                autoComplete="username"
                className="w-full px-3 py-2 rounded-lg text-sm transition-all outline-none"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Password
                </label>
                <Link
                  href="/reset-password"
                  className="text-[11px] underline underline-offset-2"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Forgot?
                </Link>
              </div>
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isBusy}
                autoComplete="current-password"
                className="w-full px-3 py-2 rounded-lg text-sm transition-all outline-none"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                required
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isBusy}
              className="w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-fg, #ffffff)',
              }}
            >
              {busyProvider === 'password' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
              ) : null}
              <span>{busyProvider === 'password' ? 'Signing in…' : 'Sign In'}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-1">
            <div className="w-full border-t" style={{ borderColor: 'var(--color-border)' }} />
            <span
              className="px-2 text-[11px] uppercase tracking-wider relative shrink-0"
              style={{ background: 'var(--card-bg)', color: 'var(--color-text-faint)' }}
            >
              Or continue with SSO
            </span>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <OAuthButton
              onClick={handleGoogle}
              disabled={isBusy}
              loading={busyProvider === 'google'}
              icon={<GoogleIcon />}
              label="Continue with Google"
            />
            <OAuthButton
              onClick={handleGithub}
              disabled={isBusy}
              loading={busyProvider === 'github'}
              icon={<GithubIcon />}
              label="Continue with GitHub"
            />
          </div>

          {/* Footer note */}
          <div
            className="pt-2 border-t text-center"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <p className="text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
              Autonomous Cloud Orchestration Engine
            </p>
          </div>
        </div>

        {/* Legal */}
        <p className="text-center text-[11px] mt-5" style={{ color: 'var(--color-text-faint)' }}>
          By signing in you agree to our{' '}
          <Link
            href="/terms"
            className="underline underline-offset-2 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Terms
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-2 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <ThemeProvider>
      <LoginContent />
    </ThemeProvider>
  );
}
