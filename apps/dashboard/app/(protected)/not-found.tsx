import Link from 'next/link';
import { Card } from '@/components/ui';

export default function ProtectedNotFound() {
  return (
    <div className="flex items-center justify-center py-20">
      <Card className="max-w-md text-center p-10">
        <p className="text-5xl font-bold bg-brand-gradient bg-clip-text text-transparent mb-2">404</p>
        <h1 className="text-xl font-semibold mb-2">Page not found</h1>
        <p className="text-text-muted text-sm mb-6">
          This page doesn't exist, or you don't have access to it from here.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-xl bg-brand-gradient px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}
