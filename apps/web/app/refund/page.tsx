import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import GradientMeshOrb from '../../components/GradientMeshOrb';
import { RefreshCw, ShieldCheck, DollarSign } from 'lucide-react';

export const metadata = {
  title: 'Refund & Cancellation Policy | ShanuTechX Cloud',
  description: 'Understand the refund conditions, cancellation terms, and SLA credit guarantees for ShanuTechX Cloud hosting products.',
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-purple-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#7c3aed26_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 pt-32 pb-24 space-y-12 relative z-10 w-full">
        <div className="relative space-y-4 pt-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono font-bold uppercase">
            <RefreshCw className="h-3.5 w-3.5 text-purple-400" />
            CUSTOMER PROTECTION
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            Refund &amp; Cancellation <span className="text-purple-400">Policy</span>
          </h1>
          <p className="text-xs font-mono text-text-muted">Last Updated: September 2026</p>
        </div>

        <div className="bg-[#090a1c]/90 border border-white/10 rounded-3xl p-8 space-y-6 text-xs leading-relaxed text-text-muted backdrop-blur-md">
          <section className="space-y-2">
            <h2 className="text-base font-extrabold text-white">1. 7-Day Money-Back Guarantee</h2>
            <p>
              We offer a 7-day money-back guarantee for new subscriptions on Web App Hosting, Bot Hosting, and Managed Database plans if service delivery fails to meet stated technical specifications.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-extrabold text-white">2. Cloud VPS Allocations</h2>
            <p>
              Unmanaged Cloud VPS server node allocations are non-refundable once root access credentials have been issued and IP transit bandwidth has been allocated, unless an extended outage occurs that violates our 99.9% SLA commitment.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-extrabold text-white">3. Refund Request Process</h2>
            <p>
              To request a refund or SLA credit, submit a ticket in your Client Dashboard or contact support via Discord ticket within 7 days of payment. Refund processing completes within 3 to 5 business days.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
