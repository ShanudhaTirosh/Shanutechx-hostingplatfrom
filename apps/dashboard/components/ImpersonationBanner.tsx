'use client';

import { useEffect, useState } from 'react';

export function ImpersonationBanner() {
  const [impersonatedUser, setImpersonatedUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    const updateFromStorage = () => {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem('stx_impersonate_user_id');
      const email = localStorage.getItem('stx_impersonate_user_email');
      if (raw) {
        setImpersonatedUser({ id: raw, email: email || raw });
      } else {
        setImpersonatedUser(null);
      }
    };

    updateFromStorage();
    window.addEventListener('storage', updateFromStorage);
    return () => window.removeEventListener('storage', updateFromStorage);
  }, []);

  if (!impersonatedUser) return null;

  const handleExit = () => {
    localStorage.removeItem('stx_impersonate_user_id');
    localStorage.removeItem('stx_impersonate_user_email');
    window.location.reload();
  };

  return (
    <div
      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium tracking-wide animate-fade-in mb-4 rounded-xl"
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.25) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        color: '#f59e0b',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)',
      }}
    >
      <div className="flex items-center gap-2">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>
          <strong>Admin Impersonation Mode Active:</strong> Viewing client area for{' '}
          <span className="font-semibold text-amber-200 underline underline-offset-2">{impersonatedUser.email}</span>
        </span>
      </div>
      <button
        onClick={handleExit}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors border border-amber-500/40"
      >
        Exit Impersonation
      </button>
    </div>
  );
}
