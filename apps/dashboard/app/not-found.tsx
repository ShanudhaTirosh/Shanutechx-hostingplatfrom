import Link from 'next/link';
import { Compass, LayoutDashboard, Server, Database, Mail, HelpCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: '404 — Page Not Found | ShanuTechX Control Panel',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#090D16] text-white flex items-center justify-center px-4 py-20 relative overflow-hidden font-sans">
      {/* Glow ambient background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-semibold uppercase tracking-wider mb-6">
            <Compass className="w-4 h-4 animate-spin-slow" />
            <span>Dashboard 404 — Unknown Route</span>
          </div>

          <h1 className="text-6xl sm:text-7xl font-extrabold bg-gradient-to-r from-indigo-300 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-4 tracking-tight">
            404
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Dashboard Route Not Found
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
            The requested control panel endpoint or resource module does not exist or has been moved.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-indigo-500/20 hover:opacity-95 transition-all hover:scale-[1.02]"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Back to Control Panel</span>
            </Link>
          </div>

          {/* Quick Hub Navigation */}
          <div className="border-t border-white/10 pt-8 text-left">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center sm:text-left">
              Quick Control Panel Modules
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/services"
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/[0.05] transition-all"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Server className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">Services</p>
                  <p className="text-[11px] text-gray-400 truncate">Containers & Deployments</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/databases"
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/[0.05] transition-all"
              >
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <Database className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">Databases</p>
                  <p className="text-[11px] text-gray-400 truncate">Managed Clusters & Supabase</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/webmail"
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-teal-500/30 hover:bg-teal-500/[0.05] transition-all"
              >
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">Enterprise Mail</p>
                  <p className="text-[11px] text-gray-400 truncate">Webmail & SMTP</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-between items-center text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              ShanuTechX Autonomous Orchestrator
            </span>
            <Link href="/tickets" className="hover:text-gray-300 flex items-center gap-1 transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
              Support Desk
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

