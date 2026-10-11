import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer Reviews & Verified Platform Ratings',
  description:
    'Read verified reviews and ratings from developers, startups, and enterprises hosting VPS, Discord bots, and production web services on ShanuTechX.',
  openGraph: {
    title: 'Customer Reviews & Verified Ratings | STX HOSTING',
    description:
      'Explore authentic feedback, performance benchmarks, and reviews from real customers using ShanuTechX cloud hosting.',
  },
  alternates: {
    canonical: '/reviews',
  },
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
