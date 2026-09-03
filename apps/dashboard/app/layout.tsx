import type { Metadata, Viewport } from 'next';
import './globals.css';
import MeshBackground from '@/components/MeshBackground';

export const metadata: Metadata = {
  title: 'STX HOSTING Control Panel',
  description: 'Manage your VPS hosting, cloud deployments, V2Ray proxies, and invoices.',
  icons: {
    icon: '/STX.png',
    shortcut: '/STX.png',
    apple: '/STX.png',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.shanutechx.com" />
        <link rel="dns-prefetch" href="https://api.shanutechx.com" />
      </head>
      <body suppressHydrationWarning className="relative min-h-screen">
        <MeshBackground />
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
