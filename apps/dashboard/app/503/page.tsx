import Link from 'next/link';
import { Server, Activity, RefreshCw, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: '503 — Node Maintenance | ShanuTechX Control Panel',
  robots: { index: false },
};

export default function DashboardMaintenancePage() {
  return (
    <main className="min-h-screen bg-[#090D16] text-white flex items-center justify-center px-4 py-20 relative overflow-hidden font-sans">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-6">
            <Server className="w-10 h-10 animate-pulse" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 text-xs font-mono font-semibold mb-4">
            Dashboard 503 — VPS Host Node Sync
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-3">
            Host Node Offline or Syncing
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
            The background Node Agent or Docker Engine daemon for this host node is performing automated health checks or system maintenance.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/status"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all"
            >
              <Activity className="w-4 h-4" />
              <span>Node Telemetry Status</span>
            </Link>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-medium text-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Dashboard</span>
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-xs text-gray-500 flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Automatic failover enabled across registered compute nodes</span>
          </div>
        </div>
      </div>
    </main>
  );
}
