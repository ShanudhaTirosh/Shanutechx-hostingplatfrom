'use client';

import { useState } from 'react';
import Reveal from './motion/Reveal';

const DEFAULT_FAQS = [
  {
    q: 'What runtimes do you support?',
    a: 'Static/web hosting, Node.js, Python, and Discord bots in both Python and Node.js. We auto-detect the runtime from your repository — no config files needed.',
  },
  {
    q: 'Do I need to manage DNS or SSL myself?',
    a: 'No. Every deployment gets an automatic subdomain (e.g. myapp.shanutechx.com) and a free SSL certificate the moment it goes live.',
  },
  {
    q: 'How do I pay, and how is payment verified?',
    a: 'You can pay manually and upload a proof of payment, or via supported local payment methods. Most payments are verified automatically within minutes; anything uncertain is reviewed by a human before your service activates.',
  },
  {
    q: 'Can I get a VPS instead of managed hosting?',
    a: "Yes — we resell VPS plans for anyone who wants full control. You manage your VPS through the provider's own control panel, and we handle provisioning for you.",
  },
  {
    q: 'How fast can I deploy?',
    a: 'From git push to live URL in under 60 seconds for most projects. Our build system auto-detects your framework and installs dependencies automatically.',
  },
  {
    q: 'What happens if my service goes down?',
    a: 'You get real-time alerts via WhatsApp and Discord. Our monitoring runs every 30 seconds — if we detect downtime, we notify you and begin auto-recovery immediately.',
  },
];

interface FAQItem { q: string; a: string; }

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-text-muted transition-transform duration-300 shrink-0 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

export default function FAQ({ items }: { items?: FAQItem[] }) {
  const faqs = items && items.length > 0 ? items : DEFAULT_FAQS;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="px-4 py-28 max-w-3xl mx-auto">
      <Reveal className="text-center mb-12">
        <span className="glass inline-block rounded-full px-4 py-1 text-xs text-text-muted mb-4">
          FAQ
        </span>
        <h2 className="text-display">
          Frequently asked <span className="text-gradient">questions</span>
        </h2>
      </Reveal>

      <div className="space-y-3">
        {faqs.map((item, i) => {
          const open = openIndex === i;
          return (
            <Reveal key={item.q} index={i % 6}>
              <div
                className={`glass rounded-2xl overflow-hidden transition-all duration-200 ${open ? 'border-white/12' : ''}`}
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-text-primary hover:bg-white/[0.03] transition-colors"
                >
                  <span className="pr-4">{item.q}</span>
                  <ChevronIcon open={open} />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-5 pb-5 pt-1 text-sm text-text-muted leading-relaxed border-t border-white/[0.05]">
                    {item.a}
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
