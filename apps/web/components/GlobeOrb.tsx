'use client';

import React, { useEffect, useRef, useState } from 'react';
import { geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const SERVER_NODES = [
  { id: 'usw', lat: 34.05, lng: -118.24, name: 'US West', city: 'Los Angeles' },
  { id: 'use', lat: 40.71, lng: -74.01, name: 'US East', city: 'New York' },
  { id: 'uk',  lat: 51.51, lng: -0.13,  name: 'UK', city: 'London' },
  { id: 'de',  lat: 50.11, lng: 8.68,   name: 'Germany', city: 'Frankfurt' },
  { id: 'fr',  lat: 48.86, lng: 2.35,   name: 'France', city: 'Paris' },
  { id: 'nl',  lat: 52.37, lng: 4.90,   name: 'Netherlands', city: 'Amsterdam' },
  { id: 'in',  lat: 19.08, lng: 72.88,  name: 'India', city: 'Mumbai' },
  { id: 'sg',  lat: 1.35,  lng: 103.82, name: 'Singapore', city: 'Singapore' },
  { id: 'jp',  lat: 35.69, lng: 139.69, name: 'Japan', city: 'Tokyo' },
  { id: 'lk',  lat: 6.92,  lng: 79.86,  name: 'Sri Lanka', city: 'Colombo' },
  { id: 'au',  lat: -33.87, lng: 151.21, name: 'Australia', city: 'Sydney' },
  { id: 'br',  lat: -23.55, lng: -46.63, name: 'Brazil', city: 'São Paulo' },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [3, 5],
  [3, 6], [6, 9], [6, 7], [7, 8], [7, 10], [1, 11]
];

interface GlobeOrbProps {
  size?: number;
}

export default function GlobeOrb({ size = 480 }: GlobeOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [worldGeo, setWorldGeo] = useState<any>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef<number>(0);

  useEffect(() => {
    fetch(GEO_URL)
      .then((res) => res.json())
      .then((topo) => {
        const geoData = feature(topo, topo.objects.countries as any);
        setWorldGeo(geoData);
      })
      .catch((err) => console.error('Failed to load world atlas for 3D globe:', err));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotationLambda = 0;
    let packetTimer = 0;

    const width = size;
    const height = size;
    const dpr = Math.min(window.devicePixelRatio || 2, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const radius = size * 0.41;
    const cx = width / 2;
    const cy = height / 2;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (!pointerInteracting.current) {
        rotationLambda += 0.4;
      }
      packetTimer = (packetTimer + 0.006) % 1;

      const projection = geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationLambda + pointerInteractionMovement.current, -18, 0])
        .clipAngle(90);

      const pathGenerator = geoPath().projection(projection).context(ctx);

      // 1. Draw 3D Globe Dark Sphere & Gradient Depth Fill
      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.3, radius * 0.1,
        cx, cy, radius
      );
      sphereGrad.addColorStop(0, '#1c1f36');
      sphereGrad.addColorStop(0.6, '#0d1121');
      sphereGrad.addColorStop(1, '#060812');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Outer Sphere Border Rim
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 2. Draw Real 3D Vector Countries & Country Borders
      if (worldGeo) {
        ctx.save();
        ctx.beginPath();
        pathGenerator(worldGeo);
        ctx.fillStyle = '#141d33';
        ctx.fill();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 0.75;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Draw Animated 3D Cyber Data Arcs & Light Streams
      EDGES.forEach(([i, j]) => {
        const n1 = SERVER_NODES[i];
        const n2 = SERVER_NODES[j];
        const arcGeo: any = {
          type: 'LineString',
          coordinates: [[n1.lng, n1.lat], [n2.lng, n2.lat]]
        };

        const p1 = projection([n1.lng, n1.lat]);
        const p2 = projection([n2.lng, n2.lat]);

        const d1 = p1 ? Math.hypot(p1[0] - cx, p1[1] - cy) : 999;
        const d2 = p2 ? Math.hypot(p2[0] - cx, p2[1] - cy) : 999;

        if (d1 < radius || d2 < radius) {
          ctx.save();
          ctx.beginPath();
          pathGenerator(arcGeo);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();

          if (p1 && p2 && d1 < radius && d2 < radius) {
            const px = p1[0] + (p2[0] - p1[0]) * packetTimer;
            const py = p1[1] + (p2[1] - p1[1]) * packetTimer;
            ctx.save();
            ctx.fillStyle = '#34d399';
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(px, py, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      });

      // 4. Draw VPN Server Beacon Nodes
      SERVER_NODES.forEach((node) => {
        const p = projection([node.lng, node.lat]);
        if (p) {
          const dist = Math.hypot(p[0] - cx, p[1] - cy);
          if (dist < radius - 1) {
            const alpha = 1 - (dist / radius) * 0.6;

            const pulseR1 = 4.5 + (Date.now() % 1600) / 160;
            const pulseR2 = 8.5 + (Date.now() % 2400) / 200;

            ctx.save();
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.8})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(p[0], p[1], pulseR1, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = `rgba(52, 211, 153, ${alpha * 0.5})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(p[0], p[1], pulseR2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(p[0], p[1], 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size, worldGeo]);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outer ambient cyan/purple atmospheric glow halo */}
      <div
        style={{
          position: 'absolute',
          inset: '3%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(124, 58, 237, 0.25) 55%, transparent 72%)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
        }}
      />

      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.4;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.4;
          }
        }}
        style={{
          width: size,
          height: size,
          display: 'block',
          cursor: 'grab',
          zIndex: 2,
        }}
      />
    </div>
  );
}
