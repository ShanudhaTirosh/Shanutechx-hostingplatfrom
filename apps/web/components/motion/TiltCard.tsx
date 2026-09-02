'use client';

import React, { useRef, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** max rotation in degrees */
  strength?: number;
  spotlight?: boolean;
  style?: React.CSSProperties;
}

/**
 * Wraps a card with a small perspective tilt that follows the pointer,
 * plus an optional cursor-follow spotlight glow (see .spotlight-card
 * in globals.css). Used for glass-card grids across the site (Features,
 * Pricing, AdvancedFeatures, etc). No-ops under prefers-reduced-motion.
 */
export default function TiltCard({
  children,
  className = '',
  strength = 6,
  spotlight = true,
  style,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || reduceMotion) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      const rotateY = (px - 0.5) * strength * 2;
      const rotateX = (0.5 - py) * strength * 2;

      el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    },
    [strength, reduceMotion]
  );

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`tilt-card ${spotlight ? 'spotlight-card' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
