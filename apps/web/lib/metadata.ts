import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shanutechx.com';

export const siteMetadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'STX HOSTING — Cloud Platform & Autonomous Hosting Engine',
    template: '%s | STX HOSTING',
  },
  description:
    'Deploy web apps, Node.js and Python services, V2Ray proxies, and Discord bots in minutes. Instant subdomains, SSL, and payment verification.',
  keywords: [
    'STX HOSTING',
    'web hosting Sri Lanka',
    'Node.js hosting',
    'Python hosting',
    'Discord bot hosting',
    'VPS Sri Lanka',
    'SMTP hosting',
    'V2Ray VPN',
  ],
  authors: [{ name: 'STX HOSTING', url: BASE_URL }],
  creator: 'STX HOSTING',
  icons: {
    icon: '/STX.png',
    shortcut: '/STX.png',
    apple: '/STX.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_LK',
    url: BASE_URL,
    siteName: 'STX HOSTING',
    title: 'STX HOSTING — Autonomous Enterprise Cloud Platform',
    description:
      'Deploy web apps, Node.js & Python backends, databases, and bots instantly with STX HOSTING.',
    images: [{ url: '/STX.png', width: 1200, height: 630, alt: 'STX HOSTING Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STX HOSTING — Autonomous Enterprise Cloud Platform',
    description: 'Deploy web apps, Node.js and Python services, and Discord bots in minutes.',
    images: ['/STX.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: BASE_URL },
};
