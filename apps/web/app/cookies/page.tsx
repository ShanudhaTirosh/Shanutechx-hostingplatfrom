import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { Cookie, Shield, Lock } from 'lucide-react';

export const metadata = {
  title: 'Cookie Policy | ShanuTechX Cloud',
  description: 'Learn how ShanuTechX Cloud uses essential session cookies for authentication and performance optimization.',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#7c3aed26_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 pt-32 pb-24 space-y-12 relative z-10 w-full">
        <div className="relative space-y-4 pt-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold uppercase">
            <Cookie className="h-3.5 w-3.5 text-purple-400" />
            LEGAL COMPLIANCE
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            Cookie <span className="text-purple-400">Policy</span>
          </h1>
          <p className="text-xs font-mono text-text-muted">Last Updated: September 2026</p>
        </div>

        <div className="bg-[#090a1c]/90 border border-white/10 rounded-3xl p-8 space-y-6 text-xs leading-relaxed text-text-muted backdrop-blur-md">
          <section className="space-y-2">
            <h2 className="text-base font-extrabold text-white">1. Essential Cookies Only</h2>
            <p>
              ShanuTechX Cloud uses strictly necessary session cookies and local storage items required to keep you authenticated inside your client dashboard, protect your API requests with anti-CSRF tokens, and maintain encrypted SSH terminal sessions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-extrabold text-white">2. No Third-Party Tracking Advertisers</h2>
            <p>
              We do not use third-party advertising cookies, cross-site tracking scripts, or data broker analytics that compromise customer privacy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-extrabold text-white">3. Managing Cookie Preferences</h2>
            <p>
              You can disable cookies at any time via your browser settings. However, disabling essential session cookies will prevent login access to your hosting dashboard.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
