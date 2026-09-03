'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  GithubAuthProvider,
} from 'firebase/auth';
import { firebaseAuth, googleProvider, githubProvider } from '@/lib/firebaseClient';

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
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<'google' | 'github' | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#070818]">
        <div className="w-full max-w-sm">
          <div className="bg-white/5 rounded-3xl p-8 h-[380px] animate-pulse" />
        </div>
      </main>
    );
  }

  function friendly(msg: string) {
    if (msg.includes('popup-closed-by-user')) return 'Sign-in window closed before completing authentication.';
    if (msg.includes('account-exists-with-different-credential'))
      return 'An account already exists with the same email using a different provider.';
    return msg;
  }

  async function handleGoogle() {
    setError(null);
    setBusyProvider('google');
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      if (result.user) {
        // Cache provider session info
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
    setBusyProvider('github');
    try {
      const result = await signInWithPopup(firebaseAuth, githubProvider);

      // Extract GitHub access token directly so user doesn't need to connect repositories separately!
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

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#060719] font-sans selection:bg-purple-500 selection:text-white">
      {/* Background Ambient Orbs & Grids */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />
      </div>

      <div className="w-full max-w-sm animate-scale-in">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <span className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-[0_0_20px_rgba(16,185,129,0.5)]">
            STX
          </span>
          <span className="font-extrabold text-xl text-white tracking-tight">
            SHANUTECHX <span className="text-emerald-400 font-bold">.CLOUD</span>
          </span>
        </div>

        {/* Login Card */}
        <div className="bg-[#090b22]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.15)] space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-white tracking-tight">Sign In / Sign Up</h1>
            <p className="text-xs text-slate-400 font-sans">
              Choose your OAuth identity provider to access control panel
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 mt-0.5">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Social Provider Buttons ONLY */}
          <div className="space-y-3.5 pt-2">
            {/* Continue with Google */}
            <button
              onClick={handleGoogle}
              disabled={busyProvider !== null}
              className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/15 hover:bg-white/10 hover:border-purple-500/40 text-white font-extrabold text-xs flex items-center justify-center gap-3 transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50"
            >
              {busyProvider === 'google' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span>Continue with Google</span>
            </button>

            {/* Continue with GitHub */}
            <button
              onClick={handleGithub}
              disabled={busyProvider !== null}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#24292e] border border-white/20 hover:bg-[#2f363d] text-white font-extrabold text-xs flex items-center justify-center gap-3 transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50 shadow-[0_0_20px_rgba(36,41,46,0.5)]"
            >
              {busyProvider === 'github' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <GithubIcon />
              )}
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div className="pt-2 text-center border-t border-white/10">
            <p className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Instant Repository &amp; Container Access Granted
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6 font-sans">
          By signing in you agree to ShanuTechX Cloud{' '}
          <a href="/terms" className="underline hover:text-white transition-colors">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-white transition-colors">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
