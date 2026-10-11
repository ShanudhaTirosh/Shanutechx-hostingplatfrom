import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions & Knowledge Base',
  description:
    'Find answers to common questions about Cloud VPS provisioning, Node.js and Python container deployments, Discord bot hosting, payments, and SLA.',
  openGraph: {
    title: 'Frequently Asked Questions | STX HOSTING',
    description:
      'Answers to common questions about Cloud VPS, app deployments, Discord bots, LKR payments, and autonomous cloud infrastructure.',
  },
  alternates: {
    canonical: '/faqs',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How fast are Cloud VPS instances provisioned after payment approval?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cloud VPS compute instances are provisioned automatically within 15 seconds after payment approval. Your dedicated IPv4, SSH port, and root credentials appear immediately in your Control Panel dashboard.',
      },
    },
    {
      '@type': 'Question',
      name: 'What operating systems are supported on Cloud VPS?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We support Ubuntu 24.04 LTS, Ubuntu 22.04 LTS, Debian 12, AlmaLinux 9, Rocky Linux 9, Alpine Linux, and custom ISO uploads.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I get full root access and dedicated IPv4 address?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Every Cloud VPS allocation includes full root access via SSH, dedicated IPv4 address, customizable rDNS, and raw kernel access.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does code deployment from GitHub or ZIP archives work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Connect your GitHub repository or upload a compressed .zip archive. Our edge build engine automatically compiles your code, detects package dependencies, provisions Docker containers, and attaches custom Let's Encrypt SSL certificates.",
      },
    },
  ],
};

export default function FaqsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  );
}
