import Link from 'next/link';
import { Bot, ArrowLeft, Terminal, ShieldCheck, Sparkles, MessageSquare } from 'lucide-react';

export const metadata = {
  title: 'Bot Instance Not Found — ShanuTechX Bot Hosting',
  robots: { index: false },
};

export default function BotNotFound() {
  return (
    <main className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center px-4 py-20 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-6">
            <Bot className="w-10 h-10 animate-bounce" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 text-xs font-mono font-semibold mb-4">
            Bot Hosting Engine 404
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Bot Instance Not Found
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
            The requested Discord, WhatsApp, or Telegram bot deployment does not exist or has been terminated.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <Link
              href="/bot-hosting"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all"
            >
              <Bot className="w-4 h-4" />
              <span>Deploy New Bot</span>
            </Link>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-medium text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Browse App Templates</span>
            </Link>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-wrap justify-between items-center text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              24/7 Node Agent Daemon Monitoring
            </span>
            <Link href="/discord" className="hover:text-cyan-300 flex items-center gap-1 transition-colors">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              Discord Support
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
