import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShanuTechX Enterprise Webmail',
  description: 'Autonomous Business Email Client & Mailbox Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
