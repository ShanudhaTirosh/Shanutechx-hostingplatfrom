import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transparent Cloud Hosting Pricing — LKR & USD',
  description:
    'Explore flexible, transparent cloud hosting pricing for NVMe Cloud VPS, 24/7 Discord bots, Node.js & Python apps, and managed database clusters. Pay in LKR or USD.',
  openGraph: {
    title: 'Transparent Cloud Hosting Pricing — LKR & USD | STX HOSTING',
    description:
      'Compare high-performance Cloud VPS, Bot hosting, and Managed Database plans with instant automated activation.',
  },
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
