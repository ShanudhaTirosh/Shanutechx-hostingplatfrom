import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Contact from '@/components/Contact';

export const metadata = {
  title: 'Contact Us & Support — SHANUTECHX Cloud',
  description: 'Get in touch with SHANUTECHX engineering team via email, WhatsApp, Discord, or ticket submission.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#070814] text-white font-sans">
      <Navbar />
      <div className="pt-28 pb-12">
        <Contact />
      </div>
      <Footer />
    </main>
  );
}
