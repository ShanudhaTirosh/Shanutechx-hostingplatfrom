import RequireFullAdmin from '@/components/RequireFullAdmin';

export default function AuditLogLayout({ children }: { children: React.ReactNode }) {
  return <RequireFullAdmin>{children}</RequireFullAdmin>;
}
