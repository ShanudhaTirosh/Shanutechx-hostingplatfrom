import Navbar from '@/components/Navbar';
import OrbitHero from '@/components/OrbitHero';
import MarqueeStrips from '@/components/MarqueeStrips';
import BentoGrid from '@/components/BentoGrid';
import FeaturesGrid from '@/components/FeaturesGrid';
import Pricing from '@/components/Pricing';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import StxFooter from '@/components/StxFooter';

interface CmsContent {
  heroTitle?: string;
  heroSubtitle?: string;
  faqItems?: Array<{ q: string; a: string }>;
}

async function getCmsContent(): Promise<CmsContent> {
  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) return {};

  try {
    const res = await fetch(`${apiBase}/api/cms/home`, { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return data.content ?? {};
  } catch {
    return {};
  }
}

export default async function HomePage() {
  const content = await getCmsContent();

  return (
    <main className="bg-transparent text-white font-sans overflow-x-hidden">
      <Navbar />
      <OrbitHero />
      <MarqueeStrips />
      <BentoGrid />
      <FeaturesGrid />
      <Pricing />
      <div id="faq">
        <FAQ items={content.faqItems} />
      </div>
      <Contact />
      <StxFooter />
    </main>
  );
}
