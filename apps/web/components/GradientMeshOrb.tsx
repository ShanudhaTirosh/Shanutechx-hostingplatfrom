'use client';

import React, { useEffect, useId, useState } from 'react';

interface GradientMeshOrbProps {
  size?: number | string;
  className?: string;
  glowColor?: string;
  opacity?: number;
}

/**
 * GradientMeshOrb — a soft, continuously-morphing gradient blob.
 * Pure SVG + CSS (SMIL animations on gradients & turbulence filter),
 * GPU accelerated with zero JavaScript per-frame animation overhead.
 */
export default function GradientMeshOrb({
  size = 480,
  className = '',
  glowColor = 'rgba(124,58,237,0.65)',
  opacity = 1,
}: GradientMeshOrbProps) {
  const rawId = useId();

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
    maxWidth: '100%',
    aspectRatio: '1 / 1',
    opacity,
  };

  const safeId = rawId.replace(/:/g, '_');
  const warpId = `stxWarp_${safeId}`;
  const meshAId = `stxMeshA_${safeId}`;
  const meshBId = `stxMeshB_${safeId}`;
  const meshCId = `stxMeshC_${safeId}`;

  const palette = {
    a: '#8b5cf6', // Bright Violet
    b: '#14b8a6', // Bright Teal
    c: '#06b6d4', // Sky Cyan
    glow: glowColor,
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={containerStyle}
    >
      {/* Ambient glow behind the orb */}
      <div
        className="animate-stx-orb-breathe"
        style={{
          position: 'absolute',
          inset: '5%',
          borderRadius: '50%',
          background: palette.glow,
          filter: 'blur(70px)',
        }}
      />

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 480 480"
        className="animate-stx-orb-spin"
        style={{
          position: 'relative',
          filter: 'blur(2px) saturate(1.35)',
        }}
      >
        <defs>
          <filter id={warpId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.012"
              numOctaves="2"
              seed="7"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="24s"
                values="0.008 0.012;0.015 0.006;0.008 0.012"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="70"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <radialGradient id={meshAId} r="60%">
            <animate attributeName="cx" values="35%;55%;30%;35%" dur="18s" repeatCount="indefinite" />
            <animate attributeName="cy" values="30%;45%;55%;30%" dur="22s" repeatCount="indefinite" />
            <stop offset="0%" stopColor={palette.a} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.a} stopOpacity="0" />
          </radialGradient>

          <radialGradient id={meshBId} r="55%">
            <animate attributeName="cx" values="70%;50%;75%;70%" dur="20s" repeatCount="indefinite" />
            <animate attributeName="cy" values="65%;40%;70%;65%" dur="16s" repeatCount="indefinite" />
            <stop offset="0%" stopColor={palette.b} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.b} stopOpacity="0" />
          </radialGradient>

          <radialGradient id={meshCId} r="50%">
            <animate attributeName="cx" values="50%;30%;60%;50%" dur="26s" repeatCount="indefinite" />
            <animate attributeName="cy" values="80%;55%;35%;80%" dur="19s" repeatCount="indefinite" />
            <stop offset="0%" stopColor={palette.c} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.c} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g filter={`url(#${warpId})`}>
          <circle cx="240" cy="240" r="190" fill={`url(#${meshAId})`} />
          <circle cx="240" cy="240" r="190" fill={`url(#${meshBId})`} />
          <circle cx="240" cy="240" r="190" fill={`url(#${meshCId})`} />
        </g>
      </svg>
    </div>
  );
}

