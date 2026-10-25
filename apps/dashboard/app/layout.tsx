import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeScript } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'),
  title: 'STX HOSTING Control Panel',
  description: 'Manage your VPS hosting, cloud deployments, databases, bots, and invoices.',
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

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash theme script: must be first in <head> */}
        <ThemeScript />
        <link rel="preconnect" href="https://api.shanutechx.com" />
        <link rel="dns-prefetch" href="https://api.shanutechx.com" />
      </head>
      <body suppressHydrationWarning className="relative min-h-screen">
        <div className="relative z-10">
          {children}
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                var msg = e && e.message ? e.message : '';
                if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('MIME type') !== -1) {
                  if (!window.sessionStorage.getItem('chunk_reload')) {
                    window.sessionStorage.setItem('chunk_reload', '1');
                    window.location.reload();
                  }
                }
              });
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
