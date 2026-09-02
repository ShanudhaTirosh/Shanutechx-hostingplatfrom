import { Zap, Code, Bot, Globe, Monitor } from 'lucide-react';

interface HeroProps {
  title?: string;
  subtitle?: string;
}

const DEFAULT_SUBTITLE =
  'Deploy web apps, Node.js and Python services, and Discord bots in minutes. Automatic subdomains, automatic SSL, zero port conflicts.';

const BADGES = [
  { icon: Zap, label: 'Node.js' },
  { icon: Code, label: 'Python' },
  { icon: Bot, label: 'Discord Bots' },
  { icon: Globe, label: 'Web Hosting' },
  { icon: Monitor, label: 'VPS' },
];

const STATS = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<60s', label: 'Deploy Time' },
  { value: '24/7', label: 'Support' },
];

export default function Hero({ title, subtitle }: HeroProps) {
  return (
    <section className="relative flex flex-col items-center text-center pt-44 pb-28 px-4 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-accent-violet/20 blur-[120px] animate-orb-pulse" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] rounded-full bg-accent-teal/10 blur-[80px] animate-orb-pulse delay-300" />
        <div className="absolute top-32 right-1/4 w-[250px] h-[250px] rounded-full bg-accent-violet-light/10 blur-[80px] animate-orb-pulse delay-500" />
        <div className="dot-pattern absolute inset-0 opacity-40" />
      </div>

      {/* Badge Row */}
      <div className="flex items-center gap-2 flex-wrap justify-center mb-8 animate-fade-in">
        {BADGES.map((badge) => {
          const Icon = badge.icon;
          return (
            <span
              key={badge.label}
              className="glass rounded-full px-3 py-1 text-xs text-text-muted flex items-center gap-1.5 hover:text-text-primary transition-colors"
            >
              <Icon className="h-3.5 w-3.5 text-accent-violet-light" />
              {badge.label}
            </span>
          );
        })}
      </div>

      {/* Heading */}
      <div className="animate-slide-up">
        {title ? (
          <h1 className="max-w-3xl text-5xl md:text-7xl font-bold tracking-tight leading-[1.08]">
            {title}
          </h1>
        ) : (
          <h1 className="max-w-3xl text-5xl md:text-7xl font-bold tracking-tight leading-[1.08]">
            Hosting that gets out of
            <span className="text-gradient block md:inline"> your way</span>
          </h1>
        )}
      </div>

      {/* Subtitle */}
      <p className="max-w-xl mt-6 text-text-muted text-base md:text-lg leading-relaxed animate-slide-up delay-100">
        {subtitle || DEFAULT_SUBTITLE}
      </p>

      {/* CTA Buttons */}
      <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-slide-up delay-200">
        <a
          href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001'}/login`}
          className="btn-shimmer rounded-full px-8 py-3.5 font-semibold text-white text-sm shadow-glow-violet"
        >
          Get started free →
        </a>
        <a
          href="/pricing"
          className="glass rounded-full px-8 py-3.5 font-medium text-text-primary text-sm hover:bg-white/[0.07] transition-colors"
        >
          See pricing
        </a>
      </div>

      {/* Stats Row */}
      <div className="mt-16 flex items-center gap-8 md:gap-16 animate-fade-in delay-400">
        {STATS.map((stat, i) => (
          <div key={stat.label} className="text-center">
            <div className="text-2xl font-bold text-gradient-warm">{stat.value}</div>
            <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float opacity-40">
        <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
          <rect x="1" y="1" width="18" height="26" rx="9" stroke="currentColor" strokeWidth="1.5" className="text-text-muted"/>
          <circle cx="10" cy="8" r="3" fill="currentColor" className="text-accent-teal-bright animate-pulse"/>
        </svg>
      </div>
    </section>
  );
}
