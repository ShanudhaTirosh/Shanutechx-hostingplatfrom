import type React from 'react';
import Reveal from './motion/Reveal';
import TiltCard from './motion/TiltCard';

const POINTS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: 'One platform, every runtime',
    body: 'Web hosting, Node.js, Python, and Discord bots (Python & Node) all deploy the same way — push a repo, we detect the runtime and build it.',
    color: 'from-accent-violet to-accent-teal',
    glow: 'rgba(124,58,237,0.25)',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    title: 'Your own subdomain, instant SSL',
    body: 'Every deployment gets an automatic subdomain and a free SSL certificate the moment it goes live — no manual DNS or port wrangling on your end.',
    color: 'from-accent-teal to-accent-teal-bright',
    glow: 'rgba(34,211,238,0.25)',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Real support, not just tickets',
    body: 'Live chat with our team, WhatsApp and Discord alerts for your services, and full invoice history for everything you buy.',
    color: 'from-accent-violet-light to-accent-violet',
    glow: 'rgba(168,85,247,0.25)',
  },
];

export default function About() {
  return (
    <section id="about" className="px-4 py-28 max-w-5xl mx-auto">
      <Reveal className="text-center mb-16">
        <span className="glass inline-block rounded-full px-4 py-1 text-xs text-text-muted mb-4">
          Why SHANUTECHX
        </span>
        <h2 className="text-display">
          Built for <span className="text-gradient">builders</span>
        </h2>
        <p className="text-text-muted mt-4 max-w-xl mx-auto leading-relaxed">
          SHANUTECHX runs your hosting, bots, and infra so you can focus on
          what you&apos;re actually building.
        </p>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {POINTS.map((point, idx) => (
          <Reveal key={point.title} index={idx}>
            <TiltCard
              strength={5}
              className="glass-card h-full rounded-2xl p-7 group cursor-default"
              style={{ '--glow-color': point.glow } as React.CSSProperties}
            >
              {/* Icon */}
              <div
                className={`inline-flex h-11 w-11 rounded-xl bg-gradient-to-br ${point.color} items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform duration-300`}
                style={{ boxShadow: `0 4px 20px ${point.glow}` }}
              >
                {point.icon}
              </div>

              <h3 className="font-semibold text-lg mb-2 text-text-primary group-hover:text-gradient transition-all">
                {point.title}
              </h3>
              <p className="text-text-muted text-sm leading-relaxed">{point.body}</p>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
