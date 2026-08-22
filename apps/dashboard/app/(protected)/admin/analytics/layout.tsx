import RequireFullAdmin from '@/components/RequireFullAdmin';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <RequireFullAdmin>{children}</RequireFullAdmin>;
}
