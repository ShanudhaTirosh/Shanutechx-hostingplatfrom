'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, User, Menu, ChevronDown, Server, Code2, Bot, Database, LayoutGrid, X } from 'lucide-react';

const PRODUCTS = [
  {
    name: 'Cloud VPS',
    desc: 'High-speed NVMe compute nodes with root SSH',
    href: '/vps',
    icon: Server,
    color: 'text-purple-400',
  },
  {
    name: 'App & Repo Hosting',
    desc: 'Deploy from GitHub, GitLab, or ZIP packages',
    href: '/app-hosting',
    icon: Code2,
    color: 'text-indigo-400',
  },
  {
    name: '24/7 Bot Hosting',
    desc: 'Discord, Telegram & WhatsApp bot daemons',
    href: '/bot-hosting',
    icon: Bot,
    color: 'text-pink-400',
  },
  {
    name: 'Managed Databases',
    desc: 'PostgreSQL, MySQL, Redis & MongoDB clusters',
    href: '/databases',
    icon: Database,
    color: 'text-teal-400',
  },
  {
    name: '1-Click Catalog',
    desc: 'WordPress, N8n, Plausible & 15+ templates',
    href: '/catalog',
    icon: LayoutGrid,
    color: 'text-amber-400',
  },
];

const MAIN_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Status', href: '/status' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

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
          {/* Services Dropdown */}
          <div
            className="relative group py-1"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button className="hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none">
              Services <ChevronDown className={`h-3 w-3 transition-transform ${servicesOpen ? 'rotate-180 text-purple-400' : ''}`} />
            </button>

            {/* Dropdown Menu Box */}
            <div
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-[#0d0e24] border border-white/15 rounded-3xl p-3 shadow-2xl transition-all duration-200 ${
                servicesOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
              }`}
            >
              <div className="space-y-1">
                {PRODUCTS.map((prod) => {
                  const Icon = prod.icon;
                  return (
                    <Link
                      key={prod.href}
                      href={prod.href}
                      onClick={() => setServicesOpen(false)}
                      className="flex items-start gap-3 p-2.5 rounded-2xl hover:bg-white/10 transition-colors group/item"
                    >
                      <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${prod.color} group-hover/item:scale-110 transition-transform`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block font-bold text-white text-xs group-hover/item:text-purple-300 transition-colors">
                          {prod.name}
                        </span>
                        <span className="block text-[11px] text-text-muted leading-tight mt-0.5">
                          {prod.desc}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Standard Navigation Links */}
          {MAIN_LINKS.map((link) => (
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
              Legal <ChevronDown className="h-3 w-3" />
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

        {/* Header Right Action Icons & CLIENT SPACE Button */}
        <div className="flex items-center gap-3">
          {/* Discord Server Link */}
          <a
            href="https://discord.gg/shanutechx"
            target="_blank"
            rel="noreferrer"
            title="Join Discord Server"
            className="hidden sm:flex items-center justify-center h-8 w-8 rounded-full bg-white/5 hover:bg-indigo-600/20 text-indigo-300 border border-white/10 transition-all"
          >
            <MessageSquare className="h-4 w-4" />
          </a>

          {/* CLIENT SPACE Button */}
          <a
            href={loginUrl}
            className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-5 py-2 text-xs font-extrabold text-white shadow-glow-violet transition-all uppercase tracking-wider flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5" /> CLIENT SPACE
          </a>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 text-text-muted hover:text-white focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="h-5 w-5 text-purple-400" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="absolute top-20 left-4 right-4 bg-[#0a0b1c] border border-white/15 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-down">
          <span className="text-[11px] font-mono uppercase text-indigo-400 font-bold tracking-wider">
            Hosting Services
          </span>
          <div className="grid gap-2 border-b border-white/[0.08] pb-4">
            {PRODUCTS.map((prod) => {
              const Icon = prod.icon;
              return (
                <Link
                  key={prod.href}
                  href={prod.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/10 text-xs font-semibold text-white"
                >
                  <Icon className={`h-4 w-4 ${prod.color}`} />
                  <span>{prod.name}</span>
                </Link>
              );
            })}
          </div>

          <span className="text-[11px] font-mono uppercase text-indigo-400 font-bold tracking-wider pt-1">
            Platform Navigation
          </span>
          <div className="flex flex-col gap-2">
            {MAIN_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-xs font-semibold text-text-muted hover:text-white py-1"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-text-muted">
            <Link href="/terms" onClick={() => setMobileOpen(false)} className="hover:text-white">Terms of Service</Link>
            <Link href="/privacy" onClick={() => setMobileOpen(false)} className="hover:text-white">Privacy Policy</Link>
          </div>
        </div>
      )}
    </div>
  );
}
