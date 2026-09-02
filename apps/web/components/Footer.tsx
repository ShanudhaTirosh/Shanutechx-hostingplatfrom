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
    <footer className="bg-[#050611] text-white border-t border-white/[0.08] font-sans pt-16 pb-12 px-6">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Top Grid: Brand & Sitemap */}
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Brand Info & Newsletter */}
          <div className="lg:col-span-5 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 font-extrabold text-white tracking-tight text-lg">
              <span className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-glow-violet">
                W
              </span>
              <span>
                SHANUTECHX <span className="text-purple-400 font-bold">.CLOUD</span>
              </span>
            </Link>

            <p className="text-text-muted text-xs leading-relaxed max-w-sm">
              Deploy static sites, Node.js, Python apps, Discord bots, managed databases, and proxy tunneling in seconds. Powered by our high-performance edge nodes.
            </p>

            {/* Newsletter Subscription */}
            <form onSubmit={handleSubscribe} className="pt-2 max-w-sm space-y-2">
              <span className="text-[11px] font-mono uppercase text-indigo-300 font-bold block">
                Stay updated with platform releases
              </span>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="bg-[#0c0d20] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-text-faint focus:outline-none focus:border-purple-500 flex-1"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-violet shrink-0"
                >
                  Subscribe
                </button>
              </div>
              {subscribed && (
                <p className="text-emerald-400 text-xs font-mono">Thanks for subscribing to updates!</p>
              )}
            </form>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-7 grid sm:grid-cols-3 gap-8">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-4">Cloud Services</h4>
              <ul className="space-y-2.5 text-xs text-text-muted">
                <li><Link href="/pricing" className="hover:text-white transition-colors">VPS Hosting</Link></li>
                <li><Link href="/v2ray" className="hover:text-white transition-colors">V2Ray &amp; Netch Proxy</Link></li>
                <li><a href={`${dashboardUrl}/services`} className="hover:text-white transition-colors">1-Click App Catalog</a></li>
                <li><a href={`${dashboardUrl}/services`} className="hover:text-white transition-colors">Managed PostgreSQL &amp; Redis</a></li>
                <li><a href={`${dashboardUrl}/webmail`} className="hover:text-white transition-colors">Mail Studio</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-4">Company &amp; Status</h4>
              <ul className="space-y-2.5 text-xs text-text-muted">
                <li><Link href="/about" className="hover:text-white transition-colors">About SHANUTECHX</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
                <li><Link href="/status" className="hover:text-white transition-colors">Public Status Studio</Link></li>
                <li><a href="https://discord.gg/shanutechx" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Discord Community</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-4">Legal Policies</h4>
              <ul className="space-y-2.5 text-xs text-text-muted">
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><a href={`${dashboardUrl}/login`} className="hover:text-white transition-colors">Client Space Login</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.08] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted font-mono">
          <span>&copy; {new Date().getFullYear()} SHANUTECHX Cloud. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="https://discord.gg/shanutechx" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Discord</a>
            <a href="https://github.com/shanutechx" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
