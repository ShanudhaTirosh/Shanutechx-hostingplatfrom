import RequireFullAdmin from '@/components/RequireFullAdmin';

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <RequireFullAdmin>{children}</RequireFullAdmin>;
}
