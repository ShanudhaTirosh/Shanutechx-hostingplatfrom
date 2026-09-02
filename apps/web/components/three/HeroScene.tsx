'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshDistortMaterial, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface BlobProps {
  position: [number, number, number];
  scale: number;
  color: string;
  speed: number;
  distort: number;
}

function Blob({ position, scale, color, speed, distort }: BlobProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const initial = useMemo(() => position, [position]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.x = t * 0.08 * speed;
    meshRef.current.rotation.y = t * 0.12 * speed;
    meshRef.current.position.y = initial[1] + Math.sin(t * 0.4 * speed) * 0.25;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 6]} />
      <MeshDistortMaterial
        color={color}
        distort={distort}
        speed={1.4}
        roughness={0.15}
        metalness={0.2}
        transparent
        opacity={0.55}
        transmission={0.4}
      />
    </mesh>
  );
}

function ParallaxRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  useFrame((state) => {
    if (!group.current) return;
    const targetX = (state.pointer.x * viewport.width) / 40;
    const targetY = (state.pointer.y * viewport.height) / 40;
    group.current.rotation.y += (targetX - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-targetY - group.current.rotation.x) * 0.04;
  });

  return <group ref={group}>{children}</group>;
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 3, 4]} intensity={1.2} color="#a855f7" />
      <directionalLight position={[-3, -2, -4]} intensity={0.8} color="#22d3ee" />

      <ParallaxRig>
        <Blob position={[-1.6, 0.6, 0]} scale={1.7} color="#7C3AED" speed={0.9} distort={0.35} />
        <Blob position={[1.8, -0.4, -1.5]} scale={1.3} color="#0EA5E9" speed={1.2} distort={0.42} />
        <Blob position={[0.3, 1.3, -2.5]} scale={0.9} color="#D946EF" speed={0.7} distort={0.3} />
      </ParallaxRig>

      <Environment preset="city" />
    </Canvas>
  );
}
