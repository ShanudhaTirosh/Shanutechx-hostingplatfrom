import React from 'react';
import { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Contact from '@/components/Contact';
import GradientMeshOrb from '@/components/GradientMeshOrb';

export const metadata: Metadata = {
  title: 'Contact Us & 24/7 Live Technical Support | ShanuTechX Cloud',
  description:
    'Get in touch with ShanuTechX engineering and support team via WhatsApp (+94 77 123 4567), Phone hotline (+1 800 589-STX1), Discord, or Email (support@shanutechx.cloud). 24/7/365 live cloud support.',
  keywords: [
    'ShanuTechX Contact',
    'VPS Support',
    'Cloud Hosting WhatsApp',
    'Discord Hosting Support',
    'Technical Support Desk',
    'Billing Inquiry',
    'Enterprise VPS Quote',
  ],
  alternates: {
    canonical: 'https://shanutechx.cloud/contact',
  },
  openGraph: {
    title: 'Contact Us & 24/7 Live Technical Support | ShanuTechX Cloud',
    description:
      'Connect directly with ShanuTechX Tier-3 system engineers via WhatsApp, Phone, Discord, or Email.',
    url: 'https://shanutechx.cloud/contact',
    siteName: 'ShanuTechX Cloud Infrastructure',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us & 24/7 Live Technical Support | ShanuTechX Cloud',
    description:
      'Connect directly with ShanuTechX Tier-3 system engineers via WhatsApp, Phone, Discord, or Email.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ShanuTechX Cloud Infrastructure',
  url: 'https://shanutechx.cloud',
  logo: 'https://shanutechx.cloud/logo.png',
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: '+1-800-589-7891',
      contactType: 'customer service',
      email: 'support@shanutechx.cloud',
      availableLanguage: ['English', 'Sinhala'],
      areaServed: 'Worldwide',
    },
    {
      '@type': 'ContactPoint',
      telephone: '+94-77-123-4567',
      contactType: 'technical support',
      contactOption: 'TollFree',
      availableLanguage: ['English', 'Sinhala'],
      areaServed: 'Worldwide',
    },
  ],
  sameAs: [
    'https://discord.gg/shanutechx',
    'https://wa.me/94771234567',
  ],
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-transparent text-white font-sans flex flex-col justify-between selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none z-0" />

      {/* Background Ambient Orb */}
      <div className="absolute left-1/2 top-36 -translate-x-1/2 pointer-events-none select-none z-0">
        <GradientMeshOrb size={600} opacity={0.6} glowColor="rgba(124, 58, 237, 0.4)" />
      </div>

      {/* JSON-LD Structured Data for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Navbar />

      <main className="flex-1 pt-32 pb-24 relative z-10">
        <Contact />
      </main>

      <Footer />
    </div>
  );
}
