import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { siteMetadata } from '@/lib/metadata';
import MeshBackground from '@/components/MeshBackground';
import { CartProvider } from '@/context/CartContext';

export const metadata: Metadata = {
  ...siteMetadata,
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/STX.png', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
};

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shanutechx.com';

const jsonLdGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'ShanuTechX',
      alternateName: ['STX HOSTING', 'ShanuTechX Cloud'],
      url: BASE_URL,
      logo: `${BASE_URL}/logo.png`,
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: '+94-77-000-0000',
          contactType: 'customer support',
          email: 'support@shanutechx.com',
          availableLanguage: ['English', 'Sinhala'],
        },
      ],
      sameAs: [
        'https://discord.gg/shanutechx',
        'https://github.com/ShanudhaTirosh/Shanutechx-hostingplatfrom',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: BASE_URL,
      name: 'ShanuTechX — Autonomous Cloud Platform',
      publisher: {
        '@id': `${BASE_URL}/#organization`,
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${BASE_URL}/docs?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${BASE_URL}/#software`,
      name: 'STX HOSTING Autonomous Cloud Platform',
      operatingSystem: 'Linux, Docker, KVM',
      applicationCategory: 'BusinessApplication, DeveloperApplication',
      description:
        'Deploy NVMe Cloud VPS, Node.js and Python container backends, 24/7 Discord bots, managed databases, V2Ray proxies, and one-click Docker templates.',
      offers: [
        {
          '@type': 'Offer',
          name: 'Cloud VPS Hosting',
          price: '3.99',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Discord & Telegram Bot Hosting',
          price: '1.49',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Container App Hosting',
          price: '2.49',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Managed Databases (PostgreSQL / MySQL / Redis / MongoDB)',
          price: '2.99',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      ],
      author: {
        '@id': `${BASE_URL}/#organization`,
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="author" href="/humans.txt" />
        <link rel="help" href="/docs" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
        />
      </head>
      <body suppressHydrationWarning className="bg-[#030014] text-white antialiased relative selection:bg-purple-500 selection:text-white min-h-screen">
        <CartProvider>
          <MeshBackground />
          <div className="grain-overlay" aria-hidden="true" />
          <div className="relative z-10">
            {children}
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
