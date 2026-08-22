import RequireAdminOrDev from '@/components/RequireAdminOrDev';

export default function InfraLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdminOrDev>{children}</RequireAdminOrDev>;
}
