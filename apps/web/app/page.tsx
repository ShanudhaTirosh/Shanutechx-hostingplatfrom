import Navbar from '@/components/Navbar';
import OrbitHero from '@/components/OrbitHero';
import MarqueeStrips from '@/components/MarqueeStrips';
import TelemetryArchitectureFlow from '@/components/motion/TelemetryArchitectureFlow';
import BentoGrid from '@/components/BentoGrid';
import FeaturesGrid from '@/components/FeaturesGrid';
import Pricing from '@/components/Pricing';
import ReviewCarousel from '@/components/ReviewCarousel';
import CtaBanner from '@/components/CtaBanner';
import StxFooter from '@/components/StxFooter';

export default async function HomePage() {
  return (
    <main className="bg-transparent text-white font-sans overflow-x-hidden">
      <Navbar />
      <OrbitHero />
      <MarqueeStrips />
      <TelemetryArchitectureFlow />
      <BentoGrid />
      <FeaturesGrid />
      <Pricing />
      <CtaBanner />
      <ReviewCarousel />
      <StxFooter />
    </main>
  );
}

