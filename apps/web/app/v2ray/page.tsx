import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import V2RaySection from '@/components/V2RaySection';

export const metadata = {
  title: 'V2Ray Proxy & Netch Configs — SHANUTECHX Cloud',
  description: 'High-speed V2Ray, VMess, VLESS, Trojan, and Netch proxy subscriptions with low-latency node routing.',
  openGraph: {
    title: 'V2Ray Proxy & Netch Configs — SHANUTECHX Cloud',
    description: 'High-speed V2Ray, VMess, VLESS, Trojan, and Netch proxy subscriptions with low-latency node routing.',
  },
};

export default function V2RayPage() {
  return (
    <main className="min-h-screen bg-transparent text-white font-sans">
      <Navbar />
      <div className="pt-28 pb-12">
        <V2RaySection />
      </div>
      <Footer />
    </main>
  );
}
