import RequireFullAdmin from '@/components/RequireFullAdmin';

export default function ReviewQueueLayout({ children }: { children: React.ReactNode }) {
  return <RequireFullAdmin>{children}</RequireFullAdmin>;
}
