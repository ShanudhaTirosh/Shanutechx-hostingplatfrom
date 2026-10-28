import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'STX Webmail',
  description: 'STX Webmail - Autonomous Business Email Client & Mailbox Studio',
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
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
