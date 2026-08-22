'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { firebaseAuth, googleProvider } from '@/lib/firebaseClient';

export const dynamic = 'force-dynamic';

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading skeleton until mounted
  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-bg">
        <div className="w-full max-w-sm">
          <div className="glass rounded-2xl p-7 h-[500px] animate-pulse" />
        </div>
      </main>
    );
  }

  function friendly(msg: string) {
    if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) return 'Invalid email or password.';
    if (msg.includes('email-already-in-use')) return 'This email is already registered. Try signing in.';
    if (msg.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (msg.includes('too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
    return msg;
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
      router.push('/dashboard');
    } catch (err: any) {
      setError(friendly(err.message ?? 'Google sign-in failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      } else {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(friendly(err.message ?? 'Authentication failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address above first.');
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setInfo('Password reset email sent — check your inbox.');
    } catch (err: any) {
      setError(friendly(err.message ?? 'Failed to send reset email'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] rounded-full bg-accent-violet/15 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-accent-teal/8 blur-[80px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,10,20,0)_0%,rgba(10,10,20,0.9)_70%)]" />
      </div>

      <div className="w-full max-w-sm animate-scale-in">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="inline-flex h-9 w-9 rounded-xl bg-brand-gradient items-center justify-center shadow-glow-violet">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="font-bold text-text-primary tracking-tight">SHANUTECHX</span>
        </div>

        <div className="glass rounded-2xl p-7">
          <h1 className="text-xl font-semibold mb-0.5 text-text-primary text-center">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-text-muted text-sm mb-6 text-center">
            {mode === 'signin' ? 'Sign in to your dashboard' : 'Start hosting in minutes'}
          </p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full glass rounded-xl px-4 py-2.5 text-sm font-medium mb-5 hover:bg-white/[0.07] transition-colors disabled:opacity-50 flex items-center justify-center gap-2.5"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5 text-xs text-text-muted">
            <div className="flex-1 h-px bg-white/[0.07]" />
            or continue with email
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          <form onSubmit={handleEmailPassword} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-violet/50 focus:bg-white/[0.06] transition-colors"
            />

            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-11 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-violet/50 focus:bg-white/[0.06] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              >
                {showPwd ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><path d="M1 1l22 22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 mt-0.5"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/></svg>
                {error}
              </div>
            )}
            {info && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow-violet"
            >
              {busy && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {mode === 'signin' && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={busy}
              className="w-full text-center text-xs text-text-muted mt-3 hover:text-text-primary transition-colors"
            >
              Forgot password?
            </button>
          )}

          <div className="h-px bg-white/[0.06] mt-5 mb-4" />

          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
            className="w-full text-center text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up →"
              : '← Already have an account? Sign in'}
          </button>
        </div>

        <p className="text-center text-[10px] text-text-faint mt-6">
          By continuing you agree to our{' '}
          <a href="/terms" className="underline hover:text-text-muted transition-colors">Terms</a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-text-muted transition-colors">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
