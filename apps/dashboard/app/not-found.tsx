import Link from 'next/link';

export const metadata = {
  title: '404 — Page not found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-10 max-w-md text-center">
        <div className="inline-block h-12 w-12 rounded-2xl bg-brand-gradient mb-6" />
        <p className="text-6xl font-bold bg-brand-gradient bg-clip-text text-transparent mb-2">404</p>
        <h1 className="text-xl font-semibold mb-2">Page not found</h1>
        <p className="text-text-muted text-sm mb-8">
          This page doesn't exist, or the link might be out of date.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-xl bg-brand-gradient px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
