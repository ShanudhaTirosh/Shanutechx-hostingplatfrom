'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="bg-[#030014] text-white border-t border-white/10 font-sans pt-16 pb-12 px-6 relative z-10">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Top Grid: Brand & Sitemap */}
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Brand Info & Newsletter */}
          <div className="lg:col-span-4 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 font-extrabold text-white tracking-tight text-lg">
              <span className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-teal-400 flex items-center justify-center text-white font-black text-sm shadow-glow-violet">
                S
              </span>
              <span>
                SHANUTECHX <span className="text-purple-400 font-bold">.CLOUD</span>
              </span>
            </Link>

            <p className="text-text-muted text-xs leading-relaxed max-w-sm">
              Autonomous enterprise cloud hosting, VPS allocations, 24/7 bot hosting, and managed databases powered by high-performance edge nodes.
            </p>

            {/* Newsletter Subscription */}
            <form onSubmit={handleSubscribe} className="pt-2 max-w-sm space-y-2">
              <span className="text-[11px] font-mono uppercase text-purple-300 font-bold block">
                Stay updated with platform releases
              </span>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="bg-[#0a0a1a] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-purple-500 flex-1"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-violet shrink-0 transition-all"
                >
                  Subscribe
                </button>
              </div>
              {subscribed && (
                <p className="text-emerald-400 text-xs font-mono">Thanks for subscribing to updates!</p>
              )}
            </form>
          </div>

          {/* Sitemap Columns matching exact user request */}
          <div className="lg:col-span-8 grid sm:grid-cols-4 gap-6">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">Services</h4>
              <ul className="space-y-2.5 text-xs text-text-muted">
                <li><Link href="/vps" className="hover:text-white transition-colors">Cloud VPS</Link></li>
                <li><Link href="/app-hosting" className="hover:text-white transition-colors">Web App Hosting</Link></li>
                <li><Link href="/bot-hosting" className="hover:text-white transition-colors">Bot Hosting</Link></li>
                <li><Link href="/databases" className="hover:text-white transition-colors">Managed Databases</Link></li>
                <li><Link href="/catalog" className="hover:text-white transition-colors">App Catalog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">Company</h4>
              <ul className="space-y-2.5 text-xs text-text-muted">
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/reviews" className="hover:text-white transition-colors">Reviews</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">Support</h4>
              <ul className="space-y-2.5 text-xs text-text-muted">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/faqs" className="hover:text-white transition-colors">FAQs</Link></li>
                <li><Link href="/discord" className="hover:text-white transition-colors">Discord Support</Link></li>
                <li><Link href="/status" className="hover:text-white transition-colors">Status Page</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">Legal</h4>
              <ul className="space-y-2.5 text-xs text-text-muted">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
                <li><Link href="/refund" className="hover:text-white transition-colors">Refund Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted font-mono">
          <span>&copy; {new Date().getFullYear()} ShanuTechX Cloud. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="https://discord.gg/shanutechx" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Discord</a>
            <a href="https://github.com/shanutechx" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
            <a href={`${dashboardUrl}/login`} className="text-purple-400 hover:text-purple-300 font-bold transition-colors">Dashboard Login →</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
