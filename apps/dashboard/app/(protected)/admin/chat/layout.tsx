import RequireStaffOnly from '@/components/RequireStaffOnly';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <RequireStaffOnly>{children}</RequireStaffOnly>;
}
