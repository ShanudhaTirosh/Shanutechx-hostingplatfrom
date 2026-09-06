'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  GithubAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { firebaseAuth, googleProvider, githubProvider } from '@/lib/firebaseClient';
import { Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<'google' | 'github' | 'email' | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#070818]">
        <div className="w-full max-w-sm">
          <div className="bg-white/5 rounded-3xl p-8 h-[420px] animate-pulse" />
        </div>
      </main>
    );
  }

  function friendly(msg: string) {
    if (msg.includes('popup-closed-by-user')) return 'Sign-in window closed before completing authentication.';
    if (msg.includes('account-exists-with-different-credential'))
      return 'An account already exists with the same email using a different provider.';
    if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
      return 'Invalid email address or password.';
    if (msg.includes('email-already-in-use')) return 'An account with this email address already exists.';
    if (msg.includes('weak-password')) return 'Password should be at least 6 characters long.';
    return msg;
  }

  async function handleGoogle() {
    setError(null);
    setSuccess(null);
    setBusyProvider('google');
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      if (result.user) {
        localStorage.setItem(
          'stx_auth_user',
          JSON.stringify({
            uid: result.user.uid,
            name: result.user.displayName || result.user.email?.split('@')[0],
            email: result.user.email,
            photoURL: result.user.photoURL,
            provider: 'google',
          })
        );
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
    setSuccess(null);
    setBusyProvider('github');
    try {
      const result = await signInWithPopup(firebaseAuth, githubProvider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        localStorage.setItem('stx_github_token', token);
      }

      if (result.user) {
        localStorage.setItem(
          'stx_auth_user',
          JSON.stringify({
            uid: result.user.uid,
            name: result.user.displayName || result.user.email?.split('@')[0],
            email: result.user.email,
            photoURL: result.user.photoURL,
            provider: 'github',
            githubConnected: true,
          })
        );
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(friendly(err.message ?? 'GitHub sign-in failed'));
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setBusyProvider('email');

    try {
      if (authMode === 'signin') {
        if (!password) {
          setError('Please enter your password');
          setBusyProvider(null);
          return;
        }
        const userCred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        localStorage.setItem(
          'stx_auth_user',
          JSON.stringify({
            uid: userCred.user.uid,
            name: userCred.user.displayName || userCred.user.email?.split('@')[0],
            email: userCred.user.email,
            provider: 'password',
          })
        );
        router.push('/dashboard');
      } else if (authMode === 'signup') {
        if (!password || password.length < 6) {
          setError('Password must be at least 6 characters long');
          setBusyProvider(null);
          return;
        }
        const userCred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        
        // Register in API to trigger database record & welcome email
        try {
          await apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              email: email.trim(),
              password,
              name: name.trim() || email.trim().split('@')[0],
              firebaseUid: userCred.user.uid,
            }),
          });
        } catch {
          // Sync fallback
        }

        localStorage.setItem(
          'stx_auth_user',
          JSON.stringify({
            uid: userCred.user.uid,
            name: name.trim() || userCred.user.email?.split('@')[0],
            email: userCred.user.email,
            provider: 'password',
          })
        );
        router.push('/dashboard');
      } else if (authMode === 'forgot') {
        // Send Firebase Password Reset
        try {
          await sendPasswordResetEmail(firebaseAuth, email.trim());
        } catch {
          // Fallback through backend API
        }

        // Also trigger backend password reset notification
        try {
          await apiFetch('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: email.trim() }),
          });
        } catch {
          // Fallback
        }

        setSuccess('Password reset link sent! Check your email inbox for instructions.');
      }
    } catch (err: any) {
      setError(friendly(err.message ?? 'Authentication failed'));
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#060719] font-sans selection:bg-purple-500 selection:text-white py-12">
      {/* Background Ambient Orbs & Grids */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />
      </div>

      <div className="w-full max-w-sm animate-scale-in">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <img
            src="/STX.png"
            alt="STX HOSTING Logo"
            className="w-10 h-10 max-w-[40px] max-h-[40px] shrink-0 rounded-xl object-contain shadow-[0_0_20px_rgba(16,185,129,0.5)]"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <span className="font-extrabold text-xl text-white tracking-tight">
            SHANUTECHX <span className="text-emerald-400 font-bold">.CLOUD</span>
          </span>
        </div>

        {/* Login Card */}
        <div className="bg-[#090b22]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.15)] space-y-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 text-center text-xs font-bold">
            <button
              onClick={() => { setAuthMode('signin'); setError(null); setSuccess(null); }}
              className={`py-2 rounded-xl transition-all ${authMode === 'signin' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setError(null); setSuccess(null); }}
              className={`py-2 rounded-xl transition-all ${authMode === 'signup' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); }}
              className={`py-2 rounded-xl transition-all ${authMode === 'forgot' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Reset
            </button>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-black text-white tracking-tight">
              {authMode === 'signin' && 'Welcome Back'}
              {authMode === 'signup' && 'Create Cloud Account'}
              {authMode === 'forgot' && 'Reset Your Password'}
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              {authMode === 'signin' && 'Sign in to access your servers and deployments'}
              {authMode === 'signup' && 'Deploy applications, VPS nodes & managed databases'}
              {authMode === 'forgot' && 'Enter your email to receive a password reset link'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {authMode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </div>

            {authMode !== 'forgot' && (
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            )}

            {authMode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setError(null); setSuccess(null); }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busyProvider !== null}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50"
            >
              {busyProvider === 'email' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <span>
                    {authMode === 'signin' && 'Sign In with Email'}
                    {authMode === 'signup' && 'Create Account'}
                    {authMode === 'forgot' && 'Send Reset Email'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">OR CONTINUE WITH</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Social Provider Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Continue with Google */}
            <button
              onClick={handleGoogle}
              disabled={busyProvider !== null}
              className="py-2.5 px-3 rounded-2xl bg-white/5 border border-white/15 hover:bg-white/10 hover:border-purple-500/40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {busyProvider === 'google' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span>Google</span>
            </button>

            {/* Continue with GitHub */}
            <button
              onClick={handleGithub}
              disabled={busyProvider !== null}
              className="py-2.5 px-3 rounded-2xl bg-[#24292e] border border-white/20 hover:bg-[#2f363d] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {busyProvider === 'github' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <GithubIcon />
              )}
              <span>GitHub</span>
            </button>
          </div>

          <div className="pt-2 text-center border-t border-white/10">
            <p className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
              Autonomous Cloud Orchestration Engine
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6 font-sans">
          By signing in you agree to ShanuTechX Cloud{' '}
          <Link href="/terms" className="underline hover:text-white transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-white transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
