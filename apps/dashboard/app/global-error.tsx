'use client';

import { useEffect } from 'react';
import './globals.css';
import { AlertOctagon, RefreshCw, LayoutDashboard } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Dashboard Global Error caught:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#090D16] text-white min-h-screen flex items-center justify-center p-4 font-sans antialiased">
        <main className="relative z-10 max-w-lg w-full">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/15 rounded-full blur-[140px] pointer-events-none" />

          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 text-center shadow-2xl relative">
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-6">
              <AlertOctagon className="w-10 h-10 animate-pulse" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-mono font-semibold mb-4">
              Dashboard Root Fatal Error
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Control Panel Crash
            </h1>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              A critical exception occurred in the control panel layout engine.
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => reset()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium text-sm shadow-lg shadow-rose-500/20 hover:opacity-95 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset Application</span>
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-medium text-sm transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

