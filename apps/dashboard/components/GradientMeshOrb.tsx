'use client';

import { useId } from 'react';

interface GradientMeshOrbProps {
  size?: number | string;
  glowColor?: string;
  className?: string;
}

export default function GradientMeshOrb({
  size = 480,
  glowColor = 'rgba(124,58,237,0.45)',
  className = '',
}: GradientMeshOrbProps) {
  const warpId = useId().replace(/:/g, '') + '_stxMeshWarp';
  const meshAId = useId().replace(/:/g, '') + '_stxMeshA';
  const meshBId = useId().replace(/:/g, '') + '_stxMeshB';
  const meshCId = useId().replace(/:/g, '') + '_stxMeshC';

  const palette = {
    a: '#7c3aed',
    b: '#2dd4bf',
    c: '#38bdf8',
    glow: glowColor,
  };

  return (
    <div
      aria-hidden="true"
      className={`relative select-none pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        maxWidth: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      {/* Ambient glow behind the orb */}
      <div
        style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: '50%',
          background: palette.glow,
          filter: 'blur(60px)',
          animation: 'stxOrbBreathe 9s ease-in-out infinite',
        }}
      />

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 480 480"
        style={{
          position: 'relative',
          filter: 'blur(4px) saturate(1.15)',
          animation: 'stxOrbSpin 40s linear infinite',
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

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes stxOrbBreathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes stxOrbSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      ` }} />
    </div>
  );
}
