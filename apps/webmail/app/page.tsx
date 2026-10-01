'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseAuth } from '../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { WebmailLayout } from '../components/WebmailLayout';
import { Sparkles, Loader2 } from 'lucide-react';

export default function WebmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 animate-pulse">
          <Sparkles className="w-6 h-6 fill-white/20" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Authenticating Enterprise Session...</span>
        </div>
      </div>
    );
  }

  return <WebmailLayout />;
}
