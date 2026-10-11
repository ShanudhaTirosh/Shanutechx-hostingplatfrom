import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center & Customer Support Hub',
  description:
    'Need assistance? Explore setup guides, platform tutorials, community support channels, Discord gateway, and priority support ticketing.',
  openGraph: {
    title: 'Help Center & Support Hub | STX HOSTING',
    description:
      'Support resources, deployment walkthroughs, and direct customer assistance for ShanuTechX platform users.',
  },
  alternates: {
    canonical: '/help',
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
