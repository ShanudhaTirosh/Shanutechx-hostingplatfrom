'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Canvas, extend, useFrame, type Object3DNode } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ThreeGlobe from 'three-globe';
import * as THREE from 'three';

extend({ ThreeGlobe });

declare module '@react-three/fiber' {
  interface ThreeElements {
    threeGlobe: Object3DNode<ThreeGlobe, typeof ThreeGlobe>;
  }
}

// Real datacenter coordinates (lat, lng) — matches the region list
// rendered alongside the globe in GlobeVisual.tsx.
const DATACENTERS = [
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Dallas', lat: 32.7767, lng: -96.797 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Colombo', lat: 6.9271, lng: 79.8612 },
];

const byName = (name: string) => DATACENTERS.find((d) => d.name === name)!;

const ARCS = [
  { from: 'Colombo', to: 'Singapore' },
  { from: 'Colombo', to: 'Amsterdam' },
  { from: 'Chicago', to: 'Tokyo' },
].map((r) => ({
  startLat: byName(r.from).lat,
  startLng: byName(r.from).lng,
  endLat: byName(r.to).lat,
  endLng: byName(r.to).lng,
}));

const GEOJSON_URL = 'https://unpkg.com/three-globe/example/img/ne_110m_admin_0_countries.geojson';

function Globe() {
  const globeRef = useRef<ThreeGlobe>(null);
  const [countries, setCountries] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCountries(data.features ?? []);
      })
      .catch(() => {
        /* offline-safe: globe still renders markers/arcs on a plain sphere */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe
      .showGlobe(true)
      .showAtmosphere(true)
      .atmosphereColor('#22D3EE')
      .atmosphereAltitude(0.18)
      .hexPolygonsData(countries)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .hexPolygonColor(() => 'rgba(124, 58, 237, 0.55)')
      .pointsData(DATACENTERS)
      .pointLat('lat')
      .pointLng('lng')
      .pointColor(() => '#22D3EE')
      .pointAltitude(0.012)
      .pointRadius(0.45)
      .pointsMerge(false)
      .arcsData(ARCS)
      .arcColor(() => ['rgba(124,58,237,0.9)', 'rgba(34,211,238,0.9)'])
      .arcStroke(0.4)
      .arcDashLength(0.4)
      .arcDashGap(2.2)
      .arcDashAnimateTime(3200)
      .arcAltitudeAutoScale(0.35)
      .ringsData(DATACENTERS)
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(() => (t: number) => `rgba(34,211,238,${1 - t})`)
      .ringMaxRadius(3.2)
      .ringPropagationSpeed(2)
      .ringRepeatPeriod(2200);

    const material = globe.globeMaterial() as THREE.MeshPhongMaterial;
    material.color = new THREE.Color('#120b28');
    material.emissive = new THREE.Color('#2a1150');
    material.emissiveIntensity = 0.25;
    material.shininess = 4;
  }, [countries]);

  return <threeGlobe ref={globeRef} />;
}

function Rig() {
  useFrame((state) => {
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

function AutoRotatePause({ controlsRef }: { controlsRef: React.MutableRefObject<any> }) {
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const pause = () => {
      controls.autoRotate = false;
    };
    const resume = () => {
      controls.autoRotate = true;
    };
    controls.addEventListener('start', pause);
    controls.addEventListener('end', resume);
    return () => {
      controls.removeEventListener('start', pause);
      controls.removeEventListener('end', resume);
    };
  }, [controlsRef]);
  return null;
}

export default function GlobeScene() {
  const controlsRef = useRef<any>(null);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 340], fov: 45, near: 0.1, far: 2000 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.1} color="#c4b5fd" />
      <directionalLight position={[300, 200, 300]} intensity={0.9} color="#a855f7" />
      <directionalLight position={[-200, -100, -200]} intensity={0.6} color="#22d3ee" />

      <Globe />

      <Rig />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={1.1}
        rotateSpeed={0.5}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
      <AutoRotatePause controlsRef={controlsRef} />
    </Canvas>
  );
}
