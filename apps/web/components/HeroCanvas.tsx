'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import GradientMeshOrb from './GradientMeshOrb';

const HeroScene = dynamic(() => import('./three/HeroScene'), { ssr: false });

/**
 * Backdrop for the hero. Mounts the real WebGL scene on the client only
 * (three/@react-three/fiber must never run during SSR/build). Skips the
 * 3D canvas entirely under prefers-reduced-motion and falls back to the
 * original static GradientMeshOrb.
 */
export default function HeroCanvas() {
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', listener);

    // Mount just after first paint so the WebGL canvas never blocks LCP.
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      mq.removeEventListener('change', listener);
      cancelAnimationFrame(id);
    };
  }, []);

  if (reducedMotion || !ready) {
    return (
      <div className="absolute top-8 left-1/2 -translate-x-1/2 scale-125 sm:scale-150 md:scale-175 opacity-90 sm:opacity-95">
        <GradientMeshOrb size={700} glowColor="rgba(139,92,246,0.75)" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 scale-125 sm:scale-110 flex items-center justify-center">
      <div className="absolute top-8 left-1/2 -translate-x-1/2 scale-125 sm:scale-150 opacity-80 pointer-events-none z-0">
        <GradientMeshOrb size={700} glowColor="rgba(139,92,246,0.75)" />
      </div>
      <div className="absolute inset-0 z-10">
        <HeroScene />
      </div>
    </div>
  );
}
