'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface BorderBeamProps {
  /** Size/length of the beam in pixels */
  size?: number;
  /** Duration of a full cycle in seconds */
  duration?: number;
  /** Delay before animation starts in seconds */
  delay?: number;
  /** Starting gradient color */
  colorFrom?: string;
  /** Ending gradient color */
  colorTo?: string;
  /** Custom class name */
  className?: string;
  /** Border radius in pixels */
  borderRadius?: number;
}

/**
 * High-performance, cross-browser animated border beam.
 * Uses an SVG path stroke with animated dashoffset so it never artifacts
 * or creates clipping squares on Chromium or Firefox.
 */
export default function BorderBeam({
  size = 180,
  duration = 8,
  delay = 0,
  colorFrom = '#a855f7',
  colorTo = '#38bdf8',
  className = '',
  borderRadius = 24,
}: BorderBeamProps) {
  const id = React.useId();

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] z-0 ${className}`}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <defs>
          <linearGradient id={`beam-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} stopOpacity="1" />
            <stop offset="60%" stopColor={colorTo} stopOpacity="1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx={borderRadius}
          ry={borderRadius}
          stroke={`url(#beam-grad-${id})`}
          strokeWidth="1.5"
          strokeDasharray={`${size} 600`}
          animate={{
            strokeDashoffset: [0, -1200],
          }}
          transition={{
            repeat: Infinity,
            duration,
            delay,
            ease: 'linear',
          }}
        />
      </svg>
    </div>
  );
}
