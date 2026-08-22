import RequireFullAdmin from '@/components/RequireFullAdmin';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <RequireFullAdmin>{children}</RequireFullAdmin>;
}
