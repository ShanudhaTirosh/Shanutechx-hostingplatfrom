import RequireStaffOnly from '@/components/RequireStaffOnly';

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <RequireStaffOnly>{children}</RequireStaffOnly>;
}
