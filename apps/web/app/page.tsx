import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import AdvancedFeatures from '@/components/AdvancedFeatures';
import PlatformShowcase from '@/components/PlatformShowcase';
import GlobeVisual from '@/components/GlobeVisual';
import V2RaySection from '@/components/V2RaySection';
import Features from '@/components/Features';
import About from '@/components/About';
import Testimonials from '@/components/Testimonials';
import Pricing from '@/components/Pricing';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

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
    <main className="bg-[#070814] text-white font-sans overflow-x-hidden">
      <Navbar />
      <Hero title={content.heroTitle} subtitle={content.heroSubtitle} />
      <AdvancedFeatures />
      <PlatformShowcase />
      <GlobeVisual />
      <V2RaySection />
      <div id="features">
        <Features />
      </div>
      <About />
      <Testimonials />
      <Pricing />
      <div id="faq">
        <FAQ items={content.faqItems} />
      </div>
      <Contact />
      <Footer />
    </main>
  );
}
