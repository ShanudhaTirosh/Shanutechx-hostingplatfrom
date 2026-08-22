import RequireFullAdmin from '@/components/RequireFullAdmin';

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return <RequireFullAdmin>{children}</RequireFullAdmin>;
}
