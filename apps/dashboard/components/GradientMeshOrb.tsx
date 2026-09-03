'use client';

import React from 'react';

interface GradientMeshOrbProps {
  size?: number | string;
  glowColor?: string;
  className?: string;
  opacity?: number;
}

export default function GradientMeshOrb({
  size = 480,
  glowColor = 'rgba(124,58,237,0.45)',
  className = '',
  opacity = 0.8,
}: GradientMeshOrbProps) {
  const sizePx = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`relative pointer-events-none select-none ${className}`}
      style={{ width: sizePx, height: sizePx, opacity }}
    >
      <div
        className="absolute inset-0 rounded-full blur-3xl animate-pulse"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(99,102,241,0.2) 50%, transparent 75%)`,
          animationDuration: '6s',
        }}
      />
    </div>
  );
}
