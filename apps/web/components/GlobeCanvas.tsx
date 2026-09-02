'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('GlobeScene failed to load dynamic chunk:', err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const GlobeScene = dynamic(() => import('./three/GlobeScene'), {
  ssr: false,
  loading: () => null,
});

/**
 * Mounts the real WebGL globe only once this section nears the viewport,
 * so it never blocks the initial page load. Shows a low-cost gradient
 * placeholder in the meantime, and under prefers-reduced-motion never
 * mounts the canvas at all (the globe's own auto-rotation is motion).
 */
export default function GlobeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);

    if (mq.matches) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Static placeholder — always rendered underneath so there is
          never a blank gap while the canvas mounts or on reduced motion. */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-violet/25 via-indigo-600/15 to-accent-teal/15 blur-2xl" />

      {shouldMount && !reducedMotion && (
        <div className="absolute inset-0">
          <ErrorBoundary fallback={null}>
            <GlobeScene />
          </ErrorBoundary>
        </div>
      )}

      {reducedMotion && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3/4 aspect-square rounded-full border border-white/15 bg-[#0b0c1b]/80 backdrop-blur-xl" />
        </div>
      )}
    </div>
  );
}
