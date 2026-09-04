import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Webmail | ShanuTechX Cloud Mail',
  description: 'Enterprise Webmail Portal for ShanuTechX Business Email Hosting',
};

export default function WebmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {children}
    </div>
  );
}
