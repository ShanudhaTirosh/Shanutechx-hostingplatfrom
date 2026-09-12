'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GithubAuthProvider } from 'firebase/auth';
import { firebaseAuth, googleProvider, githubProvider, discordProvider } from '@/lib/firebaseClient';
import { ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<'google' | 'github' | 'discord' | null>(null);
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
      return 'An account already exists with the same email using a different OAuth provider.';
    return msg;
  }

  async function handleGoogle() {
    setError(null);
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
      setError(friendly(err.message ?? 'Google OAuth sign-in failed'));
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
      setError(friendly(err.message ?? 'GitHub OAuth sign-in failed'));
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleDiscord() {
    setError(null);
    setBusyProvider('discord');
    try {
      const result = await signInWithPopup(firebaseAuth, discordProvider);
      if (result.user) {
        localStorage.setItem(
          'stx_auth_user',
          JSON.stringify({
            uid: result.user.uid,
            name: result.user.displayName || result.user.email?.split('@')[0],
            email: result.user.email,
            photoURL: result.user.photoURL,
            provider: 'discord',
          })
        );
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(friendly(err.message ?? 'Discord OAuth sign-in failed'));
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#060719] font-sans selection:bg-purple-500 selection:text-white py-12">
      {/* Background Ambient Orbs */}
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
        <div className="bg-[#090b22]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.15)] space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold tracking-wide uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              OAuth SSO Standard
            </span>
            <h1 className="text-xl font-black text-white tracking-tight">Sign In to ShanuTechX</h1>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Platform security requires Single Sign-On (SSO) exclusively via verified Google, GitHub, or Discord accounts.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Exclusive Social OAuth Buttons */}
          <div className="space-y-3 pt-2">
            {/* Continue with Google */}
            <button
              onClick={handleGoogle}
              disabled={busyProvider !== null}
              className="w-full py-3 px-4 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 hover:border-emerald-500/50 text-white font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50"
            >
              {busyProvider === 'google' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Continue with GitHub */}
            <button
              onClick={handleGithub}
              disabled={busyProvider !== null}
              className="w-full py-3 px-4 rounded-2xl bg-[#24292e] border border-white/20 hover:bg-[#2f363d] hover:border-purple-500/50 text-white font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50"
            >
              {busyProvider === 'github' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <GithubIcon />
                  <span>Continue with GitHub</span>
                </>
              )}
            </button>

            {/* Continue with Discord */}
            <button
              onClick={handleDiscord}
              disabled={busyProvider !== null}
              className="w-full py-3 px-4 rounded-2xl bg-[#5865F2] border border-white/20 hover:bg-[#4752C4] hover:border-indigo-400/50 text-white font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50"
            >
              {busyProvider === 'discord' ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <DiscordIcon />
                  <span>Continue with Discord</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-4 text-center border-t border-white/10">
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


