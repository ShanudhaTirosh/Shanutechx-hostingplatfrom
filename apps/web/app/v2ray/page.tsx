import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import {
  ShieldCheck,
  ExternalLink,
  ShoppingBag,
  ArrowRight,
  Info,
  Home,
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'V2Ray Proxies & Digital Goods | Official STX Store Notice - ShanuTechX',
  description: 'V2Ray Proxies and Digital Goods (Netflix 4K, Spotify, ChatGPT Plus, CapCut Pro) are sold exclusively through our official store at store.shanutechx.com.',
  openGraph: {
    title: 'V2Ray Proxies & Digital Store Notice | ShanuTechX',
    description: 'Notice: V2Ray Proxies and Digital Goods are sold exclusively at store.shanutechx.com.',
    url: 'https://store.shanutechx.com',
  },
};

export default function V2RayPage() {
  const storeUrl = 'https://store.shanutechx.com';

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-12 relative z-10 w-full flex flex-col items-center justify-center text-center">
        {/* Glow Orb Background */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
          <GradientMeshOrb size={480} opacity={0.65} glowColor="rgba(124, 58, 237, 0.55)" />
        </div>

        {/* Informational Card */}
        <div className="bg-[#08091c]/95 border border-purple-500/30 rounded-3xl p-8 sm:p-12 shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(124,58,237,0.15)] backdrop-blur-2xl space-y-8 relative z-10 w-full">
          <div className="flex items-center justify-center">
            <div className="h-16 w-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.4)]">
              <ShoppingBag className="h-8 w-8" />
            </div>
          </div>

          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold tracking-widest uppercase">
              <Info className="h-3.5 w-3.5" />
              Official Store Notice
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Sold Exclusively at{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-sky-400">
                store.shanutechx.com
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed pt-2">
              <strong className="text-white font-semibold">V2Ray Proxies</strong> (VMess, VLess, Trojan, ShadowSocks) and{' '}
              <strong className="text-white font-semibold">Digital Goods</strong> (Netflix 4K, Spotify, CapCut Pro, ChatGPT Plus, Claude, Google AI Pro) are not sold on this cloud hosting portal.
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              They are handled and delivered with automated instant activation exclusively on our dedicated e-commerce store at{' '}
              <span className="text-purple-300 font-mono font-bold">store.shanutechx.com</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-white/10">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white font-extrabold text-sm shadow-[0_0_25px_rgba(168,85,247,0.45)] hover:shadow-[0_0_35px_rgba(168,85,247,0.7)] transition-all flex items-center justify-center gap-2 cursor-pointer font-mono"
            >
              <span>Visit STX Digital Store</span>
              <ExternalLink className="h-4 w-4" />
            </a>

            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4 text-purple-400" />
              <span>Back to Hosting Home</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
