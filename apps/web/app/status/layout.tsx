import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Real-Time System Status & Infrastructure Telemetry',
  description:
    'Live status metrics for ShanuTechX compute nodes, edge routing proxies, database clusters, deployment pipelines, and network uplinks.',
  openGraph: {
    title: 'Real-Time System Status & Telemetry | STX HOSTING',
    description:
      'Current uptime, incident reports, and real-time operational status for ShanuTechX cloud infrastructure.',
  },
  alternates: {
    canonical: '/status',
  },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
