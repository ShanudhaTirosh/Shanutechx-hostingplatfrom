import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { HelpCircle, MessageSquare, ChevronDown, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Frequently Asked Questions (FAQs) | ShanuTechX Cloud',
  description: 'Find answers to common questions about VPS provisioning, bot hosting, payments, domain management, and SLA guarantees.',
};

export default function FaqsPage() {
  const faqs = [
    {
      q: 'How fast are VPS allocations provisioned after payment?',
      a: 'VPS server allocations are provisioned automatically upon payment approval. Your root credentials, IP address, and SSH port details will appear in your client dashboard instantly.',
    },
    {
      q: 'What operating systems are supported on Cloud VPS?',
      a: 'We support Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, Debian 12, AlmaLinux 9, Rocky Linux 9, and Alpine Linux.',
    },
    {
      q: 'Can I host 24/7 Discord, Telegram, and WhatsApp bots?',
      a: 'Yes! Our 24/7 Bot Hosting plans come with automatic reboot policies, zero sleep timeouts, and process monitoring so your bot stays online continuously.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept major credit/debit cards (Visa, Mastercard, Amex), bank transfer receipts, and local Sri Lankan payment gateways via manual approval.',
    },
    {
      q: 'What is your uptime guarantee?',
      a: 'We offer a 99.9% uptime SLA backed by redundant network transit, automated health checks, and global edge routing.',
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#7c3aed26_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-6 pt-32 pb-24 space-y-16 relative z-10 w-full">
        <div className="relative text-center space-y-6 pt-6">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <GradientMeshOrb size={480} opacity={0.8} glowColor="rgba(124, 58, 237, 0.65)" />
          </div>

          <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold tracking-widest uppercase shadow-glow-violet">
              <HelpCircle className="h-3.5 w-3.5 text-purple-400" />
              GOT QUESTIONS?
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300">Questions</span>
            </h1>
            <p className="text-base text-text-muted leading-relaxed max-w-2xl mx-auto">
              Everything you need to know about our cloud services, billing, and technical operations.
            </p>
          </div>
        </div>

        {/* FAQs Accordion Cards */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-[#090a1c]/90 border border-white/10 rounded-2xl p-6 space-y-3 hover:border-purple-500/40 transition-all shadow-lg backdrop-blur-md"
            >
              <h3 className="text-base font-extrabold text-white flex items-center justify-between gap-4">
                <span>{faq.q}</span>
                <ChevronDown className="h-4 w-4 text-purple-400 shrink-0" />
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
