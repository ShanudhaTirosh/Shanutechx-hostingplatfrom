'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DevSupabaseStudioPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dev/projects');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-muted">Redirecting to Unified Projects & Databases Hub...</p>
      </div>
    </div>
  );
}
