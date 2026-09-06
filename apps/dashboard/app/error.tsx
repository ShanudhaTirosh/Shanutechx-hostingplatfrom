'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, LayoutDashboard, Activity, ChevronDown, ChevronUp, Copy, Check, ShieldAlert } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('Dashboard Error Boundary Caught:', error);
  }, [error]);

  const copyDigest = () => {
    const textToCopy = error.digest || error.message || 'Unknown error';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="bg-[#0D1322]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center max-w-xl w-full shadow-2xl relative overflow-hidden text-white">
        {/* Glow orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-6">
            <AlertTriangle className="w-10 h-10 animate-pulse" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-mono font-semibold mb-4">
            Dashboard System Exception
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-3">
            Something Went Wrong
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
            An unexpected error occurred rendering this control panel module. Try refreshing or returning to overview.
          </p>

          {/* Diagnostic Info */}
          {error.digest && (
            <div className="mb-8 bg-black/50 rounded-2xl border border-white/10 p-4 text-left">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-amber-400 font-semibold truncate">
                  Digest Ref: {error.digest}
                </span>
                <button
                  onClick={copyDigest}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Digest</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 pt-2 border-t border-white/5"
              >
                <span>Diagnostic Stack & Message</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showDetails && (
                <pre className="mt-3 p-3 bg-black/70 rounded-xl text-[11px] font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap break-all border border-rose-500/20 max-h-40 overflow-y-auto">
                  {error.message || error.stack || 'No stack trace provided.'}
                </pre>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm shadow-lg shadow-amber-500/20 hover:opacity-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Action</span>
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-medium text-sm transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Back to Overview</span>
            </Link>
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-between items-center text-xs text-gray-400">
            <Link href="/status" className="hover:text-amber-400 flex items-center gap-1 transition-colors">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              System Status
            </Link>
            <span className="flex items-center gap-1 text-gray-500">
              <ShieldAlert className="w-3.5 h-3.5" />
              Error Boundary Monitored
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

