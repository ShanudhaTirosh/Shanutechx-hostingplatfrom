import Link from 'next/link';
import { ShieldAlert, Lock, ArrowLeft, LogIn } from 'lucide-react';

export const metadata = {
  title: '403 — Access Denied | ShanuTechX Platform',
  robots: { index: false },
};

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center px-4 py-20 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-rose-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-6">
            <Lock className="w-10 h-10 animate-pulse" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-rose-500/10 text-rose-300 text-xs font-mono font-semibold mb-4">
            HTTP Error 403 — Access Forbidden
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Access Restricted
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
            You do not have administrative permissions or active session credentials to access this cloud resource.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-teal-500/20 hover:opacity-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Storefront</span>
            </Link>
            <a
              href="http://localhost:3001/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-medium text-sm transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Control Panel Login</span>
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-xs text-gray-500 flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Role-Based Access Control (RBAC) Enforced</span>
          </div>
        </div>
      </div>
    </main>
  );
}
