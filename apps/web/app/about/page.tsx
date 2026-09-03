import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import About from '@/components/About';

export const metadata = {
  title: 'About Us — SHANUTECHX Cloud Infrastructure',
  description: 'Learn about SHANUTECHX, our multi-cloud deployment philosophy, global edge network, and engineering values.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-transparent text-white font-sans">
      <Navbar />
      <div className="pt-28 pb-12">
        <About />
      </div>
      <Footer />
    </main>
  );
}
