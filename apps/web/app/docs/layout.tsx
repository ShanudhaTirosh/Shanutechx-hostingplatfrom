import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Documentation & Developer REST API',
  description:
    'Comprehensive documentation for ShanuTechX cloud platform. Learn how to deploy Docker containers, configure domains, use the REST API, and automate deployments.',
  openGraph: {
    title: 'Platform Documentation & Developer REST API | STX HOSTING',
    description:
      'Developer guides, REST API specifications, deployment automation tutorials, and architecture overviews.',
  },
  alternates: {
    canonical: '/docs',
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
