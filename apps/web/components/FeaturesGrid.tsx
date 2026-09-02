'use client';

import React from 'react';
import { Zap, Bot, Sparkles, Server, Gamepad2, Clock } from 'lucide-react';

const FEATURES = [
  {
    badge: 'VPN & TUNNELING',
    badgeColor: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.3)',
    badgeText: '#34d399',
    icon: <Zap className="h-5 w-5 text-emerald-400" />,
    title: 'Ultra-Fast V2Ray VPN',
    desc: 'Bypass ISP throttling with optimized VLESS/VMESS SNI protocols for SLT, Dialog, Airtel, Hutch & Mobitel.',
  },
  {
    badge: 'AI SUBSCRIPTIONS',
    badgeColor: 'rgba(236, 72, 153, 0.15)',
    badgeBorder: 'rgba(236, 72, 153, 0.3)',
    badgeText: '#f472b6',
    icon: <Bot className="h-5 w-5 text-pink-400" />,
    title: 'AI Accounts & Pro Tools',
    desc: 'Instant access to ChatGPT Plus, Claude Pro, Lovable AI, Midjourney & Gemini Advanced at unbeatable prices.',
  },
  {
    badge: 'COMMUNITY & NITRO',
    badgeColor: 'rgba(99, 102, 241, 0.15)',
    badgeBorder: 'rgba(99, 102, 241, 0.3)',
    badgeText: '#818cf8',
    icon: <Sparkles className="h-5 w-5 text-indigo-400" />,
    title: 'Discord Boosts & Nitro',
    desc: '14x Level 3 Server Boosts and Discord Nitro upgrades delivered straight to your server within minutes.',
  },
  {
    badge: 'CLOUD & INFRASTRUCTURE',
    badgeColor: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.3)',
    badgeText: '#38bdf8',
    icon: <Server className="h-5 w-5 text-sky-400" />,
    title: 'App & Web Hosting',
    desc: 'High-performance Node.js, Python, Discord bot & website hosting powered by shanutechx.com with 99.9% uptime.',
  },
  {
    badge: 'GAMING KEYS',
    badgeColor: 'rgba(168, 85, 247, 0.15)',
    badgeBorder: 'rgba(168, 85, 247, 0.3)',
    badgeText: '#c084fc',
    icon: <Gamepad2 className="h-5 w-5 text-purple-400" />,
    title: 'Game Accounts & Activation Keys',
    desc: 'Legit activation keys and premium game accounts for Steam, EA Play, Ubisoft, PlayStation & PC titles.',
  },
  {
    badge: '24/7 AUTOMATED',
    badgeColor: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
    badgeText: '#fbbf24',
    icon: <Clock className="h-5 w-5 text-amber-400" />,
    title: 'Instant Delivery & 24/7 Support',
    desc: 'Automated credentials delivered to your dashboard seconds after purchase with 24/7 live admin support.',
  },
];

export default function FeaturesGrid() {
  return (
    <section
      style={{
        maxWidth: '1160px',
        margin: '80px auto',
        padding: '0 24px',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: '44px' }}>
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            margin: '0 0 12px 0',
          }}
        >
          Why Choose STX Digital Store?
        </h2>
        <p
          style={{
            fontSize: '15px',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Everything you need for ultra-fast VPN, AI software accounts, Discord boosts, cloud hosting &amp; gaming top-ups
        </p>
      </div>

      {/* 6 Feature Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {FEATURES.map((feat, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(11, 11, 15, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '28px 24px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            className="hover:scale-[1.02] hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-2xl"
          >
            {/* Capsule Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: '9999px',
                background: feat.badgeColor,
                border: `1px solid ${feat.badgeBorder}`,
                fontSize: '10px',
                fontWeight: 800,
                color: feat.badgeText,
                letterSpacing: '0.08em',
                marginBottom: '18px',
              }}
            >
              {feat.badge}
            </div>

            {/* Icon & Title Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {feat.icon}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {feat.title}
              </h3>
            </div>

            {/* Description */}
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              {feat.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
