import type { Metadata } from 'next';
import './webmail.css';

export const metadata: Metadata = {
  title: 'STX Mail — Enterprise Autonomous Webmail',
  description: 'Enterprise Webmail Portal for ShanuTechX Business Email & Cloud Hosting',
};

export default function WebmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="webmail-root h-screen w-screen overflow-hidden">
      {children}
    </div>
  );
}
