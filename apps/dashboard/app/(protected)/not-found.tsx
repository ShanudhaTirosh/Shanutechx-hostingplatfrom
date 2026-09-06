import Link from 'next/link';
import { Compass, LayoutDashboard, Server, Database, Box, HelpCircle } from 'lucide-react';

export default function ProtectedNotFound() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-[#0D1322]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
        {/* Glow orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-semibold uppercase mb-4">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" />
            <span>Protected Route 404</span>
          </div>

          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-indigo-300 via-cyan-300 to-teal-300 bg-clip-text text-transparent mb-3">
            Resource Not Found
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
            This module or workspace endpoint doesn't exist, or you don't have active permissions to view it.
          </p>

          <div className="flex justify-center mb-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Back to Overview</span>
            </Link>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-6 text-left">
            <Link
              href="/services"
              className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.04] transition-all flex items-center gap-3"
            >
              <Server className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-xs font-semibold text-white">Active Services</p>
                <p className="text-[11px] text-gray-400">View docker instances</p>
              </div>
            </Link>

            <Link
              href="/databases"
              className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all flex items-center gap-3"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-xs font-semibold text-white">Managed DBs</p>
                <p className="text-[11px] text-gray-400">Postgres & Supabase</p>
              </div>
            </Link>

            <Link
              href="/support"
              className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-teal-500/30 hover:bg-white/[0.04] transition-all flex items-center gap-3"
            >
              <HelpCircle className="w-4 h-4 text-teal-400" />
              <div>
                <p className="text-xs font-semibold text-white">Support Desk</p>
                <p className="text-[11px] text-gray-400">Open ticket</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

