'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const LINKS = [
  { label: 'Cloud VPS', href: '#features' },
  { label: 'V2Ray & Digital Store', href: 'https://store.shanutechx.com' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Status', href: '/status' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  const loginUrl = `${dashboardUrl}/login`;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 font-sans">
      <nav
        className={`bg-[#0b0c1e]/90 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-between transition-all duration-300 shadow-2xl ${
          scrolled ? 'w-[94%] max-w-5xl px-6 py-2.5' : 'w-[98%] max-w-6xl px-8 py-3.5'
        }`}
      >
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-white tracking-tight text-base group">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-glow-violet group-hover:scale-105 transition-transform">
            STX
          </span>
          <span className="tracking-tighter font-extrabold text-white">
            STX SOLUTIONS <span className="text-emerald-400 font-bold">.CLOUD</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-text-muted">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-white transition-colors relative group py-1"
            >
              {link.label}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 group-hover:w-full transition-all duration-300" />
            </Link>
          ))}

          {/* Legal Dropdown */}
          <div className="relative group py-1">
            <span className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
              Legal ▼
            </span>
            <div className="absolute top-full right-0 mt-2 w-40 bg-[#12132b] border border-white/10 rounded-2xl p-2 hidden group-hover:block shadow-2xl space-y-1">
              <Link href="/terms" className="block px-3 py-1.5 rounded-xl hover:bg-white/10 text-xs text-text-muted hover:text-white">
                Terms of Service
              </Link>
              <Link href="/privacy" className="block px-3 py-1.5 rounded-xl hover:bg-white/10 text-xs text-text-muted hover:text-white">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Header Right Action Icons & CLIENT SPACE Button (WrapXLK Style) */}
        <div className="flex items-center gap-3">
          {/* Discord Server Link */}
          <a
            href="https://discord.gg/shanutechx"
            target="_blank"
            rel="noreferrer"
            title="Join Discord Server"
            className="hidden sm:flex items-center justify-center h-8 w-8 rounded-full bg-white/5 hover:bg-indigo-600/20 text-indigo-300 border border-white/10 transition-all"
          >
            <span>💬</span>
          </a>

          {/* CLIENT SPACE Button */}
          <a
            href={loginUrl}
            className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-5 py-2 text-xs font-extrabold text-white shadow-glow-violet transition-all uppercase tracking-wider flex items-center gap-1.5"
          >
            <span>👤 CLIENT SPACE</span>
          </a>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 text-text-muted hover:text-white"
          >
            ☰
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="absolute top-20 left-4 right-4 bg-[#101124] border border-white/15 rounded-3xl p-6 flex flex-col gap-3 shadow-2xl animate-slide-down">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-semibold text-text-muted hover:text-white py-1.5 border-b border-white/[0.04]"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/terms" className="text-xs text-text-muted hover:text-white">Terms of Service</Link>
          <Link href="/privacy" className="text-xs text-text-muted hover:text-white">Privacy Policy</Link>
        </div>
      )}
    </div>
  );
}
