'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { firebaseAuth } from '../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { WebmailLayout } from '../components/WebmailLayout';
import { Sparkles, Loader2 } from 'lucide-react';

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
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 animate-pulse">
          <Sparkles className="w-6 h-6 fill-white/20" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>{authStatus}</span>
        </div>
      </div>
    );
  }

  return <WebmailLayout />;
}

export default function WebmailPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100 font-sans">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 animate-pulse">
            <Sparkles className="w-6 h-6 fill-white/20" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Loading Webmail...</span>
          </div>
        </div>
      }
    >
      <WebmailContent />
    </Suspense>
  );
}
