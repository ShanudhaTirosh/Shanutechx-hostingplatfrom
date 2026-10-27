"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  MessageCircle,
  Send,
  Loader2,
  Check,
  ShieldCheck,
  Home,
  Activity,
  Star,
  BookOpen,
  Wrench,
  Layers,
  Bot,
  Sparkles,
  Gamepad2,
  HelpCircle,
  ArrowUp,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setStatus("loading");
    setTimeout(() => {
      setStatus("success");
      setEmail("");
      setTimeout(() => setStatus("idle"), 4000);
    }, 800);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative border-t border-white/10 bg-[#030014]/90 backdrop-blur-xl pt-16 pb-8 px-6 font-sans text-white z-20 overflow-hidden">
      {/* Top Ambient Glow Separator */}
      <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 via-cyan-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto space-y-12">
        {/* Top Grid: Brand & Sitemap */}
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Brand Info & Newsletter */}
          <div className="lg:col-span-4 space-y-5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <img
                src="/STX.png"
                alt="STX HOSTING Logo"
                className="w-8 h-8 max-w-[32px] max-h-[32px] shrink-0 rounded-xl object-contain shadow-[0_0_20px_rgba(168,85,247,0.5)] group-hover:scale-105 transition-transform"
                style={{ filter: "brightness(0) invert(1)" }}
              />
              <span className="font-extrabold text-xl tracking-tight text-white">
                STX <span className="text-purple-400 font-bold">HOSTING</span>
              </span>
            </Link>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Autonomous enterprise cloud hosting, VPS allocations, 24/7 bot
              hosting, and managed databases powered by high-performance edge
              nodes.
            </p>

            {/* Newsletter Subscription */}
            <form
              onSubmit={handleSubscribe}
              className="pt-2 max-w-sm space-y-2.5"
            >
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-purple-300 block">
                STAY UPDATED WITH PLATFORM RELEASES
              </span>
              <div className="relative flex items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={status === "loading" || status === "success"}
                  className="w-full bg-[#080a1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/80 transition-colors pr-32"
                  required
                />
                <button
                  type="submit"
                  disabled={status === "loading" || status === "success"}
                  className={`absolute right-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                    status === "success"
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                  }`}
                >
                  {status === "loading" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : status === "success" ? (
                    <>
                      <Check size={14} /> Subscribed
                    </>
                  ) : (
                    "Subscribe"
                  )}
                </button>
              </div>
              {status === "success" && (
                <p className="text-emerald-400 text-[11px] font-mono animate-fade-in flex items-center gap-1">
                  <Check size={14} /> Successfully subscribed to platform releases!
                </p>
              )}
            </form>
          </div>

          {/* Sitemap Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2">
            {/* Services */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">
                Services
              </h4>
              <ul className="space-y-3 text-xs text-slate-400">
                <li>
                  <Link
                    href="/vps"
                    className="hover:text-white transition-colors"
                  >
                    Cloud VPS
                  </Link>
                </li>
                <li>
                  <Link
                    href="/app-hosting"
                    className="hover:text-white transition-colors"
                  >
                    Web App Hosting
                  </Link>
                </li>
                <li>
                  <Link
                    href="/bot-hosting"
                    className="hover:text-white transition-colors"
                  >
                    Bot Hosting
                  </Link>
                </li>
                <li>
                  <Link
                    href="/databases"
                    className="hover:text-white transition-colors"
                  >
                    Managed Databases
                  </Link>
                </li>
                <li>
                  <Link
                    href="/catalog"
                    className="hover:text-white transition-colors"
                  >
                    App Catalog
                  </Link>
                </li>
                <li>
                  <a
                    href="https://store.shanutechx.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>V2Ray Proxies</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://store.shanutechx.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors text-purple-300 font-extrabold flex items-center gap-1"
                  >
                    <span>STX Digital Goods</span>
                    <ExternalLink className="w-3 h-3 text-purple-300" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">
                Company
              </h4>
              <ul className="space-y-3 text-xs text-slate-400">
                <li>
                  <Link
                    href="/about"
                    className="hover:text-white transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/reviews"
                    className="hover:text-white transition-colors"
                  >
                    Reviews
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">
                Support &amp; Docs
              </h4>
              <ul className="space-y-3 text-xs text-slate-400">
                <li>
                  <Link
                    href="/docs"
                    className="hover:text-white transition-colors font-bold text-purple-300"
                  >
                    Documentation &amp; API Docs
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help"
                    className="hover:text-white transition-colors"
                  >
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faqs"
                    className="hover:text-white transition-colors"
                  >
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link
                    href="/discord"
                    className="hover:text-white transition-colors"
                  >
                    Discord Support
                  </Link>
                </li>
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_STATUS_URL || "https://status.shanutechx.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors flex items-center gap-1.5 text-emerald-400 font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Status &amp; Uptime</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-400 mb-4 font-mono">
                Legal
              </h4>
              <ul className="space-y-3 text-xs text-slate-400">
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-white transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cookies"
                    className="hover:text-white transition-colors"
                  >
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/refund"
                    className="hover:text-white transition-colors"
                  >
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* We Accept Payment Badges */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2 font-mono">
            <ShieldCheck size={16} className="text-sky-400" /> WE ACCEPT
            PAYMENTS
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <img
                src="/images/binance.svg"
                alt="Binance Pay"
                className="h-4 w-4 object-contain"
              />
              <span className="text-[11px] font-bold text-amber-400">
                Binance Pay
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <img
                src="/images/ezcash.svg"
                alt="eZ Cash"
                className="h-4 w-4 object-contain"
              />
              <span className="text-[11px] font-bold text-emerald-400">
                eZ Cash / Genie
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <img
                src="/images/commercial-bank.webp"
                alt="Commercial Bank"
                className="h-4 w-4 object-contain rounded"
              />
              <span className="text-[11px] font-bold text-slate-300">
                Commercial Bank
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <img
                src="/images/hnb.webp"
                alt="HNB"
                className="h-4 w-4 object-contain rounded"
              />
              <span className="text-[11px] font-bold text-slate-300">
                HNB Bank
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <VisaSvg />
              <span className="text-[11px] font-bold text-slate-300">
                Visa / MC
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              <HelaPaySvg />
              <span className="text-[11px] font-bold text-slate-300">
                HelaPay
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-mono">
          <p>
            © {new Date().getFullYear()} ShanuTechX Cloud. All rights reserved.
          </p>

          <div className="flex items-center gap-6">
            <a
              href="https://discord.gg/shanutechx"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Discord
            </a>
            <a
              href="https://github.com/shanutechx"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href={process.env.NEXT_PUBLIC_STATUS_URL || "https://status.shanutechx.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-slate-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              All Systems Operational
            </a>
            <a
              href={`${dashboardUrl}/login`}
              className="text-purple-400 hover:text-purple-300 font-bold transition-colors flex items-center gap-1"
            >
              Dashboard Login →
            </a>

            {/* Scroll to Top Button */}
            <button
              onClick={scrollToTop}
              title="Scroll to Top"
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:scale-110 transition-transform ml-2"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

const VisaSvg = () => (
  <svg
    width="28"
    height="18"
    viewBox="0 0 38 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="38" height="24" rx="4" fill="#1434CB" />
    <path
      d="M14.65 16.5H12.43L13.81 7.5H16.03L14.65 16.5ZM23.47 7.74C23.01 7.56 22.28 7.37 21.36 7.37C19.06 7.37 17.43 8.6 17.41 10.33C17.39 11.62 18.57 12.34 19.45 12.77C20.35 13.21 20.65 13.49 20.65 13.88C20.64 14.48 19.92 14.75 19.24 14.75C18.17 14.75 17.58 14.44 17.11 14.22L16.63 16.48C17.26 16.77 18.42 17 19.61 17C22.06 17 23.64 15.79 23.66 13.91C23.68 12.33 22.7 11.53 21.57 10.99C20.8 10.6 20.33 10.33 20.33 9.94C20.34 9.58 20.73 9.22 21.6 9.22C22.42 9.2 23 9.38 23.47 9.59L23.95 7.37H23.47ZM29.47 7.5H27.76C27.23 7.5 26.83 7.65 26.6 8.21L22.72 16.5H25.38L25.91 15H29.17L29.48 16.5H31.83L29.47 7.5ZM26.65 13.06L27.97 9.47L28.74 13.06H26.65ZM11.47 7.5L9.36 13.65L9.12 12.38C8.71 10.97 7.42 9.38 5.95 8.6L8.52 16.5H11.2L15.34 7.5H11.47Z"
      fill="white"
    />
  </svg>
);

const MastercardSvg = () => (
  <svg
    width="28"
    height="18"
    viewBox="0 0 38 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      width="38"
      height="24"
      rx="4"
      fill="#1A1A2E"
      stroke="rgba(255,255,255,0.15)"
    />
    <circle cx="15" cy="12" r="7" fill="#EB001B" />
    <circle cx="23" cy="12" r="7" fill="#F79E1B" />
    <path d="M19 6.84a7 7 0 0 1 0 10.32 7 7 0 0 1 0-10.32z" fill="#FF5F00" />
  </svg>
);

const HelaPaySvg = () => (
  <svg
    width="45"
    height="18"
    viewBox="0 0 100 46"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="100" height="46" rx="8" fill="#FFFFFF" />
    <circle cx="16" cy="15" r="9" fill="#E53935" />
    <circle cx="33" cy="15" r="9" fill="#F57C00" />
    <circle cx="16" cy="31" r="9" fill="#7CB342" />
    <circle cx="33" cy="31" r="9" fill="#FDD835" />
    <text
      x="73"
      y="16"
      fontFamily="sans-serif"
      fontSize="13"
      fill="#6B7280"
      textAnchor="middle"
    >
      හෙළ
    </text>
    <text
      x="69"
      y="37"
      fontFamily="sans-serif"
      fontSize="24"
      fontWeight="800"
      fill="#4B5563"
      textAnchor="middle"
    >
      Pay
    </text>
  </svg>
);
