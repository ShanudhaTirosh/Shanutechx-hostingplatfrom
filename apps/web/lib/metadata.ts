import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shanutechx.com';

export const siteMetadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  applicationName: 'ShanuTechX Cloud Platform',
  title: {
    default: 'STX HOSTING — Cloud Platform & Autonomous Hosting Engine',
    template: '%s | STX HOSTING',
  },
  description:
    'Autonomous enterprise cloud platform. Deploy NVMe Cloud VPS, static and dynamic web hosting, Node.js and Python container backends, 24/7 Discord bots, managed databases, and one-click Docker templates in seconds with instant LKR & USD billing.',
  keywords: [
    'STX HOSTING',
    'ShanuTechX',
    'web hosting Sri Lanka',
    'Cloud VPS Sri Lanka',
    'NVMe VPS hosting',
    'Node.js hosting',
    'Python hosting',
    'Discord bot hosting',
    'Telegram bot hosting',
    'Managed PostgreSQL',
    'Managed MySQL',
    'Redis hosting',
    'Docker container hosting',
    'SMTP hosting Sri Lanka',
    'Supabase self-hosted',
    'Autonomous cloud platform',
  ],
  authors: [{ name: 'ShanuTechX Architecture Team', url: BASE_URL }],
  creator: 'ShanuTechX',
  publisher: 'ShanuTechX',
  category: 'technology',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_LK',
    url: BASE_URL,
    siteName: 'STX HOSTING (ShanuTechX)',
    title: 'STX HOSTING — Autonomous Enterprise Cloud Platform',
    description:
      'Deploy NVMe Cloud VPS, Node.js & Python backends, managed databases, and 24/7 bots instantly with ShanuTechX.',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'STX HOSTING Autonomous Cloud Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STX HOSTING — Autonomous Enterprise Cloud Platform',
    description: 'Deploy Cloud VPS, Node.js/Python apps, databases, and Discord bots in minutes.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: { canonical: BASE_URL },
};
