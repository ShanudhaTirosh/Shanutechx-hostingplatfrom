'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Zap, MessageCircle, Send, Loader2, Check, ShieldCheck,
  Home, Activity, Star, BookOpen, Wrench,
  Layers, Bot, Sparkles, Gamepad2, HelpCircle, ArrowUp
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function StxFooter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setStatus('loading');
    setTimeout(() => {
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 3000);
    }, 1000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      style={{
        position: 'relative',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(3,0,20,0.8)',
        backdropFilter: 'blur(12px)',
        padding: '60px 24px 32px',
        marginTop: '80px',
        overflow: 'hidden',
        zIndex: 10,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Gradient line separator */}
      <div
        style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.3), transparent)',
        }}
      />

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '36px',
            marginBottom: '48px',
          }}
        >
          {/* Brand column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ gridColumn: 'span 1' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <img
                src="/STX.png"
                alt="STX STORE Logo"
                style={{ height: '32px', width: 'auto', borderRadius: '8px', objectFit: 'contain' }}
              />
              <span
                style={{
                  fontWeight: 900, fontSize: '18px',
                  background: 'linear-gradient(90deg, #a78bfa, #38bdf8)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                }}
              >
                STX STORE
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, maxWidth: '280px' }}>
              Sri Lanka's #1 Instant Digital Store for AI Accounts (ChatGPT, Claude, Lovable), V2Ray VPNs, Discord Boosts &amp; Gaming Keys with 24/7 automated delivery.
            </p>

            {/* Social links */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <a
                href="https://discord.gg/shanutechx"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#94a3b8', textDecoration: 'none',
                }}
              >
                <MessageCircle size={15} />
              </a>
              <a
                href="https://t.me/shanutechx"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#94a3b8', textDecoration: 'none',
                }}
              >
                <Send size={15} />
              </a>
            </div>
          </motion.div>

          {/* Column 1: Digital Products & Services */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Digital Products
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/v2ray" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} color="#38bdf8" /> V2Ray VPN Packages
              </Link>
              <Link href="/discord" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} color="#818cf8" /> Discord Server Boosts
              </Link>
              <Link href="/catalog" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={14} color="#a78bfa" /> AI Premium Accounts
              </Link>
              <Link href="/vps" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gamepad2 size={14} color="#f43f5e" /> Gaming Keys &amp; Cards
              </Link>
              <Link href="/status" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={14} color="#34d399" /> Supported ISP Packages
              </Link>
            </div>
          </motion.div>

          {/* Column 2: Navigation & Help Center */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Quick Navigation
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Home size={14} color="#a78bfa" /> Home &amp; Overview
              </Link>
              <Link href="/status" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={14} color="#10b981" /> System Status &amp; Nodes
              </Link>
              <Link href="/reviews" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={14} color="#f59e0b" /> Customer Reviews
              </Link>
              <Link href="/docs" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={14} color="#38bdf8" /> Connection Guide
              </Link>
              <Link href="/faqs" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={14} color="#fb7185" /> Troubleshooting
              </Link>
            </div>
          </motion.div>

          {/* Contact Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Support Center
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/contact" style={{ fontSize: '13px', color: '#a78bfa', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={14} color="#a78bfa" /> Contact &amp; Tickets
              </Link>
              <a href="mailto:support@shanutechx.com" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>
                support@shanutechx.com
              </a>
            </div>
          </motion.div>

          {/* Newsletter Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Newsletter
            </h4>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
              Stay updated with our latest node additions &amp; product offers.
            </p>
            <form onSubmit={handleSubscribe} style={{ position: 'relative', display: 'flex' }}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading' || status === 'success'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  paddingRight: '48px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  color: '#f1f5f9',
                  fontSize: '13px',
                  outline: 'none',
                }}
                required
              />
              <button
                type="submit"
                disabled={status === 'loading' || status === 'success'}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '4px',
                  bottom: '4px',
                  width: '40px',
                  background: status === 'success' ? '#34d399' : 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: (status === 'loading' || status === 'success') ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {status === 'loading' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : status === 'success' ? (
                  <Check size={16} />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* We Accept Payment Badges */}
        <div
          style={{
            padding: '16px 20px',
            margin: '24px 0 28px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={15} color="#38bdf8" /> WE ACCEPT PAYMENTS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <VisaSvg />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>Visa</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <MastercardSvg />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>Mastercard</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src="/images/commercial-bank.webp" alt="Commercial Bank" style={{ height: '18px', width: 'auto', borderRadius: '3px', objectFit: 'contain' }} onError={(e: any) => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>ComBank</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src="/images/hnb.webp" alt="HNB Bank" style={{ height: '18px', width: 'auto', borderRadius: '3px', objectFit: 'contain' }} onError={(e: any) => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>HNB Bank</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <img src="/images/binance.svg" alt="Binance Crypto" style={{ height: '18px', width: 'auto', objectFit: 'contain' }} onError={(e: any) => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>Binance / USDT</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <img src="/images/ezcash.svg" alt="ezCash" style={{ height: '18px', width: 'auto', objectFit: 'contain' }} onError={(e: any) => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>ezCash &amp; Genie</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <HelaPaySvg />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>HelaPay</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            © 2026 STX Store. All rights reserved. · Powered by{' '}
            <a
              href="https://shanutechx.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}
            >
              ShanuTechX
            </a>
          </p>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Link href="/terms" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>Legal</Link>
            <Link href="/privacy" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>Terms of Service</Link>
            
            {/* Scroll to Top Button */}
            <button
              onClick={scrollToTop}
              title="Scroll to Top"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(124,58,237,0.5)',
                marginLeft: '12px',
              }}
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
  <svg width="34" height="22" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="38" height="24" rx="4" fill="#1434CB"/>
    <path d="M14.65 16.5H12.43L13.81 7.5H16.03L14.65 16.5ZM23.47 7.74C23.01 7.56 22.28 7.37 21.36 7.37C19.06 7.37 17.43 8.6 17.41 10.33C17.39 11.62 18.57 12.34 19.45 12.77C20.35 13.21 20.65 13.49 20.65 13.88C20.64 14.48 19.92 14.75 19.24 14.75C18.17 14.75 17.58 14.44 17.11 14.22L16.63 16.48C17.26 16.77 18.42 17 19.61 17C22.06 17 23.64 15.79 23.66 13.91C23.68 12.33 22.7 11.53 21.57 10.99C20.8 10.6 20.33 10.33 20.33 9.94C20.34 9.58 20.73 9.22 21.6 9.22C22.42 9.2 23 9.38 23.47 9.59L23.95 7.37H23.47ZM29.47 7.5H27.76C27.23 7.5 26.83 7.65 26.6 8.21L22.72 16.5H25.38L25.91 15H29.17L29.48 16.5H31.83L29.47 7.5ZM26.65 13.06L27.97 9.47L28.74 13.06H26.65ZM11.47 7.5L9.36 13.65L9.12 12.38C8.71 10.97 7.42 9.38 5.95 8.6L8.52 16.5H11.2L15.34 7.5H11.47Z" fill="white"/>
  </svg>
);

const MastercardSvg = () => (
  <svg width="34" height="22" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="38" height="24" rx="4" fill="#1A1A2E" stroke="rgba(255,255,255,0.15)"/>
    <circle cx="15" cy="12" r="7" fill="#EB001B"/>
    <circle cx="23" cy="12" r="7" fill="#F79E1B"/>
    <path d="M19 6.84a7 7 0 0 1 0 10.32 7 7 0 0 1 0-10.32z" fill="#FF5F00"/>
  </svg>
);

const HelaPaySvg = () => (
  <svg width="60" height="24" viewBox="0 0 100 46" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="46" rx="8" fill="#FFFFFF"/>
    <circle cx="16" cy="15" r="9" fill="#E53935"/>
    <circle cx="33" cy="15" r="9" fill="#F57C00"/>
    <circle cx="16" cy="31" r="9" fill="#7CB342"/>
    <circle cx="33" cy="31" r="9" fill="#FDD835"/>
    <text x="73" y="16" fontFamily="'Sinhala Sangam MN', sans-serif, system-ui" fontSize="13" fill="#6B7280" textAnchor="middle">හෙළ</text>
    <text x="69" y="37" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="800" fill="#4B5563" textAnchor="middle">Pay</text>
  </svg>
);
