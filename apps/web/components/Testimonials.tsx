'use client';

import { useState, useEffect } from 'react';
import Reveal from './motion/Reveal';

const TESTIMONIALS = [
  {
    quote: 'Deploying my Node app was genuinely a five-minute job. No SSH, no nginx config, it just got a subdomain and worked.',
    name: 'Aiden Morse',
    role: 'Indie Developer',
    avatar: 'AM',
    gradient: 'from-accent-violet to-accent-teal',
  },
  {
    quote: 'Support actually replies on WhatsApp instead of leaving me waiting on a ticket queue. That alone is worth the subscription.',
    name: 'Priya Nair',
    role: 'Small Business Owner',
    avatar: 'PN',
    gradient: 'from-accent-teal to-accent-teal-bright',
  },
  {
    quote: 'Moved three Discord bots over and the dashboard logs make debugging so much easier than SSH-ing in every time.',
    name: 'Lucas Schmidt',
    role: 'Bot Developer',
    avatar: 'LS',
    gradient: 'from-accent-violet-light to-accent-violet',
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5 mb-4">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((v) => (v + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="testimonials" className="px-4 py-28 max-w-5xl mx-auto">
      <Reveal className="text-center mb-14">
        <span className="glass inline-block rounded-full px-4 py-1 text-xs text-text-muted mb-4">
          Testimonials
        </span>
        <h2 className="text-display">
          Loved by <span className="text-gradient">developers</span>
        </h2>
        <p className="text-text-muted mt-3">
          See what customers have to say about hosting with us.
        </p>
      </Reveal>

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} index={i}>
            <div
              onClick={() => setActive(i)}
              className={`glass rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                active === i
                  ? 'border-accent-violet/40 ring-1 ring-accent-violet/30 scale-[1.02]'
                  : 'hover:bg-white/[0.05]'
              }`}
            >
              <div>
                <StarRating />
                <p className="text-text-primary text-sm leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">{t.name}</div>
                  <div className="text-xs text-text-muted">{t.role}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Dot Indicators */}
      <div className="flex justify-center gap-2 mt-8">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active === i ? 'w-6 bg-accent-violet' : 'w-1.5 bg-white/20'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
