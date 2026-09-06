'use client';

import { ArrowRight, Zap, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export default function CtaBanner() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  return (
    <section className="px-4 py-16 max-w-6xl mx-auto relative z-10">
      <div
        className="relative rounded-3xl overflow-hidden p-8 sm:p-14 text-center border border-purple-500/30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(147, 51, 234, 0.35) 0%, rgba(15, 23, 42, 0.95) 75%)',
          boxShadow: '0 20px 60px rgba(124, 58, 237, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Glow Orb Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/30 rounded-full filter blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-extrabold uppercase tracking-wider mb-6 shadow-glow-violet">
            <Sparkles size={14} /> Ready to Deploy in Under 60 Seconds?
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
            Supercharge Your Web &amp; Cloud Infrastructure Today.
          </h2>

          <p className="text-slate-300 text-base sm:text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
            Experience true high-frequency NVMe performance, automated Git deployments, instant container provisioning, and 24/7 dedicated support.
          </p>

          {/* Key Bullet Highlights */}
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 mb-10 text-xs sm:text-sm font-semibold text-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Instant Auto-Provisioning</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Zero Setup Fees</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>99.9% Guaranteed Uptime</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap justify-center items-center gap-4">
            <a
              href={`${dashboardUrl}/register`}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-base shadow-xl shadow-purple-600/30 hover:scale-105 transition-all flex items-center gap-2"
            >
              <span>Get Started Free</span>
              <ArrowRight size={18} />
            </a>

            <a
              href="#pricing"
              className="px-8 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-extrabold text-base hover:bg-white/15 transition-all backdrop-blur-md"
            >
              View All Products
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
