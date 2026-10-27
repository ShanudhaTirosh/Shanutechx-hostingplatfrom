'use client';

import RequireDev from '@/components/RequireDev';

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <RequireDev>{children}</RequireDev>;
}
