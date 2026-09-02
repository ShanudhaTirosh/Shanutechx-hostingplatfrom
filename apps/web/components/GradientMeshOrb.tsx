'use client';

import React from 'react';

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
  glowColor = 'rgba(124,58,237,0.45)',
  opacity = 1,
}: GradientMeshOrbProps) {
  const palette = {
    a: '#7c3aed', // Violet
    b: '#2dd4bf', // Teal
    c: '#38bdf8', // Sky Blue
    glow: glowColor,
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{
        position: 'relative',
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        maxWidth: '100%',
        aspectRatio: '1 / 1',
        opacity,
      }}
    >
      {/* Ambient glow behind the orb */}
      <div
        className="animate-stx-orb-breathe"
        style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: '50%',
          background: palette.glow,
          filter: 'blur(65px)',
        }}
      />

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 480 480"
        className="animate-stx-orb-spin"
        style={{
          position: 'relative',
          filter: 'blur(6px) saturate(1.25)',
        }}
      >
        <defs>
          <filter id="stxMeshWarp" x="-20%" y="-20%" width="140%" height="140%">
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

          <radialGradient id="stxMeshA" r="60%">
            <animate attributeName="cx" values="35%;55%;30%;35%" dur="18s" repeatCount="indefinite" />
            <animate attributeName="cy" values="30%;45%;55%;30%" dur="22s" repeatCount="indefinite" />
            <stop offset="0%" stopColor={palette.a} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.a} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="stxMeshB" r="55%">
            <animate attributeName="cx" values="70%;50%;75%;70%" dur="20s" repeatCount="indefinite" />
            <animate attributeName="cy" values="65%;40%;70%;65%" dur="16s" repeatCount="indefinite" />
            <stop offset="0%" stopColor={palette.b} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.b} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="stxMeshC" r="50%">
            <animate attributeName="cx" values="50%;30%;60%;50%" dur="26s" repeatCount="indefinite" />
            <animate attributeName="cy" values="80%;55%;35%;80%" dur="19s" repeatCount="indefinite" />
            <stop offset="0%" stopColor={palette.c} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.c} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g filter="url(#stxMeshWarp)">
          <circle cx="240" cy="240" r="190" fill="url(#stxMeshA)" />
          <circle cx="240" cy="240" r="190" fill="url(#stxMeshB)" />
          <circle cx="240" cy="240" r="190" fill="url(#stxMeshC)" />
        </g>
      </svg>
    </div>
  );
}
