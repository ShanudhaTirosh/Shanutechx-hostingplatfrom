import Link from 'next/link';
import { Compass, Home, Search, Server, Bot, Database, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

export const metadata = {
  title: '404 — Page Not Found | ShanuTechX Cloud Platform',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center px-4 py-20 relative overflow-hidden">
      {/* Background Ambient Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl w-full">
        {/* Main Glass Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          {/* Badge & Icon */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Compass className="w-4 h-4 animate-spin-slow" />
            <span>HTTP Error 404</span>
          </div>

          <h1 className="text-6xl sm:text-7xl font-extrabold bg-gradient-to-r from-teal-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4 tracking-tight">
            404
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Lost in Cloud Orbit?
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
            The page or cloud resource you are searching for does not exist, has been migrated, or the link is expired.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mb-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-teal-500/20 hover:opacity-95 transition-all hover:scale-[1.02]"
            >
              <Home className="w-4 h-4" />
              <span>Return to Storefront</span>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-medium text-sm transition-all"
            >
              <Search className="w-4 h-4" />
              <span>Explore Hosting Plans</span>
            </Link>
          </div>

          {/* Quick Navigation Cards */}
          <div className="border-t border-white/10 pt-8 text-left">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center sm:text-left">
              Popular Cloud Destinations
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/vps"
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-teal-500/30 hover:bg-teal-500/[0.05] transition-all"
              >
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                  <Server className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">VPS Compute</p>
                  <p className="text-[11px] text-gray-400 truncate">High-speed SSD VPS</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/bot-hosting"
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/[0.05] transition-all"
              >
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">Bot Hosting</p>
                  <p className="text-[11px] text-gray-400 truncate">Discord & WhatsApp</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/databases"
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/[0.05] transition-all"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                  <Database className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">Databases</p>
                  <p className="text-[11px] text-gray-400 truncate">Managed Postgres & Redis</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          {/* Sub Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-between items-center text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              ShanuTechX Enterprise Hosting
            </span>
            <Link href="/help" className="hover:text-gray-300 flex items-center gap-1 transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
              Help & Support
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

