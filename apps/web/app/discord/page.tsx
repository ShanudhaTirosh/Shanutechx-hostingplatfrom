import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { MessageSquare, Users, ShieldCheck, Zap, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Official Discord Community & Support | ShanuTechX Cloud',
  description: 'Join our official Discord community for 24/7 technical support, release updates, and community drops.',
};

export default function DiscordPage() {
  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#7c3aed26_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 pt-32 pb-24 space-y-12 text-center relative z-10 w-full">
        <div className="relative text-center space-y-6 pt-6">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.85} glowColor="rgba(88, 101, 242, 0.75)" />
          </div>

          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <div className="h-20 w-20 rounded-3xl bg-[#5865F2]/20 border border-[#5865F2]/40 mx-auto flex items-center justify-center text-[#5865F2] shadow-glow-violet">
              <MessageSquare className="h-10 w-10" />
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Join Our <span className="text-[#5865F2]">Discord Community</span>
            </h1>

            <p className="text-sm text-text-muted leading-relaxed">
              Connect directly with our engineering staff, get instant help with bot hosting or VPS deployments, and participate in exclusive community giveaways.
            </p>

            <div className="pt-4">
              <a
                href="https://discord.gg/shanutechx"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-extrabold text-sm shadow-glow-violet transition-all hover:scale-105"
              >
                Connect on Discord Now <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 pt-8 text-left">
          <div className="bg-[#090a1c]/90 border border-white/10 p-6 rounded-2xl space-y-2 backdrop-blur-md">
            <Users className="h-5 w-5 text-[#5865F2]" />
            <h3 className="text-sm font-extrabold text-white">Active Developer Hub</h3>
            <p className="text-xs text-text-muted">Chat with 5,000+ developers, bot builders, and cloud architects.</p>
          </div>

          <div className="bg-[#090a1c]/90 border border-white/10 p-6 rounded-2xl space-y-2 backdrop-blur-md">
            <Zap className="h-5 w-5 text-[#5865F2]" />
            <h3 className="text-sm font-extrabold text-white">24/7 Ticketing</h3>
            <p className="text-xs text-text-muted">Open support tickets for custom bot hosting or server assistance.</p>
          </div>

          <div className="bg-[#090a1c]/90 border border-white/10 p-6 rounded-2xl space-y-2 backdrop-blur-md">
            <ShieldCheck className="h-5 w-5 text-[#5865F2]" />
            <h3 className="text-sm font-extrabold text-white">Live Node Telemetry</h3>
            <p className="text-xs text-text-muted">Real-time status updates and scheduled maintenance broadcasts.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
