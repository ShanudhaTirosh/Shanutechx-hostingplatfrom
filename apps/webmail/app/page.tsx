'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { firebaseAuth } from '../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { WebmailLayout } from '../components/WebmailLayout';
import { Mail, Loader2, ShieldCheck } from 'lucide-react';

function WebmailLoadingScreen({ status = 'Loading Webmail...' }: { status?: string }) {
  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6 text-white font-sans selection:bg-white selection:text-black relative overflow-hidden">
      {/* Ambient background glow & subtle grid */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Centerpiece Loading Container */}
      <div className="z-10 flex flex-col items-center text-center space-y-5 max-w-sm w-full p-8 rounded-3xl bg-[#171717] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl relative overflow-hidden">
        {/* Top subtle highlight */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

        {/* Animated Brand Emblem with Rotating Radar Ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-3xl border border-white/15 animate-spin [animation-duration:10s] pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] border border-white/10 p-3 flex items-center justify-center shadow-xl relative z-10">
            <img
              src="/STX.png"
              alt="STX Webmail"
              className="w-full h-full object-contain filter brightness-0 invert"
            />
          </div>
        </div>

        {/* Brand Title & Subtitle */}
        <div className="space-y-1">
          <h2 className="text-base font-bold tracking-tight text-white">
            STX <span className="text-neutral-400 font-medium">Webmail</span>
          </h2>
          <p className="text-[11px] text-neutral-400 font-medium tracking-wide">
            Autonomous Enterprise Mailbox Studio
          </p>
        </div>

        {/* Shimmer Progress Track */}
        <div className="w-56 h-1.5 bg-black/80 border border-white/10 rounded-full overflow-hidden relative">
          <div className="w-24 h-full bg-gradient-to-r from-transparent via-white to-transparent rounded-full animate-shimmer" />
        </div>

        {/* Dynamic Status Text */}
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{status}</span>
        </div>

        {/* Security Badge */}
        <div className="pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a0a0a] border border-white/10 text-[10px] text-neutral-400 font-medium">
            <ShieldCheck className="w-3 h-3 text-neutral-300" />
            <span>TLS 1.3 Encrypted Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoToken = searchParams.get('ssoToken');
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('Authenticating Enterprise Session...');

  useEffect(() => {
    let isCancelled = false;

    async function initAuth() {
      // 1. SSO Token in URL params
      if (ssoToken) {
        setAuthStatus('Exchanging Single Sign-On Ticket...');
        try {
          const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
          const res = await fetch(`${apiUrl}/api/webmail/auth/sso-exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssoToken }),
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data?.ok && data.token) {
            localStorage.setItem('webmail_token', data.token);
            // Clean up ssoToken parameter from browser address bar
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            if (!isCancelled) {
              setLoading(false);
            }
            return;
          }
        } catch {
          // Fallback to existing session
        }
      }

      // 2. Existing valid webmail_token in localStorage
      if (typeof window !== 'undefined') {
        const cachedToken = localStorage.getItem('webmail_token');
        if (cachedToken) {
          if (!isCancelled) setLoading(false);
          return;
        }
      }

      // 3. Fallback to Firebase Auth
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (!isCancelled) {
          if (!user) {
            router.push('/login');
          } else {
            setLoading(false);
          }
        }
      });

      return unsubscribe;
    }

    const p = initAuth();
    return () => {
      isCancelled = true;
      p.then((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [router, ssoToken]);

  if (loading) {
    return <WebmailLoadingScreen status={authStatus} />;
  }

  return <WebmailLayout />;
}

export default function WebmailPage() {
  return (
    <Suspense fallback={<WebmailLoadingScreen status="Initializing Webmail Studio..." />}>
      <WebmailContent />
    </Suspense>
  );
}
