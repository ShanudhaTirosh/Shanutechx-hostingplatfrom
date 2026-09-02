import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { siteMetadata } from '@/lib/metadata';

export const metadata: Metadata = {
  ...siteMetadata,
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

const jsonLdSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SHANUTECHX Cloud Platform',
  operatingSystem: 'Linux, Docker',
  applicationCategory: 'BusinessApplication',
  offers: {
    '@type': 'Offer',
    price: '0.00',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'SHANUTECHX Cloud',
    url: 'https://shanutechx.com',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body className="bg-[#070814] text-white antialiased selection:bg-purple-500 selection:text-white">
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
