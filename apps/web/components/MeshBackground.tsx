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
          background: radial-gradient(circle at 35% 25%, #180b38 0%, #08031a 55%, #030014 100%);
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(130px);
          opacity: 0.25;
          animation: orbDrift 20s ease-in-out infinite alternate;
          will-change: transform;
          transform: translate(var(--mx), var(--my));
        }
        .orb-1 {
          width: 750px; height: 750px;
          background: radial-gradient(circle, #7c3aed, transparent 70%);
          top: -180px; left: -120px;
          animation-duration: 22s;
        }
        .orb-2 {
          width: 650px; height: 650px;
          background: radial-gradient(circle, #38bdf8, transparent 70%);
          top: 25%; right: -150px;
          animation-duration: 18s;
          animation-delay: -8s;
        }
        .orb-3 {
          width: 550px; height: 550px;
          background: radial-gradient(circle, #c084fc, transparent 70%);
          bottom: -100px; left: 25%;
          animation-duration: 25s;
          animation-delay: -14s;
        }
        .orb-4 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #818cf8, transparent 70%);
          top: 65%; left: -100px;
          opacity: 0.18;
          animation-duration: 28s;
          animation-delay: -5s;
        }
        @keyframes orbDrift {
          0%   { transform: translate(var(--mx), var(--my)) scale(1); }
          33%  { transform: translate(calc(60px + var(--mx)), calc(-40px + var(--my))) scale(1.08); }
          66%  { transform: translate(calc(-30px + var(--mx)), calc(60px + var(--my))) scale(0.95); }
          100% { transform: translate(calc(40px + var(--mx)), calc(20px + var(--my))) scale(1.05); }
        }
        .dot-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(167, 139, 250, 0.2) 1.1px, transparent 1.1px);
          background-size: 24px 24px;
        }
      ` }} />
    </div>
  );
}
