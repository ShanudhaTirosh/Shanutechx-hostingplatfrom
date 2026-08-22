'use client';

import { useEffect } from 'react';
import { Card, Button } from '@/components/ui';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-20">
      <Card className="max-w-md text-center p-10">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-text-muted text-sm mb-6">
          An unexpected error occurred loading this page. Try again, or go back to your dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <a href="/dashboard">
            <Button variant="ghost">Back to dashboard</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
