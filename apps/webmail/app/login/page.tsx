'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseAuth, googleProvider, githubProvider } from '../../lib/firebaseClient';
import { signInWithPopup } from 'firebase/auth';
import { ShieldCheck, Lock, CheckCircle2, Globe, Server, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';

export default function WebmailLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleOAuthSignIn = async (providerName: string, provider: any) => {
    setError(null);
    setLoadingProvider(providerName);
    try {
      await signInWithPopup(firebaseAuth, provider);
      // Fetch authenticated user profile to verify role
      const meData = await api.auth.me().catch(() => null);
      const userRole = meData?.user?.role;
      if (userRole === 'admin') {
        await firebaseAuth.signOut();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('webmail_token');
        }
        setError('Access Denied: Admin accounts do not have access to Webmail. Webmail is reserved for customer mailboxes and developer superusers.');
        setLoadingProvider(null);
        return;
      }
      router.push('/');
    } catch (err: any) {
      if (err.message && err.message.includes('Admin')) {
        setError(err.message);
      } else {
        setError(err.message || `Failed to authenticate via ${providerName}`);
      }
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* Subtle Monochrome Ambient Spotlight & Grid */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Top Header */}
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#171717] p-1.5 flex items-center justify-center border border-white/10 shadow-md backdrop-blur-sm">
            <img
              src="/STX.png"
              alt="STX Webmail"
              className="w-full h-full object-contain filter brightness-0 invert"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-white">
              STX <span className="text-neutral-400 font-medium">Webmail</span>
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#171717] border border-white/10 text-[10px] font-mono font-medium text-neutral-400">
              v2.6 Enterprise
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 bg-[#171717] border border-white/10 px-3 py-1.5 rounded-full text-neutral-400 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-neutral-300">All Systems Operational</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-300 bg-[#171717] border border-white/10 px-3 py-1.5 rounded-full shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            <span className="text-[11px] font-semibold">SSO Enforced</span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto z-10 py-6 sm:py-10">
        <div className="bg-[#171717] border border-white/10 rounded-3xl p-7 sm:p-9 shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-2xl space-y-6 relative overflow-hidden">
          {/* Top subtle ambient highlight line */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#0a0a0a] border border-white/15 p-2.5 flex items-center justify-center shadow-xl mx-auto">
              <img
                src="/STX.png"
                alt="STX Webmail"
                className="w-full h-full object-contain filter brightness-0 invert"
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">Sign In to STX Webmail</h1>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                Autonomous business email workspace & secure enterprise mailbox engine.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-3 pt-1">
            <button
              onClick={() => handleOAuthSignIn('Google', googleProvider)}
              disabled={!!loadingProvider}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#0a0a0a] hover:bg-white hover:text-black border border-white/10 hover:border-white rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-[0.98] group disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0 transition-colors" viewBox="0 0 24 24">
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
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#0a0a0a] hover:bg-white hover:text-black border border-white/10 hover:border-white rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-[0.98] group disabled:opacity-50"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>{loadingProvider === 'GitHub' ? 'Connecting to GitHub...' : 'Continue with GitHub'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 text-center space-y-1.5">
            <div className="p-3 rounded-2xl bg-[#0a0a0a] border border-white/10 text-[11px] text-neutral-400 space-y-1 text-left">
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Single Sign-On (SSO) Enforced</span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-normal">
                Direct password forms are disabled by platform security policy. Authentication is safely tied to verified OAuth identities.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Row */}
        <div className="grid grid-cols-3 gap-2 pt-6 text-center text-[10px] text-neutral-400">
          <div className="p-2.5 rounded-2xl bg-[#171717] border border-white/10 flex flex-col items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-white" />
            <span className="font-semibold text-white">DKIM & SPF</span>
            <span className="text-[9px] text-neutral-500">100% Verified</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-[#171717] border border-white/10 flex flex-col items-center gap-1">
            <Globe className="w-4 h-4 text-white" />
            <span className="font-semibold text-white">Multi-Domain</span>
            <span className="text-[9px] text-neutral-500">Unlimited Aliases</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-[#171717] border border-white/10 flex flex-col items-center gap-1">
            <Lock className="w-4 h-4 text-white" />
            <span className="font-semibold text-white">AES-256 Vault</span>
            <span className="text-[9px] text-neutral-500">Encrypted Storage</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-neutral-500 z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5 pt-4">
        <span>© 2026 ShanuTechX Platform. All rights reserved.</span>
        <div className="flex items-center gap-4 text-neutral-400 text-[11px]">
          <span>RFC 9116 Compliant</span>
          <span>•</span>
          <span>Zero-Trust Infrastructure</span>
        </div>
      </footer>
    </div>
  );
}
