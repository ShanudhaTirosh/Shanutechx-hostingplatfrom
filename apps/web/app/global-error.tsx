'use client';

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="glass rounded-3xl p-10 max-w-md text-center">
            <div className="inline-block h-12 w-12 rounded-2xl bg-brand-gradient mb-6" />
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-text-muted text-sm mb-8">
              A critical error occurred. Please try again.
            </p>
            <button
              onClick={() => reset()}
              className="rounded-xl bg-brand-gradient px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
