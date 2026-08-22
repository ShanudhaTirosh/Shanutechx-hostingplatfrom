import RequireAdminOrDev from '@/components/RequireAdminOrDev';

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdminOrDev>{children}</RequireAdminOrDev>;
}
