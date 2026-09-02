'use client';

import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** stagger index — each increment adds ~70ms of delay */
  index?: number;
  /** extra delay in seconds on top of the index-based stagger */
  delay?: number;
  /** distance the content rises from, in px */
  y?: number;
  once?: boolean;
  as?: 'div' | 'span';
}

/**
 * Fade + rise reveal, triggered once the element scrolls into view.
 * Replaces one-shot CSS animate-fade-in / animate-slide-up so grids
 * and lists stagger in per-item instead of appearing all at once.
 * Respects prefers-reduced-motion by falling back to a plain fade.
 */
export default function Reveal({
  children,
  className,
  index = 0,
  delay = 0,
  y = 20,
  once = true,
  as = 'div',
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  const variants: Variants = reduceMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3 } } }
    : {
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.55,
            delay: delay + index * 0.07,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      };

  const MotionTag = as === 'span' ? motion.span : motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-80px' }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}
