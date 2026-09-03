'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import {
  User,
  Menu,
  ChevronDown,
  Server,
  Code2,
  Bot,
  Database,
  LayoutGrid,
  X,
  Search,
  ShoppingCart,
  Bell,
  CheckCheck,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import DiscordIcon from './DiscordIcon';

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
  { label: 'Home', href: '/' },
  { label: 'Cloud VPS', href: '/vps' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Status', href: '/status' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const reduceMotion = useReducedMotion();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  const loginUrl = `${dashboardUrl}/login`;

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // Smooth scroll transformations
  const { scrollY } = useScroll();
  const navWidth = useTransform(scrollY, [0, 120], ['98%', '94%']);
  const navPaddingX = useTransform(scrollY, [0, 120], [24, 18]);
  const navPaddingY = useTransform(scrollY, [0, 120], [12, 8]);
  const navBg = useTransform(
    scrollY,
    [0, 120],
    ['rgba(10,11,28,0.7)', 'rgba(10,11,28,0.95)']
  );

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-3 font-sans select-none">
      <motion.nav
        style={
          reduceMotion
            ? undefined
            : {
                width: navWidth,
                paddingLeft: navPaddingX,
                paddingRight: navPaddingX,
                paddingTop: navPaddingY,
                paddingBottom: navPaddingY,
                backgroundColor: navBg,
              }
        }
        className="max-w-7xl backdrop-blur-2xl border border-white/15 rounded-full flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.15),0_0_30px_rgba(124,58,237,0.12)] bg-[#0a0b1c]/80 transition-all duration-300"
      >
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-extrabold text-white tracking-tight text-base group shrink-0"
        >
          <span className="h-8.5 w-8.5 rounded-xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-[0_0_15px_rgba(16,185,129,0.5)] group-hover:scale-105 transition-transform">
            STX
          </span>
          <span className="tracking-tighter font-extrabold text-white hidden sm:inline">
            SHANUTECHX <span className="text-emerald-400 font-bold">.CLOUD</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-300">
          {/* Services Dropdown */}
          <div
            className="relative py-1"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button className="hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none">
              Services{' '}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-200 ${
                  servicesOpen ? 'rotate-180 text-purple-400' : ''
                }`}
              />
            </button>

            {/* Seamless Dropdown Wrapper with no gap bug */}
            <AnimatePresence>
              {servicesOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2.5 z-50">
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="w-80 bg-[#080922]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]"
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
                            <div
                              className={`p-2 rounded-xl bg-white/5 border border-white/10 ${prod.color} group-hover/item:scale-110 transition-transform`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block font-bold text-white text-xs group-hover/item:text-purple-300 transition-colors">
                                {prod.name}
                              </span>
                              <span className="block text-[11px] text-slate-400 leading-tight mt-0.5">
                                {prod.desc}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
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

          {/* Legal Dropdown with Fixed Hover State (Seamless Container) */}
          <div
            className="relative py-1"
            onMouseEnter={() => setLegalOpen(true)}
            onMouseLeave={() => setLegalOpen(false)}
          >
            <button className="hover:text-white transition-colors flex items-center gap-1 focus:outline-none">
              Legal{' '}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-200 ${
                  legalOpen ? 'rotate-180 text-purple-400' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {legalOpen && (
                <div className="absolute top-full right-0 pt-2.5 z-50">
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="w-48 bg-[#080922]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)] space-y-1"
                  >
                    <Link
                      href="/terms"
                      onClick={() => setLegalOpen(false)}
                      className="block px-3.5 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-300 hover:text-white font-medium transition-colors"
                    >
                      Terms of Service
                    </Link>
                    <Link
                      href="/privacy"
                      onClick={() => setLegalOpen(false)}
                      className="block px-3.5 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-300 hover:text-white font-medium transition-colors"
                    >
                      Privacy Policy
                    </Link>
                    <Link
                      href="/cookies"
                      onClick={() => setLegalOpen(false)}
                      className="block px-3.5 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-300 hover:text-white font-medium transition-colors"
                    >
                      Cookie Policy
                    </Link>
                    <Link
                      href="/refund"
                      onClick={() => setLegalOpen(false)}
                      className="block px-3.5 py-2 rounded-xl hover:bg-white/10 text-xs text-slate-300 hover:text-white font-medium transition-colors"
                    >
                      Refund Policy
                    </Link>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Header Right Actions (Exact STX VPN Action Bar) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 🔍 Search Icon Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
            title="Search Platform Services"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* 🛒 Cart Drawer Icon Button */}
          <button
            onClick={() => setCartOpen((v) => !v)}
            className="relative p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
            title="Shopping Cart"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="absolute top-1 right-1 bg-purple-500 text-white font-mono font-bold text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(168,85,247,0.8)]">
              0
            </span>
          </button>

          {/* 🔔 Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all focus:outline-none"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 bg-emerald-400 text-slate-950 font-mono font-bold text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-[0_0_8px_#34d399]">
                1
              </span>
            </button>

            {/* Notification Dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute top-full right-0 mt-3 w-72 bg-[#080922]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-4 z-50 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-emerald-400" /> System Status
                    </span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="text-[10px] text-purple-400 font-bold flex items-center gap-1 hover:underline"
                    >
                      <CheckCheck className="h-3 w-3" /> Mark read
                    </button>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-white">🟢 All Systems Operational</p>
                    <p className="text-[11px] text-slate-400">
                      11 Edge nodes active. Ultra-low latency active across all regions.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 👤 CLIENT SPACE Account Button */}
          <a
            href={loginUrl}
            className="rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 px-4 sm:px-5 py-2 text-xs font-extrabold text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] transition-all uppercase tracking-wider flex items-center gap-1.5 hover:scale-105"
          >
            <User className="h-3.5 w-3.5" />
            <span>CLIENT SPACE</span>
          </a>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? (
              <X className="h-6 w-6 text-purple-400" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </motion.nav>

      {/* 🔍 Search Modal Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-[#080922] border border-white/15 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4 relative"
            >
              <button
                onClick={() => setSearchOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <Search className="h-5 w-5 text-purple-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Cloud VPS, Databases, 1-Click Apps..."
                  className="bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none w-full"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
                  Quick Navigation
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <Link
                    href="/vps"
                    onClick={() => setSearchOpen(false)}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 text-white flex items-center gap-2 transition-all"
                  >
                    <Server className="h-4 w-4 text-purple-400" /> Cloud VPS Hosting
                  </Link>
                  <Link
                    href="/catalog"
                    onClick={() => setSearchOpen(false)}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 text-white flex items-center gap-2 transition-all"
                  >
                    <LayoutGrid className="h-4 w-4 text-amber-400" /> 1-Click App Catalog
                  </Link>
                  <Link
                    href="/databases"
                    onClick={() => setSearchOpen(false)}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 text-white flex items-center gap-2 transition-all"
                  >
                    <Database className="h-4 w-4 text-teal-400" /> Managed Databases
                  </Link>
                  <Link
                    href="/bot-hosting"
                    onClick={() => setSearchOpen(false)}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 text-white flex items-center gap-2 transition-all"
                  >
                    <Bot className="h-4 w-4 text-pink-400" /> 24/7 Bot Hosting
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🛒 Cart Drawer Slide-over */}
      <AnimatePresence>
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#080922] border-l border-white/15 w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-base font-bold text-white flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-purple-400" /> Shopping Cart
                  </span>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-center py-12 space-y-3">
                  <ShoppingCart className="h-12 w-12 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">Your cart is currently empty</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Select a Cloud VPS or 1-Click App catalog product to add to your order.
                  </p>
                </div>
              </div>

              <Link
                href="/pricing"
                onClick={() => setCartOpen(false)}
                className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs text-center shadow-glow-violet transition-all"
              >
                Browse Plans &amp; Pricing →
              </Link>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Menu with Glassmorphism */}
      {mobileOpen && (
        <div className="absolute top-20 left-4 right-4 bg-[#080922]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 flex flex-col gap-4 shadow-[0_25px_60px_rgba(0,0,0,0.8)] max-h-[85vh] overflow-y-auto animate-slide-down">
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
                  className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/10 text-xs font-semibold text-white transition-colors"
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
                className="text-xs font-semibold text-slate-300 hover:text-white py-1.5 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
            <a
              href="https://discord.gg/shanutechx"
              target="_blank"
              rel="noreferrer"
              className="text-[#5865F2] hover:underline font-bold flex items-center gap-1.5"
            >
              <DiscordIcon className="h-4 w-4" /> Discord Server
            </a>
            <Link
              href="/privacy"
              onClick={() => setMobileOpen(false)}
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
