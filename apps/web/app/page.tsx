import Navbar from '@/components/Navbar';
import OrbitHero from '@/components/OrbitHero';
import MarqueeStrips from '@/components/MarqueeStrips';
import BentoGrid from '@/components/BentoGrid';
import FeaturesGrid from '@/components/FeaturesGrid';
import Pricing from '@/components/Pricing';
import StxFooter from '@/components/StxFooter';

export default async function HomePage() {
  return (
    <main className="bg-transparent text-white font-sans overflow-x-hidden">
      <Navbar />
      <OrbitHero />
      <MarqueeStrips />
      <BentoGrid />
      <FeaturesGrid />
      <Pricing />
      <StxFooter />
    </main>
  );
}
