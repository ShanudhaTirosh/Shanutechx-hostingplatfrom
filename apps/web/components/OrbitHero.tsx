'use client';

import { useState, useEffect, useRef } from 'react';
import GlobeOrb from './GlobeOrb';
import { ArrowRight, Star, ShieldCheck, Zap, Server, Activity, Users, Globe, Database, Cpu, Terminal, Bot } from 'lucide-react';
import CyberConstellationMotion from './motion/CyberConstellationMotion';
import BorderBeam from './motion/BorderBeam';

function useCounter(end: string | number, duration = 1800) {
  const [count, setCount] = useState<number | string>(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const num = typeof end === 'number' ? end : parseFloat(end);
    if (isNaN(num)) {
      setCount(end);
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * num));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(num);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return { count, ref };
}

function StatPill({ value, suffix, label }: { value: string | number; suffix: string; label: string }) {
  const { count, ref } = useCounter(value);
  const isNum = !isNaN(parseFloat(String(value)));
  return (
    <div
      ref={ref}
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '12px 18px',
        textAlign: 'center',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          fontSize: '22px',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #a78bfa, #38bdf8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {isNum ? count : value}{suffix}
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function OrbitHero() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  // Tech badges withLucide icons bobbing around hero globe
  const floatBadges = [
    { name: 'Node.js', icon: <Zap className="h-6 w-6 text-emerald-400" />, top: '5%', left: '0%', dur: 6.5, delay: 0 },
    { name: 'VPS Compute', icon: <Server className="h-6 w-6 text-sky-400" />, top: '8%', right: '2%', dur: 7.2, delay: 1.1 },
    { name: 'Managed DB', icon: <Database className="h-6 w-6 text-purple-400" />, bottom: '18%', left: '-4%', dur: 6.8, delay: 0.5 },
    { name: 'Bot Runtime', icon: <Bot className="h-6 w-6 text-pink-400" />, bottom: '10%', right: '0%', dur: 8.0, delay: 1.8 },
    { name: 'Docker Catalog', icon: <Cpu className="h-6 w-6 text-indigo-400" />, top: '48%', left: '-8%', dur: 7.5, delay: 0.8 },
    { name: 'Terminal SSH', icon: <Terminal className="h-6 w-6 text-teal-400" />, top: '45%', right: '-6%', dur: 6.2, delay: 1.4 },
  ];

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '88vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px 10px',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        background: 'transparent',
      }}
    >
      {/* Interactive Cyber Constellation Motion Graphics Background */}
      <CyberConstellationMotion nodeCount={32} maxDistance={125} speed={0.4} />

      {/* Apple-style Dot Grid Pattern Overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.18) 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%)',
          pointerEvents: 'none',
          opacity: 0.85,
          zIndex: 1,
        }}
      />

      <div
        style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          alignItems: 'center',
          gap: '40px',
          zIndex: 2,
        }}
        className="grid md:grid-cols-2"
      >
        {/* Left Column: Headline & Value Proposition */}
        <div>
          {/* Top Country Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(124, 58, 237, 0.12)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              borderRadius: '9999px',
              padding: '6px 18px',
              fontSize: '13px',
              fontWeight: 800,
              color: '#a78bfa',
              marginBottom: '24px',
              boxShadow: '0 0 20px rgba(124, 58, 237, 0.2)',
            }}
          >
            <Globe size={14} style={{ display: 'inline-block', marginRight: '6px', color: '#a78bfa', verticalAlign: 'middle' }} />
            Sri Lanka's #1 Hosting &amp; Cloud Platform
          </div>

          {/* Main Title */}
          <h1
            style={{
              fontSize: 'clamp(40px, 5.5vw, 64px)',
              fontWeight: 900,
              lineHeight: 1.08,
              color: '#ffffff',
              letterSpacing: '-0.03em',
              margin: '0 0 20px 0',
            }}
          >
            Everything Cloud. <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              One Autonomous Engine.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: '#94a3b8',
              maxWidth: '540px',
              margin: '0 0 32px 0',
            }}
          >
            Deploy web apps, Node.js and Python services, Discord bots, managed databases, and KVM VPS instances in minutes — genuine performance, zero hassle.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '36px' }}>
            <a
              href="#pricing"
              style={{
                padding: '14px 28px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                color: '#fff',
                fontWeight: 900,
                fontSize: '15px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 12px 32px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.2s ease',
                textDecoration: 'none',
              }}
            >
              Explore Products <ArrowRight size={16} />
            </a>

            <a
              href="/vps"
              style={{
                padding: '14px 24px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#f8fafc',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(10px)',
                textDecoration: 'none',
              }}
            >
              Cloud VPS Plans <ArrowRight size={16} />
            </a>
          </div>

          {/* Live Stat Counter Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '28px',
              maxWidth: '520px',
            }}
          >
            <StatPill value="99.9" suffix="%" label="Uptime" />
            <StatPill value="5" suffix="+" label="Regions" />
            <StatPill value="24" suffix="/7" label="Support" />
            <StatPill value="1000" suffix="+" label="Deploys" />
          </div>

          {/* Trustpilot Score with Motion BorderBeam */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(15,23,42,0.75)',
              padding: '10px 16px',
              borderRadius: '14px',
              width: 'fit-content',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            <BorderBeam size={160} duration={7} colorFrom="#10b981" colorTo="#38bdf8" />
            <div style={{ display: 'flex', gap: '3px', position: 'relative', zIndex: 1 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    background: '#00b67a',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '3px',
                  }}
                >
                  <Star size={11} fill="#fff" color="#fff" />
                </div>
              ))}
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#fff' }}>4.5 / 5 </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Based on 15 reviews </span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#00b67a', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Star size={12} fill="#00b67a" color="#00b67a" />
                Trustpilot
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D D3 Globe */}
        <div
          style={{
            position: 'relative',
            height: '480px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GlobeOrb size={480} />

          {/* Center floating STX logo circle sitting over 3D Globe */}
          <div
            style={{
              position: 'absolute',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 20px 48px rgba(0, 0, 0, 0.75), 0 0 40px rgba(168, 85, 247, 0.45), inset 0 0 25px rgba(56, 189, 248, 0.3)',
              animation: 'stxCenterFloat 4s ease-in-out infinite',
              zIndex: 4,
            }}
          >
            <img
              src="/STX.png"
              alt="STX Logo"
              style={{ width: '54px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.5))' }}
            />
          </div>

          {/* Floating tech badges */}
          {floatBadges.map((b, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: b.top,
                bottom: b.bottom,
                left: b.left,
                right: b.right,
                animation: `stxFloat ${b.dur}s ease-in-out infinite`,
                animationDelay: `${b.delay}s`,
                pointerEvents: 'auto',
                zIndex: 3,
              }}
            >
              <div
                title={b.name}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(15, 23, 42, 0.82)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(124, 58, 237, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  padding: '10px',
                  overflow: 'hidden',
                  transition: 'transform 0.25s ease, border-color 0.25s ease',
                  cursor: 'pointer',
                }}
              >
                {b.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keyframe animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes stxCenterFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-12px) scale(1.04); }
        }
        @keyframes stxFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }
      ` }} />
    </section>
  );
}
