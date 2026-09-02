'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion, animate } from 'framer-motion';

interface CountUpProps {
  /** the target value as displayed, e.g. "99.99%", "<30s", "15+" */
  value: string;
  className?: string;
  duration?: number;
}

/**
 * Parses the leading numeric portion of `value` and animates it counting
 * up from 0 when it scrolls into view, preserving any prefix/suffix
 * characters (%, +, <, s, ms, etc) exactly as authored.
 */
export default function CountUp({ value, className, duration = 1.4 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);

  const match = value.match(/(-?\d+(?:\.\d+)?)/);
  const numeric = match ? parseFloat(match[1]) : null;
  const prefix = match ? value.slice(0, match.index) : '';
  const suffix = match ? value.slice((match.index ?? 0) + match[1].length) : '';
  const decimals = match && match[1].includes('.') ? match[1].split('.')[1].length : 0;

  useEffect(() => {
    if (numeric === null || reduceMotion) return;
    if (!inView) {
      setDisplay(`${prefix}${(0).toFixed(decimals)}${suffix}`);
      return;
    }
    const controls = animate(0, numeric, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(`${prefix}${v.toFixed(decimals)}${suffix}`),
    });
    return () => controls.stop();
  }, [inView, reduceMotion, numeric, value, prefix, suffix, decimals, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
