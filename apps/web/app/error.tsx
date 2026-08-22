'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this is where an error-tracking call (Sentry, etc.)
    // would go — logged client-side since this boundary only catches
    // rendering errors that happen in the browser.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-10 max-w-md text-center">
        <div className="inline-block h-12 w-12 rounded-2xl bg-brand-gradient mb-6" />
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-text-muted text-sm mb-8">
          An unexpected error occurred loading this page. Try again, or head back home.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-brand-gradient px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-xl glass px-6 py-2.5 text-sm font-medium text-text-primary hover:bg-white/[0.06] transition-colors"
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
