import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { Star, CheckCircle, Shield, MessageSquare, ThumbsUp, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Customer Reviews & Testimonials | ShanuTechX Cloud',
  description: 'See what developers, startups, and community creators say about ShanuTechX high-performance cloud hosting.',
};

export default function ReviewsPage() {
  const reviews = [
    {
      name: 'Kasun Perera',
      role: 'Full-Stack Developer',
      rating: 5,
      comment: 'Migrated 12 Node.js microservices and PostgreSQL databases to ShanuTechX. 99.99% uptime and sub-20ms latency across Sri Lanka and Asia.',
      verified: true,
      date: '2026-08-14',
    },
    {
      name: 'Dinesh Wickramasinghe',
      role: 'Discord Bot Developer',
      rating: 5,
      comment: 'Our 24/7 Discord bot with 50,000+ members runs flawlessly. Zero dropouts, automatic reboot on memory spikes, and super responsive support.',
      verified: true,
      date: '2026-08-20',
    },
    {
      name: 'Tharindu Fernando',
      role: 'DevOps Engineer',
      rating: 5,
      comment: 'The Cloud VPS allocations and 1-Click App Catalog saved us weeks of setup time. Instant provisioning upon payment approval is unbeatable.',
      verified: true,
      date: '2026-08-28',
    },
    {
      name: 'Nimesha Jayasinghe',
      role: 'E-commerce Founder',
      rating: 5,
      comment: 'Switched our Next.js storefront to ShanuTechX Web App Hosting. Page load speed dropped from 2.4s to 420ms. Incredible value!',
      verified: true,
      date: '2026-09-01',
    },
  ];

  return (
    <div className="min-h-screen bg-[#030014] text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#7c3aed26_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-16 relative z-10 w-full">
        <div className="relative text-center space-y-6 pt-6">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.8} glowColor="rgba(124, 58, 237, 0.65)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              VERIFIED FEEDBACK
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              Customer <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">Reviews &amp; Ratings</span>
            </h1>
            <p className="text-base text-text-muted leading-relaxed max-w-2xl mx-auto font-sans">
              Discover how developers, companies, and bot creators build and scale on ShanuTechX Cloud.
            </p>
          </div>
        </div>

        {/* Rating Summary */}
        <div className="bg-[#0a0a1a]/80 border border-white/10 rounded-3xl p-8 max-w-4xl mx-auto grid sm:grid-cols-3 gap-6 text-center backdrop-blur-xl shadow-2xl">
          <div className="space-y-1 border-r sm:border-r border-white/10 last:border-r-0">
            <div className="text-4xl font-black text-white">4.9 / 5.0</div>
            <div className="flex items-center justify-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-xs text-text-muted font-mono">Average Rating</p>
          </div>

          <div className="space-y-1 border-r sm:border-r border-white/10 last:border-r-0">
            <div className="text-4xl font-black text-white">99.9%</div>
            <p className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Satisfaction Rate
            </p>
            <p className="text-xs text-text-muted font-mono">Verified Deployments</p>
          </div>

          <div className="space-y-1">
            <div className="text-4xl font-black text-white">2,500+</div>
            <p className="text-xs text-purple-400 font-bold">Active Cloud Nodes</p>
            <p className="text-xs text-text-muted font-mono">Global Infrastructure</p>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {reviews.map((rev, idx) => (
            <div
              key={idx}
              className="bg-[#090a1c]/90 border border-white/10 rounded-3xl p-6 space-y-4 hover:border-purple-500/50 transition-all shadow-xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white">{rev.name}</h3>
                  <p className="text-xs text-purple-400 font-mono">{rev.role}</p>
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed font-sans">
                &ldquo;{rev.comment}&rdquo;
              </p>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-text-muted">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Shield className="h-3 w-3" /> Verified Customer
                </span>
                <span>{rev.date}</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
