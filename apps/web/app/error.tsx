'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, Activity, MessageSquare, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('Storefront error boundary caught:', error);
  }, [error]);

  const copyErrorDigest = () => {
    const textToCopy = error.digest || error.message || 'Unknown error';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center px-4 py-20 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          {/* Animated Warning Icon */}
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-6 shadow-inner">
            <AlertTriangle className="w-10 h-10 animate-bounce" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-mono font-semibold mb-4">
            HTTP 500 — Internal Application Error
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
            Something Went Wrong
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
            An unexpected error occurred while processing your request. Our platform engineering team has been notified.
          </p>

          {/* Error Digest / Diagnostic Info */}
          {error.digest && (
            <div className="mb-8 bg-black/40 rounded-2xl border border-white/10 p-4 text-left">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-amber-400/90 font-semibold">
                  Error Reference ID: {error.digest}
                </span>
                <button
                  onClick={copyErrorDigest}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 pt-2 border-t border-white/5"
              >
                <span>Technical Stack Trace & Details</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDetails && (
                <pre className="mt-3 p-3 bg-black/60 rounded-xl text-[11px] font-mono text-rose-300/90 overflow-x-auto whitespace-pre-wrap break-all border border-rose-500/20 max-h-48 overflow-y-auto">
                  {process.env.NODE_ENV === 'development'
                    ? (error.message || error.stack || 'No extended stack trace available.')
                    : 'An internal application error occurred. Please report the error reference ID to support.'}
                </pre>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm shadow-lg shadow-amber-500/20 hover:opacity-95 transition-all hover:scale-[1.02]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-medium text-sm transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Return Home</span>
            </Link>
          </div>

          {/* Sub Navigation Links */}
          <div className="pt-6 border-t border-white/10 flex flex-wrap justify-center gap-6 text-xs text-gray-400">
            <Link href="/status" className="inline-flex items-center gap-1.5 hover:text-amber-400 transition-colors">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Check Live Platform Status
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-1.5 hover:text-amber-400 transition-colors">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              Report Issue to Support
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

