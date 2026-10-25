'use client';

import { useEffect, useRef } from 'react';

export default function MeshBackground() {
  const bgRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });

    const animate = () => {
      const lerp = 0.03;
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * lerp;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * lerp;

      if (bgRef.current) {
        const mx = (currentRef.current.x - 0.5) * 30;
        const my = (currentRef.current.y - 0.5) * 30;
        bgRef.current.style.setProperty('--mx', `${mx}px`);
        bgRef.current.style.setProperty('--my', `${my}px`);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouse);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="mesh-bg" ref={bgRef} aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="noise-overlay" />
      <div className="dot-grid" />
      <style dangerouslySetInnerHTML={{ __html: `
        .mesh-bg {
          --mx: 0px;
          --my: 0px;
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.18;
          animation: orbDrift 20s ease-in-out infinite alternate;
          will-change: transform;
          transform: translate(var(--mx), var(--my));
        }
        .orb-1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.025), transparent 70%);
          top: -200px; left: -150px;
          animation-duration: 22s;
        }
        .orb-2 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.015), transparent 70%);
          top: 30%; right: -150px;
          animation-duration: 18s;
          animation-delay: -8s;
        }
        .orb-3 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.02), transparent 70%);
          bottom: -150px; left: 30%;
          animation-duration: 25s;
          animation-delay: -14s;
        }
        .orb-4 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.01), transparent 70%);
          top: 60%; left: -80px;
          opacity: 0.1;
          animation-duration: 28s;
          animation-delay: -5s;
        }
        @keyframes orbDrift {
          0%   { transform: translate(var(--mx), var(--my)) scale(1); }
          33%  { transform: translate(calc(60px + var(--mx)), calc(-40px + var(--my))) scale(1.08); }
          66%  { transform: translate(calc(-30px + var(--mx)), calc(60px + var(--my))) scale(0.95); }
          100% { transform: translate(calc(40px + var(--mx)), calc(20px + var(--my))) scale(1.05); }
        }
        .noise-overlay {
          position: absolute;
          inset: 0;
          opacity: 0.015;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 128px 128px;
          mix-blend-mode: overlay;
        }
        .dot-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 28px 28px;
        }
      ` }} />
    </div>
  );
}
