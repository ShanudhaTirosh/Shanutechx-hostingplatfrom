'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShoppingBag, Server, Globe, Code } from 'lucide-react';

const GAME_SLIDES = [
  '/images/category-bg-games.png',
  '/images/game-slide-valheim.png',
  '/images/game-slide-rdr2.png',
  '/images/game-slide-battlefield.png',
  '/images/gta-v-logo.png',
];

export default function BentoGrid() {
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % GAME_SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      style={{
        maxWidth: '1160px',
        margin: '70px auto',
        padding: '0 24px',
        fontFamily: "'Inter', sans-serif",
        color: '#f8fafc',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Everything You Need. In One Place.
        </h2>
      </div>

      {/* Grid Layout Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ─── ROW 1: 1fr | 1fr ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {/* CARD 1: V2Ray Services (Emerald Green Accent) */}
          <motion.a
            href="/v2ray"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: { scale: 1, y: 0, borderColor: 'rgba(255, 255, 255, 0.07)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
              hover: { scale: 1.018, y: -6, borderColor: 'rgba(16, 185, 129, 0.45)', boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.15)' },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              minHeight: '230px',
              background: '#0B0B0D',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '20px',
              padding: '24px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.7), transparent)',
                pointerEvents: 'none', zIndex: 12,
              }}
            />

            {/* Ambient Radial Sphere Glow */}
            <motion.div
              variants={{ initial: { opacity: 0, scale: 0.8 }, hover: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px',
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28), transparent 70%)',
                pointerEvents: 'none', zIndex: 3, filter: 'blur(20px)',
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/category-bg-v2ray.png.jpeg"
              alt="V2Ray Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.35 },
                hover: { scale: 1.12, x: -8, opacity: 0.65 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: '65%',
                objectFit: 'cover',
                maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 35%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 35%, transparent 100%)',
                pointerEvents: 'none',
              }}
              onError={(e: any) => { e.target.src = '/images/v2ray.png'; }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, #0B0B0D 0%, rgba(11,11,13,0.85) 60%, transparent 100%)',
              }}
            />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
                {[
                  { name: 'SLT', logo: '/images/slt-logo.png' },
                  { name: 'Airtel', logo: '/images/airtel-logo.png' },
                  { name: 'Dialog', logo: '/images/dialog-logo.png' },
                  { name: 'Hutch', logo: '/images/hutch-logo.png' },
                  { name: 'Mobitel', logo: '/images/mobitel-logo.png' },
                ].map((isp, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '28px', height: '28px', borderRadius: '6px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '4px', backdropFilter: 'blur(4px)',
                    }}
                  >
                    <img src={isp.logo} alt={isp.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px' }}>
                V2Ray Services
              </h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
                Ultra-fast &amp; reliable secure connections
              </p>
            </div>

            <div style={{ position: 'relative', zIndex: 10, marginTop: '20px' }}>
              <motion.button
                variants={{
                  initial: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
                  hover: { backgroundColor: 'rgba(16, 185, 129, 0.16)', borderColor: 'rgba(16, 185, 129, 0.4)' },
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                View Plans
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'inline-flex' }}
                >
                  <ArrowRight size={14} color="#10b981" />
                </motion.span>
              </motion.button>
            </div>
          </motion.a>

          {/* CARD 2: Discord Nitro & Boosts (Discord Blurple Accent) */}
          <motion.a
            href="/discord"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: { scale: 1, y: 0, borderColor: 'rgba(255, 255, 255, 0.07)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
              hover: { scale: 1.018, y: -6, borderColor: 'rgba(88, 101, 242, 0.45)', boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(88, 101, 242, 0.15)' },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              minHeight: '230px',
              background: '#0B0B0D',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '20px',
              padding: '24px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(88, 101, 242, 0.7), transparent)',
                pointerEvents: 'none', zIndex: 12,
              }}
            />

            {/* Ambient Radial Sphere Glow */}
            <motion.div
              variants={{ initial: { opacity: 0, scale: 0.8 }, hover: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px',
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(88, 101, 242, 0.28), transparent 70%)',
                pointerEvents: 'none', zIndex: 3, filter: 'blur(20px)',
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/category-bg-discord.png"
              alt="Discord Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.35 },
                hover: { scale: 1.12, x: -8, opacity: 0.65 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: '65%',
                objectFit: 'cover',
                maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 35%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 35%, transparent 100%)',
                pointerEvents: 'none',
              }}
              onError={(e: any) => { e.target.src = '/images/discord.png'; }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, #0B0B0D 0%, rgba(11,11,13,0.85) 60%, transparent 100%)',
              }}
            />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '6px', backdropFilter: 'blur(4px)',
                  marginBottom: '14px',
                }}
              >
                <img
                  src="/images/discord-icon.png"
                  alt="Discord"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e: any) => { e.target.style.display = 'none'; }}
                />
              </div>

              <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px' }}>
                Discord Nitro &amp; Boosts
              </h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
                Instant activation codes
              </p>
            </div>

            <div style={{ position: 'relative', zIndex: 10, marginTop: '20px' }}>
              <motion.button
                variants={{
                  initial: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
                  hover: { backgroundColor: 'rgba(88, 101, 242, 0.16)', borderColor: 'rgba(88, 101, 242, 0.4)' },
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                Explore Discord
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'inline-flex' }}
                >
                  <ArrowRight size={14} color="#5865F2" />
                </motion.span>
              </motion.button>
            </div>
          </motion.a>
        </div>

        {/* ─── ROW 2: 0.8fr | 1.2fr ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: '16px',
          }}
        >
          {/* CARD 3: Premium Software (Pink / Magenta Accent) */}
          <motion.a
            href="/catalog"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: { scale: 1, y: 0, borderColor: 'rgba(255, 255, 255, 0.07)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
              hover: { scale: 1.018, y: -6, borderColor: 'rgba(236, 72, 153, 0.45)', boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(236, 72, 153, 0.15)' },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              gridColumn: 'span 5',
              minHeight: '210px',
              background: '#0B0B0D',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '20px',
              padding: '24px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
            className="bento-card-responsive"
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(236, 72, 153, 0.7), transparent)',
                pointerEvents: 'none', zIndex: 12,
              }}
            />

            {/* Ambient Radial Sphere Glow */}
            <motion.div
              variants={{ initial: { opacity: 0, scale: 0.8 }, hover: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px',
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(236, 72, 153, 0.28), transparent 70%)',
                pointerEvents: 'none', zIndex: 3, filter: 'blur(20px)',
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/category-bg-software.png"
              alt="Software Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.35 },
                hover: { scale: 1.12, x: -8, opacity: 0.65 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: '65%',
                objectFit: 'cover',
                maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 35%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 35%, transparent 100%)',
                pointerEvents: 'none',
              }}
              onError={(e: any) => { e.target.src = '/images/software.png'; }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, #0B0B0D 0%, rgba(11,11,13,0.85) 60%, transparent 100%)',
              }}
            />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
                {[
                  { name: 'Discord', icon: '/images/discord-icon.png' },
                  { name: 'Netflix', icon: '/images/hero-netflix.png' },
                  { name: 'CapCut', icon: '/images/hero-capcut.png' },
                  { name: 'ChatGPT', icon: '/images/chatgpt.png' },
                  { name: 'YouTube', icon: '/images/youtube.png' },
                ].map((sw, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '28px', height: '28px', borderRadius: '6px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '4px', backdropFilter: 'blur(4px)',
                    }}
                  >
                    <img
                      src={sw.icon}
                      alt={sw.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e: any) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px' }}>
                Premium Software
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                Netflix • ChatGPT • CapCut
              </p>
            </div>

            <div style={{ position: 'relative', zIndex: 10, marginTop: '16px' }}>
              <motion.button
                variants={{
                  initial: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
                  hover: { backgroundColor: 'rgba(236, 72, 153, 0.16)', borderColor: 'rgba(236, 72, 153, 0.4)' },
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                Browse
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'inline-flex' }}
                >
                  <ArrowRight size={14} color="#ec4899" />
                </motion.span>
              </motion.button>
            </div>
          </motion.a>

          {/* CARD 4: App & Discord Bot Hosting (Cyan / Sky Blue Accent) */}
          <motion.a
            href="/bot-hosting"
            whileHover="hover"
            initial="initial"
            variants={{
              initial: { scale: 1, y: 0, borderColor: 'rgba(255, 255, 255, 0.07)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
              hover: { scale: 1.018, y: -6, borderColor: 'rgba(56, 189, 248, 0.45)', boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(56, 189, 248, 0.15)' },
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              gridColumn: 'span 7',
              minHeight: '210px',
              background: '#0B0B0D',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '20px',
              padding: '24px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
            className="bento-card-responsive"
          >
            {/* Top Hairline Glow */}
            <motion.div
              variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.7), transparent)',
                pointerEvents: 'none', zIndex: 12,
              }}
            />

            {/* Ambient Radial Sphere Glow */}
            <motion.div
              variants={{ initial: { opacity: 0, scale: 0.8 }, hover: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px',
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.28), transparent 70%)',
                pointerEvents: 'none', zIndex: 3, filter: 'blur(20px)',
              }}
            />

            {/* Animated Background Artwork */}
            <motion.img
              src="/images/vps.png"
              alt="Hosting Background"
              variants={{
                initial: { scale: 1, x: 0, opacity: 0.35 },
                hover: { scale: 1.12, x: -8, opacity: 0.65 },
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: '65%',
                objectFit: 'cover',
                maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)',
                pointerEvents: 'none',
              }}
              onError={(e: any) => { e.target.src = '/images/technology.png'; }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, #0B0B0D 0%, rgba(11,11,13,0.85) 60%, transparent 100%)',
              }}
            />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
                <div
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '5px', backdropFilter: 'blur(4px)',
                  }}
                >
                  <img src="/images/discord-icon.png" alt="Discord Bot" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#38bdf8', backdropFilter: 'blur(4px)',
                  }}
                >
                  <Server size={18} />
                </div>
                <div
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#a78bfa', backdropFilter: 'blur(4px)',
                  }}
                >
                  <Globe size={18} />
                </div>
                <div
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#34d399', backdropFilter: 'blur(4px)',
                  }}
                >
                  <Code size={18} />
                </div>
              </div>

              <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px' }}>
                App &amp; Discord Bot Hosting
              </h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 4px' }}>
                Web Hosting &amp; Bot Servers powered by <span style={{ color: '#38bdf8', fontWeight: 700 }}>shanutechx.com</span>
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.7)', margin: 0 }}>
                24/7 Uptime • Node.js • Python • High Performance
              </p>
            </div>

            <div style={{ position: 'relative', zIndex: 10, marginTop: '16px' }}>
              <motion.button
                variants={{
                  initial: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
                  hover: { backgroundColor: 'rgba(56, 189, 248, 0.16)', borderColor: 'rgba(56, 189, 248, 0.4)' },
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                Host Now
                <motion.span
                  variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'inline-flex' }}
                >
                  <ArrowRight size={14} color="#38bdf8" />
                </motion.span>
              </motion.button>
            </div>
          </motion.a>
        </div>

        {/* ─── ROW 3: CARD 5: Game Accounts / Game Keys (Purple / Violet Accent) ─── */}
        <motion.a
          href="/vps"
          whileHover="hover"
          initial="initial"
          variants={{
            initial: { scale: 1, y: 0, borderColor: 'rgba(255, 255, 255, 0.07)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
            hover: { scale: 1.018, y: -6, borderColor: 'rgba(168, 85, 247, 0.45)', boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(168, 85, 247, 0.15)' },
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            minHeight: '250px',
            background: '#0B0B0D',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '20px',
            padding: '32px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textDecoration: 'none',
          }}
        >
          {/* Top Hairline Glow */}
          <motion.div
            variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.7), transparent)',
              pointerEvents: 'none', zIndex: 12,
            }}
          />

          {/* Ambient Radial Sphere Glow */}
          <motion.div
            variants={{ initial: { opacity: 0, scale: 0.8 }, hover: { opacity: 1, scale: 1 } }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px',
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.28), transparent 70%)',
              pointerEvents: 'none', zIndex: 3, filter: 'blur(20px)',
            }}
          />

          {/* Automatic continuous Game Banner Slideshow Container */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '64%',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={slideIdx}
                src={GAME_SLIDES[slideIdx]}
                alt="Game Cover"
                initial={{ opacity: 0, scale: 1.05, x: 0 }}
                animate={{ opacity: 0.55, scale: 1.0, x: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                variants={{
                  hover: { scale: 1.12, x: -8, opacity: 0.8 },
                }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'right center',
                  maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 50%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 50%, transparent 100%)',
                }}
                onError={(e: any) => { e.target.style.display = 'none'; }}
              />
            </AnimatePresence>

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, #0B0B0D 0%, rgba(11,11,13,0.7) 45%, transparent 100%)',
              }}
            />
          </div>

          {/* Left Content */}
          <div style={{ position: 'relative', zIndex: 10, maxWidth: '480px' }}>
            <div
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <ShoppingBag size={18} color="rgba(255,255,255,0.9)" />
            </div>

            <h3 style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              Game Accounts / Game Keys
            </h3>
            <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              Premium game accounts and activation keys
            </p>

            <motion.button
              variants={{
                initial: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
                hover: { backgroundColor: 'rgba(168, 85, 247, 0.16)', borderColor: 'rgba(168, 85, 247, 0.4)' },
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 22px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              Browse All
              <motion.span
                variants={{ initial: { x: 0 }, hover: { x: 5 } }}
                transition={{ duration: 0.3 }}
                style={{ display: 'inline-flex' }}
              >
                <ArrowRight size={14} color="#a78bfa" />
              </motion.span>
            </motion.button>
          </div>
        </motion.a>
      </div>

      {/* Responsive Grid Breakpoints */}
      <style jsx global>{`
        @media (max-width: 868px) {
          .bento-card-responsive { grid-column: span 12 !important; min-height: 210px !important; }
        }
      `}</style>
    </section>
  );
}
