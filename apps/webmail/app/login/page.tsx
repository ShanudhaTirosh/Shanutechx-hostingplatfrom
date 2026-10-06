'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseAuth, googleProvider, githubProvider } from '../../lib/firebaseClient';
import { signInWithPopup } from 'firebase/auth';
import { Sparkles, ShieldCheck, Mail, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';

export default function WebmailLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleOAuthSignIn = async (providerName: string, provider: any) => {
    setError(null);
    setLoadingProvider(providerName);
    try {
      await signInWithPopup(firebaseAuth, provider);
      router.push('/');
    } catch (err: any) {
      setError(err.message || `Failed to authenticate via ${providerName}`);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 relative overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-300">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <Sparkles className="w-5 h-5 fill-white/20" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-100">
            ShanuTechX <span className="text-indigo-400 font-normal">Webmail</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>OAuth Single Sign-On Enforced</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-12">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Mail className="w-3.5 h-3.5" /> Enterprise Webmail Access
            </div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Sign In to Your Inbox</h1>
            <p className="text-xs text-slate-400">
              Use your enterprise Google or GitHub identity to access your business mailboxes.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleOAuthSignIn('Google', googleProvider)}
              disabled={!!loadingProvider}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 shadow-md transition-all group disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{loadingProvider === 'Google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <button
              onClick={() => handleOAuthSignIn('GitHub', githubProvider)}
              disabled={!!loadingProvider}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 shadow-md transition-all group disabled:opacity-50"
            >
              <svg className="w-4 h-4 fill-slate-200" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>{loadingProvider === 'GitHub' ? 'Connecting to GitHub...' : 'Continue with GitHub'}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800 text-center space-y-1">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" /> Direct password forms disabled by security policy
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 z-10">
        © 2026 ShanuTechX Platform Monorepo. All rights reserved.
      </footer>
    </div>
  );
}
