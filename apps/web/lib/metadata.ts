import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shanutechx.com';

export const siteMetadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'SHANUTECHX — Hosting that gets out of your way',
    template: '%s | SHANUTECHX',
  },
  description:
    'Deploy web apps, Node.js and Python services, and Discord bots in minutes. Automatic subdomains, SSL, and payment verification built for Sri Lanka.',
  keywords: [
    'web hosting Sri Lanka',
    'Node.js hosting',
    'Python hosting',
    'Discord bot hosting',
    'VPS Sri Lanka',
    'SMTP hosting',
  ],
  authors: [{ name: 'SHANUTECHX', url: BASE_URL }],
  creator: 'SHANUTECHX',
  openGraph: {
    type: 'website',
    locale: 'en_LK',
    url: BASE_URL,
    siteName: 'SHANUTECHX',
    title: 'SHANUTECHX — Hosting that gets out of your way',
    description:
      'Deploy web apps, Node.js and Python services, and Discord bots in minutes. Built for Sri Lanka.',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'SHANUTECHX Hosting Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SHANUTECHX — Hosting that gets out of your way',
    description: 'Deploy web apps, Node.js and Python services, and Discord bots in minutes.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: BASE_URL },
};
